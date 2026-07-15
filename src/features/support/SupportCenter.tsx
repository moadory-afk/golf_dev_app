import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { C } from "../../theme";

type InquiryKind = "general" | "bug" | "feature";
type InquiryStatus = "pending" | "reviewing" | "answered" | "closed";

type SupportAttachment = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  signed_url?: string;
};

type PendingAttachment = {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
};

type SupportInquiry = {
  id: string;
  user_id: string;
  kind: InquiryKind;
  category: string;
  title: string;
  content: string;
  status: InquiryStatus;
  app_version: string | null;
  device_info: string | null;
  created_at: string;
  updated_at: string;
  support_inquiry_attachments?: SupportAttachment[];
  support_inquiry_replies?: Array<{
    id: string;
    content: string;
    created_at: string;
  }>;
};

type SupportView = "home" | "list" | "faq" | "guide";

type SupportNotification = {
  id: string;
  inquiry_id: string | null;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
};

const KIND_META: Record<InquiryKind, { title: string; icon: string; categories: string[] }> = {
  general: {
    title: "1:1 문의",
    icon: "💬",
    categories: ["이용 문의", "계정 문의", "라운드/기록 문의", "클럽 운영 문의", "기타"],
  },
  bug: {
    title: "버그 신고",
    icon: "🐞",
    categories: ["홈", "클럽", "기록", "프로필", "캐디북", "로또", "기타 화면"],
  },
  feature: {
    title: "기능 제안",
    icon: "💡",
    categories: ["홈", "클럽", "기록", "프로필", "AI 캐디", "기타"],
  },
};

const STATUS_META: Record<InquiryStatus, { label: string; tone: string; bg: string }> = {
  pending: { label: "답변 대기", tone: "#A56A00", bg: "#FFF5D8" },
  reviewing: { label: "확인 중", tone: "#2563A8", bg: "#EAF3FF" },
  answered: { label: "답변 완료", tone: "#16834C", bg: "#E7F7EE" },
  closed: { label: "종료", tone: "#66756D", bg: "#EEF2F0" },
};

const FAQ_GROUPS = [
  {
    title: "계정",
    items: [
      ["닉네임은 어떻게 변경하나요?", "프로필의 계정 탭에서 닉네임을 변경한 뒤 저장하세요."],
      ["회원탈퇴는 어떻게 하나요?", "프로필의 계정 탭에서 회원탈퇴를 선택해 요청할 수 있습니다."],
    ],
  },
  {
    title: "클럽",
    items: [
      ["클럽 가입은 어떻게 하나요?", "초대 링크 또는 초대 코드를 통해 클럽에 가입할 수 있습니다."],
      ["클럽을 탈퇴할 수 있나요?", "클럽 정보의 탈퇴 메뉴를 이용하세요. 관리자 권한은 먼저 위임해야 할 수 있습니다."],
    ],
  },
  {
    title: "라운드와 기록",
    items: [
      ["참석 여부는 어디서 선택하나요?", "홈의 AI 캐디 안내 또는 라운드 상세 화면에서 선택할 수 있습니다."],
      ["경기 결과는 누가 등록하나요?", "클럽 관리자 또는 권한이 있는 회원이 결과를 등록합니다."],
    ],
  },
  {
    title: "로또",
    items: [
      ["로또 구매는 언제 가능한가요?", "구매 기간이 열리면 홈의 AI 캐디 안내와 로또 화면에서 확인할 수 있습니다."],
      ["추첨 결과는 언제 확인하나요?", "라운드 결과가 확정되고 추첨이 완료되면 로또 결과 화면에서 확인할 수 있습니다."],
    ],
  },
];

const GUIDE_ITEMS = [
  ["라운드 등록과 참가", "관리자가 일정을 등록하면 회원은 참석·불참·미정을 선택할 수 있습니다."],
  ["클럽 거리 설정", "보유한 클럽을 선택하고 평균 거리를 입력하면 캐디북과 Shot Plan에 반영됩니다."],
  ["캐디북 사용", "홀별 공략 정보와 개인 클럽 거리를 바탕으로 추천 샷 플랜을 확인할 수 있습니다."],
  ["기록 관리", "라운드 결과가 등록되면 개인별·라운드별·클럽 랭킹에서 기록을 확인할 수 있습니다."],
  ["로또 이용", "라운드별 구매 기간에 번호를 선택하고 결과 확정 후 당첨 여부를 확인합니다."],
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function deviceInfo() {
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    return navigator.userAgent.slice(0, 300);
  }
  return `${Platform.OS} ${String(Platform.Version)}`;
}

export function SupportCenter({ user }: { user: User | null }) {
  const [view, setView] = useState<SupportView>("home");
  const [formKind, setFormKind] = useState<InquiryKind | null>(null);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inquiries, setInquiries] = useState<SupportInquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<SupportInquiry | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [notifications, setNotifications] = useState<SupportNotification[]>([]);

  const formMeta = formKind ? KIND_META[formKind] : null;

  const resetForm = useCallback(() => {
    setFormKind(null);
    setCategory("");
    setTitle("");
    setContent("");
    setAttachments([]);
  }, []);

  const loadInquiries = useCallback(async () => {
    if (!user) {
      setInquiries([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("support_inquiries")
      .select("id,user_id,kind,category,title,content,status,app_version,device_info,created_at,updated_at,support_inquiry_replies(id,content,created_at),support_inquiry_attachments(id,storage_path,file_name,mime_type,size_bytes)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      Alert.alert("문의 내역", "문의 내역을 불러오지 못했습니다. 고객문의 DB 설정을 확인해주세요.");
      return;
    }
    setInquiries((data || []) as SupportInquiry[]);
  }, [user]);

  useEffect(() => {
    if (view === "list") void loadInquiries();
  }, [loadInquiries, view]);


  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const { data, error } = await supabase
      .from("app_notifications")
      .select("id,inquiry_id,title,message,is_read,created_at")
      .eq("user_id", user.id)
      .eq("type", "support_answered")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error) setNotifications((data || []) as SupportNotification[]);
  }, [user]);

  useEffect(() => {
    void loadNotifications();
    if (!user) return;
    const channel = supabase
      .channel(`support-notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "app_notifications", filter: `user_id=eq.${user.id}` },
        () => void loadNotifications(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, user]);

  const unreadNotificationCount = notifications.filter((item) => !item.is_read).length;

  const openNotification = useCallback(async (notification: SupportNotification) => {
    if (!notification.is_read) {
      await supabase.from("app_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", notification.id);
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
    }
    setView("list");
    if (notification.inquiry_id) {
      const { data } = await supabase
        .from("support_inquiries")
        .select("id,user_id,kind,category,title,content,status,app_version,device_info,created_at,updated_at,support_inquiry_replies(id,content,created_at),support_inquiry_attachments(id,storage_path,file_name,mime_type,size_bytes)")
        .eq("id", notification.inquiry_id)
        .maybeSingle();
      if (data) setSelectedInquiry(data as SupportInquiry);
    }
    await loadInquiries();
  }, [loadInquiries]);

  const addAttachments = async () => {
    if (attachments.length >= 3) {
      Alert.alert("이미지 첨부", "이미지는 최대 3장까지 첨부할 수 있습니다.");
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("권한 필요", "이미지를 첨부하려면 사진 접근 권한이 필요합니다.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 3 - attachments.length,
      quality: 0.8,
    });
    if (result.canceled) return;
    const next = result.assets.slice(0, 3 - attachments.length).map((asset, index) => ({
      id: `${Date.now()}-${index}`,
      uri: asset.uri,
      fileName: asset.fileName || `support-${Date.now()}-${index}.jpg`,
      mimeType: asset.mimeType || "image/jpeg",
      sizeBytes: asset.fileSize,
    }));
    setAttachments((current) => [...current, ...next].slice(0, 3));
  };

  const openAttachment = async (attachment: SupportAttachment) => {
    let url = attachment.signed_url;
    if (!url) {
      const { data, error } = await supabase.storage
        .from("support-attachments")
        .createSignedUrl(attachment.storage_path, 60 * 10);
      if (error || !data?.signedUrl) {
        Alert.alert("이미지 열기 실패", "첨부 이미지를 불러오지 못했습니다.");
        return;
      }
      url = data.signedUrl;
    }
    if (Platform.OS === "web") {
      await Linking.openURL(url);
    } else {
      await Linking.openURL(url);
    }
  };

  const submitInquiry = async () => {
    if (!user) {
      Alert.alert("로그인 필요", "문의 등록은 로그인 후 이용할 수 있습니다.");
      return;
    }
    if (!formKind || !category || !title.trim() || !content.trim()) {
      Alert.alert("입력 확인", "문의 유형, 제목과 내용을 모두 입력해주세요.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("support_inquiries")
      .insert({
        user_id: user.id,
        kind: formKind,
        category,
        title: title.trim(),
        content: content.trim(),
        status: "pending",
        app_version: "1.0",
        device_info: deviceInfo(),
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      Alert.alert("등록 실패", "문의를 등록하지 못했습니다. 고객문의 DB 설정을 확인해주세요.");
      return;
    }
    let uploadFailed = 0;
    if (data?.id && attachments.length) {
      for (const attachment of attachments) {
        try {
          const extension = (attachment.fileName.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
          const storagePath = `${user.id}/${data.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
          const response = await fetch(attachment.uri);
          const fileBody = await response.arrayBuffer();
          const { error: uploadError } = await supabase.storage
            .from("support-attachments")
            .upload(storagePath, fileBody, { contentType: attachment.mimeType, upsert: false });
          if (uploadError) throw uploadError;
          const { error: rowError } = await supabase.from("support_inquiry_attachments").insert({
            inquiry_id: data.id,
            user_id: user.id,
            storage_path: storagePath,
            file_name: attachment.fileName,
            mime_type: attachment.mimeType,
            size_bytes: attachment.sizeBytes || fileBody.byteLength,
          });
          if (rowError) throw rowError;
        } catch {
          uploadFailed += 1;
        }
      }
    }
    const inquiryNo = `GP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(data?.id || "").slice(0, 6).toUpperCase()}`;
    resetForm();
    Alert.alert("접수 완료", `문의번호 ${inquiryNo}\n답변이 등록되면 문의 내역에서 확인할 수 있습니다.${uploadFailed ? `\n첨부 이미지 ${uploadFailed}장은 업로드하지 못했습니다.` : ""}`, [
      { text: "확인", onPress: () => setView("list") },
    ]);
  };

  const header = useMemo(() => {
    if (view === "home") return null;
    const label = view === "list" ? "내 문의 내역" : view === "faq" ? "자주 묻는 질문" : "이용안내";
    return (
      <View style={s.subHeader}>
        <TouchableOpacity style={s.backButton} onPress={() => setView("home")}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.subHeaderTitle}>{label}</Text>
        <View style={s.backButton} />
      </View>
    );
  }, [view]);

  return (
    <>
      {header}
      {view === "home" && (
        <View style={s.homeWrap}>
          {unreadNotificationCount > 0 && (
            <View style={s.notificationCard}>
              <View style={s.notificationHeader}>
                <Text style={s.notificationTitle}>🔔 새 답변 {unreadNotificationCount}건</Text>
                <Text style={s.notificationHint}>눌러서 확인하세요</Text>
              </View>
              {notifications.filter((item) => !item.is_read).slice(0, 3).map((item) => (
                <TouchableOpacity key={item.id} style={s.notificationRow} onPress={() => void openNotification(item)}>
                  <View style={s.notificationDot} />
                  <View style={s.notificationTextArea}>
                    <Text style={s.notificationMessage} numberOfLines={1}>{item.message || item.title}</Text>
                    <Text style={s.notificationDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  <Text style={s.notificationArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={s.heroCard}>
            <Text style={s.heroIcon}>💬</Text>
            <View style={s.heroTextArea}>
              <Text style={s.heroTitle}>무엇을 도와드릴까요?</Text>
              <Text style={s.heroDesc}>문의 등록부터 답변 확인까지 한곳에서 관리하세요.</Text>
            </View>
          </View>

          <TouchableOpacity style={s.primaryButton} onPress={() => setFormKind("general")}>
            <Text style={s.primaryButtonIcon}>✍️</Text>
            <Text style={s.primaryButtonText}>1:1 문의하기</Text>
          </TouchableOpacity>

          <View style={s.menuCard}>
            <MenuRow icon="📋" label="내 문의 내역" badge={unreadNotificationCount} onPress={() => setView("list")} />
            <Divider />
            <MenuRow icon="🐞" label="버그 신고" onPress={() => setFormKind("bug")} />
            <Divider />
            <MenuRow icon="💡" label="기능 제안" onPress={() => setFormKind("feature")} />
            <Divider />
            <MenuRow icon="❓" label="자주 묻는 질문(FAQ)" onPress={() => setView("faq")} />
            <Divider />
            <MenuRow icon="📖" label="이용안내" onPress={() => setView("guide")} />
          </View>
        </View>
      )}

      {view === "list" && (
        <View style={s.contentWrap}>
          {loading ? (
            <View style={s.centerBox}><ActivityIndicator color={C.green} /></View>
          ) : inquiries.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyIcon}>📭</Text>
              <Text style={s.emptyTitle}>등록된 문의가 없습니다.</Text>
              <Text style={s.emptyDesc}>문의가 필요하면 1:1 문의 또는 버그 신고를 이용해주세요.</Text>
            </View>
          ) : (
            inquiries.map((item) => {
              const status = STATUS_META[item.status] || STATUS_META.pending;
              return (
                <TouchableOpacity key={item.id} style={s.inquiryCard} onPress={() => setSelectedInquiry(item)}>
                  <View style={s.inquiryTop}>
                    <Text style={s.inquiryKind}>{KIND_META[item.kind]?.icon} {KIND_META[item.kind]?.title}</Text>
                    <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[s.statusText, { color: status.tone }]}>{status.label}</Text>
                    </View>
                  </View>
                  <Text style={s.inquiryTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.inquiryDate}>{formatDate(item.created_at)} · {item.category}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {view === "faq" && (
        <View style={s.contentWrap}>
          {FAQ_GROUPS.map((group) => (
            <View key={group.title} style={s.faqGroup}>
              <Text style={s.faqGroupTitle}>{group.title}</Text>
              {group.items.map(([question, answer]) => {
                const key = `${group.title}-${question}`;
                const opened = openFaq === key;
                return (
                  <View key={key} style={s.faqItem}>
                    <TouchableOpacity style={s.faqQuestionRow} onPress={() => setOpenFaq(opened ? null : key)}>
                      <Text style={s.faqQuestion}>Q. {question}</Text>
                      <Text style={s.faqArrow}>{opened ? "⌃" : "⌄"}</Text>
                    </TouchableOpacity>
                    {opened && <Text style={s.faqAnswer}>A. {answer}</Text>}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {view === "guide" && (
        <View style={s.contentWrap}>
          {GUIDE_ITEMS.map(([label, desc], index) => (
            <View key={label} style={s.guideCard}>
              <View style={s.guideNumber}><Text style={s.guideNumberText}>{index + 1}</Text></View>
              <View style={s.guideTextArea}>
                <Text style={s.guideTitle}>{label}</Text>
                <Text style={s.guideDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Modal visible={Boolean(formKind)} transparent animationType="fade" onRequestClose={resetForm}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{formMeta?.icon} {formMeta?.title}</Text>
              <TouchableOpacity onPress={resetForm}><Text style={s.closeText}>닫기</Text></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.fieldLabel}>문의 유형</Text>
              <View style={s.chipWrap}>
                {formMeta?.categories.map((item) => (
                  <TouchableOpacity key={item} style={[s.chip, category === item && s.chipActive]} onPress={() => setCategory(item)}>
                    <Text style={[s.chipText, category === item && s.chipTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.fieldLabel}>제목</Text>
              <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="제목을 입력해주세요" maxLength={80} />
              <Text style={s.fieldLabel}>{formKind === "bug" ? "오류 내용과 재현 방법" : formKind === "feature" ? "제안 내용과 필요한 이유" : "문의 내용"}</Text>
              <TextInput
                style={[s.input, s.contentInput]}
                value={content}
                onChangeText={setContent}
                placeholder={formKind === "bug" ? "어떤 화면에서 어떤 순서로 오류가 발생했는지 작성해주세요." : "내용을 자세히 입력해주세요."}
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />
              <Text style={s.fieldLabel}>이미지 첨부</Text>
              <View style={s.attachmentRow}>
                {attachments.map((item) => (
                  <View key={item.id} style={s.pendingAttachment}>
                    <Image source={{ uri: item.uri }} style={s.attachmentImage} />
                    <TouchableOpacity style={s.removeAttachment} onPress={() => setAttachments((current) => current.filter((value) => value.id !== item.id))}>
                      <Text style={s.removeAttachmentText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {attachments.length < 3 && (
                  <TouchableOpacity style={s.addAttachment} onPress={() => void addAttachments()}>
                    <Text style={s.addAttachmentIcon}>＋</Text>
                    <Text style={s.addAttachmentText}>사진</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={s.attachmentHint}>오류 화면이나 참고 이미지를 최대 3장까지 첨부할 수 있습니다.</Text>
              <Text style={s.deviceHint}>앱 버전과 기기 정보는 문의 등록 시 자동으로 함께 저장됩니다.</Text>
              <TouchableOpacity style={[s.submitButton, saving && s.disabledButton]} disabled={saving} onPress={submitInquiry}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitButtonText}>문의 등록</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedInquiry)} transparent animationType="fade" onRequestClose={() => setSelectedInquiry(null)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>문의 상세</Text>
              <TouchableOpacity onPress={() => setSelectedInquiry(null)}><Text style={s.closeText}>닫기</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedInquiry && (
                <>
                  <Text style={s.detailCategory}>{KIND_META[selectedInquiry.kind]?.title} · {selectedInquiry.category}</Text>
                  <Text style={s.detailTitle}>{selectedInquiry.title}</Text>
                  <Text style={s.detailDate}>{formatDate(selectedInquiry.created_at)}</Text>
                  <View style={s.detailBox}><Text style={s.detailContent}>{selectedInquiry.content}</Text></View>
                  {!!selectedInquiry.support_inquiry_attachments?.length && (
                    <>
                      <Text style={s.replySectionTitle}>첨부 이미지</Text>
                      <View style={s.detailAttachmentRow}>
                        {selectedInquiry.support_inquiry_attachments.map((attachment) => (
                          <TouchableOpacity key={attachment.id} onPress={() => void openAttachment(attachment)}>
                            <View style={s.detailAttachmentBox}><Text style={s.detailAttachmentIcon}>🖼️</Text><Text style={s.detailAttachmentName} numberOfLines={1}>{attachment.file_name}</Text></View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  <Text style={s.replySectionTitle}>운영자 답변</Text>
                  {selectedInquiry.support_inquiry_replies?.length ? (
                    selectedInquiry.support_inquiry_replies.map((reply) => (
                      <View key={reply.id} style={s.replyBox}>
                        <Text style={s.replyContent}>{reply.content}</Text>
                        <Text style={s.replyDate}>{formatDate(reply.created_at)}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={s.waitingReply}><Text style={s.waitingReplyText}>답변을 준비 중입니다.</Text></View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function MenuRow({ icon, label, badge = 0, onPress }: { icon: string; label: string; badge?: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.menuRow} onPress={onPress}>
      <Text style={s.menuIcon}>{icon}</Text>
      <Text style={s.menuText}>{label}</Text>
      {badge > 0 && <View style={s.menuBadge}><Text style={s.menuBadgeText}>{badge > 99 ? "99+" : badge}</Text></View>}
      <Text style={s.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

function Divider() { return <View style={s.divider} />; }

const s = StyleSheet.create({
  homeWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  notificationCard: { backgroundColor: "#FFF8E7", borderWidth: 1, borderColor: "#F4D58A", borderRadius: 16, padding: 13, marginBottom: 12 },
  notificationHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  notificationTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  notificationHint: { color: C.muted, fontSize: 10, fontWeight: "700" },
  notificationRow: { minHeight: 45, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(165,106,0,.14)", gap: 9 },
  notificationDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#E15B3E" },
  notificationTextArea: { flex: 1 },
  notificationMessage: { color: C.text, fontSize: 12, fontWeight: "800" },
  notificationDate: { color: C.muted, fontSize: 10, marginTop: 2 },
  notificationArrow: { color: C.muted, fontSize: 19 },
  contentWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  heroCard: { backgroundColor: C.greenLight, borderRadius: 18, padding: 17, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 12 },
  heroIcon: { fontSize: 30 },
  heroTextArea: { flex: 1 },
  heroTitle: { color: C.text, fontSize: 17, fontWeight: "900", marginBottom: 4 },
  heroDesc: { color: C.muted, fontSize: 12, lineHeight: 17 },
  primaryButton: { backgroundColor: C.green, borderRadius: 15, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  primaryButtonIcon: { fontSize: 17 },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  menuCard: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" },
  menuRow: { minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 11 },
  menuIcon: { width: 26, textAlign: "center", fontSize: 18 },
  menuText: { flex: 1, color: C.text, fontSize: 15, fontWeight: "700" },
  menuBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: "#E15B3E", alignItems: "center", justifyContent: "center" },
  menuBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  menuArrow: { color: C.muted, fontSize: 20 },
  divider: { height: 1, backgroundColor: C.border, marginLeft: 53 },
  subHeader: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, marginBottom: 8 },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  backText: { color: C.text, fontSize: 32, lineHeight: 34 },
  subHeaderTitle: { color: C.text, fontSize: 17, fontWeight: "900" },
  centerBox: { paddingVertical: 50, alignItems: "center" },
  emptyCard: { backgroundColor: "#fff", borderRadius: 17, padding: 28, alignItems: "center" },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: "900", marginBottom: 6 },
  emptyDesc: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  inquiryCard: { backgroundColor: "#fff", borderRadius: 16, padding: 15, marginBottom: 9 },
  inquiryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
  inquiryKind: { color: C.muted, fontSize: 12, fontWeight: "800" },
  statusBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: "900" },
  inquiryTitle: { color: C.text, fontSize: 15, fontWeight: "900", marginBottom: 7 },
  inquiryDate: { color: C.muted, fontSize: 11 },
  faqGroup: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10 },
  faqGroupTitle: { color: C.green, fontSize: 14, fontWeight: "900", marginBottom: 5 },
  faqItem: { borderTopWidth: 1, borderTopColor: C.border },
  faqQuestionRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 8 },
  faqQuestion: { flex: 1, color: C.text, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  faqArrow: { color: C.muted, fontSize: 16 },
  faqAnswer: { color: C.muted, fontSize: 12, lineHeight: 18, backgroundColor: "#F7F9F8", borderRadius: 10, padding: 12, marginBottom: 10 },
  guideCard: { backgroundColor: "#fff", borderRadius: 16, padding: 15, flexDirection: "row", gap: 12, marginBottom: 9 },
  guideNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.greenLight, alignItems: "center", justifyContent: "center" },
  guideNumberText: { color: C.green, fontSize: 13, fontWeight: "900" },
  guideTextArea: { flex: 1 },
  guideTitle: { color: C.text, fontSize: 14, fontWeight: "900", marginBottom: 5 },
  guideDesc: { color: C.muted, fontSize: 12, lineHeight: 18 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.52)", justifyContent: "center", alignItems: "center", padding: 18 },
  modalCard: { width: "100%", maxWidth: 430, maxHeight: "88%", backgroundColor: "#fff", borderRadius: 22, padding: 19 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  modalTitle: { color: C.text, fontSize: 17, fontWeight: "900" },
  closeText: { color: C.muted, fontSize: 13, fontWeight: "700" },
  fieldLabel: { color: C.text, fontSize: 13, fontWeight: "900", marginBottom: 8, marginTop: 5 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 13 },
  chip: { borderWidth: 1.3, borderColor: C.border, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: "#fff" },
  chipActive: { borderColor: C.green, backgroundColor: C.greenLight },
  chipText: { color: C.muted, fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: C.green },
  input: { borderWidth: 1.3, borderColor: C.border, borderRadius: 12, backgroundColor: "#FAFBFA", color: C.text, fontSize: 14, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 13 },
  contentInput: { minHeight: 150 },
  deviceHint: { color: C.muted, fontSize: 11, lineHeight: 16, marginBottom: 14 },
  submitButton: { minHeight: 50, borderRadius: 14, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  disabledButton: { opacity: 0.65 },
  submitButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  detailCategory: { color: C.green, fontSize: 12, fontWeight: "900", marginBottom: 8 },
  detailTitle: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: "900", marginBottom: 6 },
  detailDate: { color: C.muted, fontSize: 11, marginBottom: 14 },
  detailBox: { backgroundColor: "#F7F9F8", borderRadius: 13, padding: 14, marginBottom: 18 },
  detailContent: { color: C.text, fontSize: 13, lineHeight: 20 },
  replySectionTitle: { color: C.text, fontSize: 14, fontWeight: "900", marginBottom: 9 },
  replyBox: { backgroundColor: C.greenLight, borderRadius: 13, padding: 14, marginBottom: 9 },
  replyContent: { color: C.text, fontSize: 13, lineHeight: 20 },
  replyDate: { color: C.muted, fontSize: 10, marginTop: 8, textAlign: "right" },
  waitingReply: { borderWidth: 1, borderColor: C.border, borderStyle: "dashed", borderRadius: 13, padding: 18, alignItems: "center" },
  waitingReplyText: { color: C.muted, fontSize: 12, fontWeight: "700" },
  attachmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 7 },
  pendingAttachment: { width: 72, height: 72, borderRadius: 12, overflow: "hidden", position: "relative", backgroundColor: "#EEF2F0" },
  attachmentImage: { width: "100%", height: "100%" },
  removeAttachment: { position: "absolute", right: 4, top: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,.68)", alignItems: "center", justifyContent: "center" },
  removeAttachmentText: { color: "#fff", fontSize: 17, lineHeight: 19, fontWeight: "900" },
  addAttachment: { width: 72, height: 72, borderRadius: 12, borderWidth: 1.3, borderStyle: "dashed", borderColor: C.border, alignItems: "center", justifyContent: "center", backgroundColor: "#FAFBFA" },
  addAttachmentIcon: { color: C.green, fontSize: 23, lineHeight: 25 },
  addAttachmentText: { color: C.muted, fontSize: 11, fontWeight: "800" },
  attachmentHint: { color: C.muted, fontSize: 10, marginBottom: 9 },
  detailAttachmentRow: { gap: 7, marginBottom: 15 },
  detailAttachmentBox: { minHeight: 45, borderWidth: 1, borderColor: C.border, borderRadius: 11, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  detailAttachmentIcon: { fontSize: 18 },
  detailAttachmentName: { flex: 1, color: C.text, fontSize: 12, fontWeight: "700" },
});
