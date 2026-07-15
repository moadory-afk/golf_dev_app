import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { C } from "../../theme";

type Status = "pending" | "reviewing" | "answered" | "closed";
type Inquiry = {
  id: string; user_id: string; kind: "general" | "bug" | "feature"; category: string;
  title: string; content: string; status: Status; app_version: string | null;
  device_info: string | null; created_at: string;
  support_inquiry_attachments?: { id: string; storage_path: string; file_name: string; mime_type: string | null; size_bytes: number | null }[];
  support_inquiry_replies?: { id: string; content: string; created_at: string }[];
};
const labels: Record<Status,string> = { pending:"답변 대기", reviewing:"확인 중", answered:"답변 완료", closed:"종료" };
const kindLabels = { general:"1:1 문의", bug:"버그 신고", feature:"기능 제안" };
const fmt=(v:string)=>new Date(v).toLocaleDateString("ko-KR");

export function SupportAdminCenter({ user }: { user: User | null }) {
  const [items,setItems]=useState<Inquiry[]>([]); const [loading,setLoading]=useState(false);
  const [filter,setFilter]=useState<"all"|Status>("all"); const [selected,setSelected]=useState<Inquiry|null>(null);
  const [reply,setReply]=useState(""); const [saving,setSaving]=useState(false);
  const load=useCallback(async()=>{ if(!user)return; setLoading(true); const {data,error}=await supabase.from("support_inquiries")
    .select("id,user_id,kind,category,title,content,status,app_version,device_info,created_at,support_inquiry_replies(id,content,created_at),support_inquiry_attachments(id,storage_path,file_name,mime_type,size_bytes)")
    .order("created_at",{ascending:false}); setLoading(false); if(error){Alert.alert("조회 실패","개발자 권한 또는 고객문의 DB 설정을 확인해주세요.");return;} setItems((data||[]) as Inquiry[]); },[user]);
  useEffect(()=>{void load()},[load]);
  const filtered=useMemo(()=>filter==="all"?items:items.filter(x=>x.status===filter),[items,filter]);
  const counts=useMemo(()=>({all:items.length,pending:items.filter(x=>x.status==="pending").length,reviewing:items.filter(x=>x.status==="reviewing").length,answered:items.filter(x=>x.status==="answered").length,closed:items.filter(x=>x.status==="closed").length}),[items]);

  async function openAttachment(storagePath:string){ const {data,error}=await supabase.storage.from("support-attachments").createSignedUrl(storagePath,600); if(error||!data?.signedUrl){Alert.alert("이미지 열기 실패","첨부 이미지를 불러오지 못했습니다.");return;} await Linking.openURL(data.signedUrl); }
  async function changeStatus(status:Status){ if(!selected)return; const {error}=await supabase.from("support_inquiries").update({status,updated_at:new Date().toISOString()}).eq("id",selected.id); if(error){Alert.alert("상태 변경 실패",error.message);return;} setSelected({...selected,status}); await load(); }
  async function saveReply(){
    if(!selected||!reply.trim())return;
    setSaving(true);
    const replyContent=reply.trim();
    const {error}=await supabase.from("support_inquiry_replies").insert({inquiry_id:selected.id,admin_user_id:user?.id,content:replyContent});
    if(!error){
      await supabase.from("support_inquiries").update({status:"answered",updated_at:new Date().toISOString()}).eq("id",selected.id);
      const {error:notificationError}=await supabase.from("app_notifications").insert({
        user_id:selected.user_id,
        type:"support_answered",
        title:"고객문의 답변이 등록되었습니다.",
        message:selected.title,
        inquiry_id:selected.id,
        is_read:false,
      });
      if(notificationError) console.warn("support notification insert failed",notificationError.message);
    }
    setSaving(false);
    if(error){Alert.alert("답변 저장 실패",error.message);return;}
    setReply(""); setSelected(null); await load(); Alert.alert("저장 완료","답변과 사용자 알림이 등록되었습니다.");
  }
  return <>
    <View style={s.summary}><Text style={s.summaryTitle}>고객문의 관리</Text><Text style={s.summaryText}>답변 대기 {counts.pending}건 · 확인 중 {counts.reviewing}건</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
      {(["all","pending","reviewing","answered","closed"] as const).map(k=><TouchableOpacity key={k} style={[s.filter,filter===k&&s.filterOn]} onPress={()=>setFilter(k)}><Text style={[s.filterText,filter===k&&s.filterTextOn]}>{k==="all"?"전체":labels[k]} {counts[k]}</Text></TouchableOpacity>)}
    </ScrollView>
    {loading?<ActivityIndicator color={C.green} style={{margin:30}}/>:filtered.length===0?<View style={s.empty}><Text style={s.emptyText}>해당 문의가 없습니다.</Text></View>:filtered.map(item=><TouchableOpacity key={item.id} style={s.card} onPress={()=>{setSelected(item);setReply("")}}>
      <View style={s.row}><Text style={s.kind}>{kindLabels[item.kind]} · {item.category}</Text><Text style={s.status}>{labels[item.status]}</Text></View><Text style={s.title} numberOfLines={1}>{item.title}</Text><Text style={s.date}>{fmt(item.created_at)}</Text>
    </TouchableOpacity>)}
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={()=>setSelected(null)}><View style={s.overlay}><View style={s.modal}>
      <View style={s.row}><Text style={s.modalTitle}>문의 처리</Text><TouchableOpacity onPress={()=>setSelected(null)}><Text>닫기</Text></TouchableOpacity></View>
      <ScrollView showsVerticalScrollIndicator={false}>{selected&&<>
        <Text style={s.kind}>{kindLabels[selected.kind]} · {selected.category}</Text><Text style={s.detailTitle}>{selected.title}</Text><Text style={s.date}>{fmt(selected.created_at)}</Text>
        <View style={s.contentBox}><Text style={s.content}>{selected.content}</Text></View>
        {!!selected.support_inquiry_attachments?.length&&<><Text style={s.label}>첨부 이미지</Text>{selected.support_inquiry_attachments.map(a=><TouchableOpacity key={a.id} style={s.attachment} onPress={()=>void openAttachment(a.storage_path)}><Text style={s.attachmentIcon}>🖼️</Text><Text style={s.attachmentName} numberOfLines={1}>{a.file_name}</Text><Text style={s.attachmentOpen}>열기</Text></TouchableOpacity>)}</>}
        <Text style={s.info}>앱 {selected.app_version||"-"}</Text><Text style={s.info}>기기 {selected.device_info||"-"}</Text>
        <Text style={s.label}>처리 상태</Text><View style={s.statusWrap}>{(["pending","reviewing","answered","closed"] as Status[]).map(st=><TouchableOpacity key={st} style={[s.statusButton,selected.status===st&&s.statusButtonOn]} onPress={()=>void changeStatus(st)}><Text style={selected.status===st?s.statusButtonTextOn:s.statusButtonText}>{labels[st]}</Text></TouchableOpacity>)}</View>
        {!!selected.support_inquiry_replies?.length&&<><Text style={s.label}>기존 답변</Text>{selected.support_inquiry_replies.map(r=><View key={r.id} style={s.replyBox}><Text style={s.content}>{r.content}</Text><Text style={s.date}>{fmt(r.created_at)}</Text></View>)}</>}
        <Text style={s.label}>답변 작성</Text><TextInput style={s.input} multiline textAlignVertical="top" value={reply} onChangeText={setReply} placeholder="사용자에게 전달할 답변을 입력하세요."/>
        <TouchableOpacity style={[s.save,!reply.trim()&&{opacity:.5}]} disabled={saving||!reply.trim()} onPress={()=>void saveReply()}>{saving?<ActivityIndicator color="#fff"/>:<Text style={s.saveText}>답변 저장</Text>}</TouchableOpacity>
      </>}</ScrollView>
    </View></View></Modal>
  </>;
}
const s=StyleSheet.create({summary:{marginHorizontal:16,backgroundColor:C.greenLight,borderRadius:16,padding:16},summaryTitle:{fontSize:17,fontWeight:"900",color:C.text},summaryText:{fontSize:12,color:C.muted,marginTop:5},filters:{paddingHorizontal:16,paddingVertical:12,gap:7},filter:{paddingHorizontal:12,paddingVertical:8,borderRadius:18,backgroundColor:"#fff",borderWidth:1,borderColor:C.border},filterOn:{backgroundColor:C.green,borderColor:C.green},filterText:{fontSize:12,fontWeight:"800",color:C.muted},filterTextOn:{color:"#fff"},card:{marginHorizontal:16,marginBottom:9,backgroundColor:"#fff",borderRadius:15,padding:14},row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},kind:{fontSize:11,fontWeight:"800",color:C.green},status:{fontSize:11,fontWeight:"900",color:C.muted},title:{fontSize:15,fontWeight:"900",color:C.text,marginTop:8},date:{fontSize:10,color:C.muted,marginTop:6},empty:{marginHorizontal:16,backgroundColor:"#fff",borderRadius:15,padding:30,alignItems:"center"},emptyText:{color:C.muted},overlay:{flex:1,backgroundColor:"rgba(0,0,0,.5)",alignItems:"center",justifyContent:"center",padding:18},modal:{width:"100%",maxWidth:440,maxHeight:"90%",backgroundColor:"#fff",borderRadius:20,padding:18},modalTitle:{fontSize:18,fontWeight:"900",color:C.text},detailTitle:{fontSize:18,fontWeight:"900",color:C.text,marginTop:8},contentBox:{backgroundColor:"#F6F8F7",borderRadius:12,padding:13,marginTop:14},content:{fontSize:13,lineHeight:20,color:C.text},info:{fontSize:10,color:C.muted,marginTop:5},label:{fontSize:13,fontWeight:"900",color:C.text,marginTop:16,marginBottom:8},statusWrap:{flexDirection:"row",flexWrap:"wrap",gap:6},statusButton:{paddingHorizontal:10,paddingVertical:7,borderRadius:15,borderWidth:1,borderColor:C.border},statusButtonOn:{backgroundColor:C.green,borderColor:C.green},statusButtonText:{fontSize:11,color:C.muted,fontWeight:"800"},statusButtonTextOn:{fontSize:11,color:"#fff",fontWeight:"900"},replyBox:{backgroundColor:C.greenLight,borderRadius:12,padding:12,marginBottom:7},input:{minHeight:120,borderWidth:1,borderColor:C.border,borderRadius:12,padding:12,fontSize:13},save:{height:48,borderRadius:13,backgroundColor:C.green,alignItems:"center",justifyContent:"center",marginTop:12},saveText:{color:"#fff",fontWeight:"900"},attachment:{minHeight:46,borderWidth:1,borderColor:C.border,borderRadius:11,paddingHorizontal:11,flexDirection:"row",alignItems:"center",gap:8,marginBottom:6},attachmentIcon:{fontSize:18},attachmentName:{flex:1,fontSize:12,fontWeight:"700",color:C.text},attachmentOpen:{fontSize:11,fontWeight:"900",color:C.green}});
