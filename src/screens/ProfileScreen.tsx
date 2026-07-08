import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import type { User } from "@supabase/supabase-js";
import { EmojiIcon } from "../components/EmojiIcon";
import {
  ImageCropModal,
  type ImageCropRect,
} from "../components/ImageCropModal";
import { ensureProfile } from "../lib/store";
import { supabase } from "../lib/supabase";
import { useUserProfile } from "../lib/UserProfileContext";
import { C } from "../theme";
import { useSkin, type SkinId } from "../skins";

const PROFILE_EMOJIS = [
  "🏌️",
  "⛳",
  "🏆",
  "👑",
  "💎",
  "🔥",
  "⚡",
  "🌟",
  "😎",
  "🤩",
  "🦁",
  "🐯",
  "🦅",
  "🦊",
  "🐻",
  "🚀",
  "🎯",
  "💪",
  "🌈",
  "🌊",
  "🎸",
  "🎨",
  "🍀",
  "🌺",
  "🏖️",
  "⛰️",
  "🌙",
  "☀️",
  "❄️",
  "🔮",
];

type ClubDistanceKey =
  | "driver_m"
  | "wood3_m"
  | "wood5_m"
  | "hybrid4_m"
  | "hybrid5_m"
  | "iron5_m"
  | "iron6_m"
  | "iron7_m"
  | "iron8_m"
  | "iron9_m"
  | "pw_m"
  | "aw_m"
  | "sw_m";

type ClubDistanceForm = Record<ClubDistanceKey, string>;

const CLUB_DISTANCE_FIELDS: Array<{ key: ClubDistanceKey; label: string }> = [
  { key: "driver_m", label: "Driver" },
  { key: "wood3_m", label: "3W" },
  { key: "wood5_m", label: "5W" },
  { key: "hybrid4_m", label: "4H" },
  { key: "hybrid5_m", label: "5H" },
  { key: "iron5_m", label: "5I" },
  { key: "iron6_m", label: "6I" },
  { key: "iron7_m", label: "7I" },
  { key: "iron8_m", label: "8I" },
  { key: "iron9_m", label: "9I" },
  { key: "pw_m", label: "PW" },
  { key: "aw_m", label: "AW" },
  { key: "sw_m", label: "SW" },
];

const DEFAULT_DISTANCE_FORM: ClubDistanceForm = CLUB_DISTANCE_FIELDS.reduce(
  (acc, field) => {
    acc[field.key] = "";
    return acc;
  },
  {} as ClubDistanceForm,
);

const DEFAULT_DISTANCE_VALUES: Record<ClubDistanceKey, number> = {
  driver_m: 200,
  wood3_m: 180,
  wood5_m: 170,
  hybrid4_m: 160,
  hybrid5_m: 150,
  iron5_m: 150,
  iron6_m: 140,
  iron7_m: 130,
  iron8_m: 120,
  iron9_m: 110,
  pw_m: 100,
  aw_m: 85,
  sw_m: 70,
};

type GeoPoint = { latitude: number; longitude: number };

type KakaoAddressResult = {
  id: string;
  label: string;
  subLabel?: string;
  roadAddress?: string;
  jibunAddress?: string;
  placeName?: string;
  latitude: number;
  longitude: number;
};

function envValue(key: string): string {
  return String(process.env[key] || "").trim();
}

function kakaoRestApiKey(): string {
  return envValue("EXPO_PUBLIC_KAKAO_REST_API_KEY");
}

function isValidPoint(
  latitude: unknown,
  longitude: unknown,
): latitude is number {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}

async function searchKakaoAddress(
  keyword: string,
): Promise<KakaoAddressResult[]> {
  const query = keyword.trim();
  const kakaoKey = kakaoRestApiKey();
  if (!query || !kakaoKey) return [];

  const headers = { Authorization: `KakaoAK ${kakaoKey}` };
  const urls = [
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=15`,
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=15`,
  ];

  const readDocuments = async (url: string) => {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error("주소 검색에 실패했습니다.");
    const json = await response.json();
    return Array.isArray(json?.documents) ? json.documents : [];
  };

  const docs = (await Promise.all(urls.map(readDocuments))).flat();
  const unique = new Map<string, KakaoAddressResult>();

  docs.forEach((doc: any, index: number) => {
    const latitude = Number(doc.y);
    const longitude = Number(doc.x);
    if (!isValidPoint(latitude, longitude)) return;

    const roadAddress =
      doc.road_address?.address_name || doc.road_address_name || "";
    const jibunAddress = doc.address?.address_name || doc.address_name || "";
    const placeName = doc.place_name || "";
    const label = roadAddress || jibunAddress || placeName;
    if (!label) return;

    const subLabel = [placeName, jibunAddress]
      .filter((value) => value && value !== label)
      .join(" · ");
    const id = String(
      doc.id || `${label}-${longitude}-${latitude}-${index}`,
    );

    if (!unique.has(id)) {
      unique.set(id, {
        id,
        label,
        subLabel: subLabel || undefined,
        roadAddress: roadAddress || undefined,
        jibunAddress: jibunAddress || undefined,
        placeName: placeName || undefined,
        latitude,
        longitude,
      });
    }
  });

  return Array.from(unique.values());
}

async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const keyword = address.trim();
  if (!keyword) return null;

  const kakaoKey = kakaoRestApiKey();
  if (kakaoKey) {
    try {
      const response = await fetch(
        `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(keyword)}`,
        {
          headers: { Authorization: `KakaoAK ${kakaoKey}` },
        },
      );
      if (response.ok) {
        const json = await response.json();
        const first = json?.documents?.[0];
        const latitude = Number(first?.y);
        const longitude = Number(first?.x);
        if (Number.isFinite(latitude) && Number.isFinite(longitude))
          return { latitude, longitude };
      }
    } catch {
      // fallback below
    }
  }

  const weatherKey = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
  if (weatherKey) {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(keyword)}&limit=1&appid=${weatherKey}`,
      );
      if (response.ok) {
        const json = await response.json();
        const first = Array.isArray(json) ? json[0] : null;
        const latitude = Number(first?.lat);
        const longitude = Number(first?.lon);
        if (Number.isFinite(latitude) && Number.isFinite(longitude))
          return { latitude, longitude };
      }
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeDistanceValue(value: string, fallback: number): number {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const normalized = Number(trimmed.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(normalized) || normalized < 0) return fallback;
  return Math.round(normalized);
}

function EmojiPicker({
  emojis,
  selected,
  onSelect,
  onClose,
}: {
  emojis: string[];
  selected: string;
  onSelect: (e: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={ep.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={ep.card} activeOpacity={1} onPress={() => {}}>
          <View style={ep.header}>
            <Text style={ep.title}>아이콘 선택</Text>
            <TouchableOpacity onPress={onClose} style={ep.closeBtn}>
              <Text style={ep.closeBtnText}>완료</Text>
            </TouchableOpacity>
          </View>
          <View style={ep.grid}>
            {emojis.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[ep.emojiBtn, selected === emoji && ep.emojiBtnActive]}
                onPress={() => onSelect(emoji)}
              >
                <Text style={ep.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function KakaoAddressSearchModal({
  visible,
  initialQuery,
  onSelect,
  onClose,
}: {
  visible: boolean;
  initialQuery: string;
  onSelect: (result: KakaoAddressResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<KakaoAddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!visible) return;
    setQuery(initialQuery);
    setResults([]);
    setErrorMessage("");
  }, [visible, initialQuery]);

  async function handleSearch() {
    const keyword = query.trim();
    if (!keyword) {
      setErrorMessage("검색할 주소를 입력해주세요.");
      return;
    }
    if (!kakaoRestApiKey()) {
      setErrorMessage("Kakao REST API Key가 설정되어 있지 않습니다.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const nextResults = await searchKakaoAddress(keyword);
      setResults(nextResults);
      if (nextResults.length === 0)
        setErrorMessage(
          "검색 결과가 없습니다. 도로명 또는 지번 주소를 더 자세히 입력해주세요.",
        );
    } catch (e: unknown) {
      setErrorMessage(
        e instanceof Error ? e.message : "주소 검색에 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={p.addressModalOverlay}>
        <View style={p.addressModalCard}>
          <View style={p.addressModalHeader}>
            <Text style={p.addressModalTitle}>집 주소 검색</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={p.addressModalClose}>닫기</Text>
            </TouchableOpacity>
          </View>

          <View style={p.addressSearchRow}>
            <TextInput
              style={p.addressSearchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="도로명, 지번, 건물명으로 검색"
              placeholderTextColor={C.muted}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity
              style={[p.addressSearchButton, loading && { opacity: 0.6 }]}
              onPress={handleSearch}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={p.addressSearchButtonText}>검색</Text>
              )}
            </TouchableOpacity>
          </View>

          {!!errorMessage && (
            <Text style={p.addressSearchError}>{errorMessage}</Text>
          )}

          <ScrollView
            style={p.addressResultList}
            keyboardShouldPersistTaps="handled"
          >
            {results.map((result) => (
              <TouchableOpacity
                key={result.id}
                style={p.addressResultItem}
                onPress={() => onSelect(result)}
                activeOpacity={0.84}
              >
                <Text style={p.addressResultTitle} numberOfLines={2}>
                  {result.label}
                </Text>
                {!!result.subLabel && (
                  <Text style={p.addressResultSubtitle} numberOfLines={1}>
                    {result.subLabel}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const { refreshProfile } = useUserProfile();
  const { skinId, skins, setSkinId, palette } = useSkin();
  const [user, setUser] = useState<User | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState("");
  const [profileName, setProfileName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [showProfileIconPicker, setShowProfileIconPicker] = useState(false);
  const [profileIcon, setProfileIcon] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pendingPhotoCrop, setPendingPhotoCrop] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [showPwModal, setShowPwModal] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [homeAddress, setHomeAddress] = useState("");
  const [selectedHomePoint, setSelectedHomePoint] = useState<GeoPoint | null>(
    null,
  );
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [savingHome, setSavingHome] = useState(false);
  const [distanceForm, setDistanceForm] = useState<ClubDistanceForm>(
    DEFAULT_DISTANCE_FORM,
  );
  const [savingDistances, setSavingDistances] = useState(false);
  const departureBufferMinutes = 40;

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!alive) return;
      const authUser = data.user;
      setUser(authUser);
      setProfileIcon(authUser?.user_metadata?.icon ?? "");
      setAvatarUrl(authUser?.user_metadata?.avatarUrl ?? "");

      const metadataName = authUser?.user_metadata?.name ?? "";
      let fallbackName = "";
      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, home_address, home_latitude, home_longitude")
          .eq("id", authUser.id)
          .maybeSingle();
        fallbackName = profile?.name ?? "";
        if (alive && profile) {
          setHomeAddress(profile.home_address ?? "");
          const latitude = Number(profile.home_latitude);
          const longitude = Number(profile.home_longitude);
          setSelectedHomePoint(
            Number.isFinite(latitude) && Number.isFinite(longitude)
              ? { latitude, longitude }
              : null,
          );
        }

        const { data: distanceProfile } = await supabase
          .from("user_distance_profiles")
          .select(CLUB_DISTANCE_FIELDS.map((field) => field.key).join(","))
          .eq("user_id", authUser.id)
          .maybeSingle();
        if (alive && distanceProfile) {
          const nextForm = { ...DEFAULT_DISTANCE_FORM };
          CLUB_DISTANCE_FIELDS.forEach((field) => {
            const value =
              distanceProfile[field.key as keyof typeof distanceProfile];
            nextForm[field.key] =
              typeof value === "number" ? String(value) : "";
          });
          setDistanceForm(nextForm);
        }
      }
      const displayName = metadataName || fallbackName;
      if (!alive) return;
      setProfileName(displayName);
      setEditNameVal(displayName);
    });
    return () => {
      alive = false;
    };
  }, []);

  const userName =
    profileName || user?.user_metadata?.name || user?.email || "";
  const userInitial = userName.slice(0, 1) || "?";

  async function handlePickPhoto(source: "camera" | "gallery" = "gallery") {
    setShowAvatarOptions(false);
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "권한 필요",
        source === "camera"
          ? "카메라 접근 권한이 필요합니다."
          : "사진 접근 권한이 필요합니다.",
      );
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPendingPhotoCrop({
      uri: asset.uri,
      width: asset.width || 1000,
      height: asset.height || 1000,
    });
  }

  async function handleSaveCroppedPhoto(crop: ImageCropRect) {
    if (!pendingPhotoCrop) return;
    setPendingPhotoCrop(null);
    setUploadingPhoto(true);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        pendingPhotoCrop.uri,
        [{ crop }, { resize: { width: 100, height: 100 } }],
        {
          compress: 0.4,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );
      const dataUri = `data:image/jpeg;base64,${compressed.base64}`;
      if (dataUri.length > 20000) {
        Alert.alert("사진이 너무 큽니다", "더 작은 사진을 선택해주세요.");
        return;
      }
      const { error } = await supabase.auth.updateUser({
        data: { ...user?.user_metadata, avatarUrl: dataUri, icon: "" },
      });
      if (error) throw error;
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setAvatarUrl(dataUri);
      setProfileIcon("");
      await refreshProfile();
    } catch {
      Alert.alert("오류", "사진 업로드에 실패했습니다.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSelectProfileIcon(emoji: string) {
    setProfileIcon(emoji);
    setShowProfileIconPicker(false);
    const { error } = await supabase.auth.updateUser({
      data: { ...user?.user_metadata, icon: emoji, avatarUrl: "" },
    });
    if (error) {
      Alert.alert("오류", "아이콘 저장에 실패했습니다.");
      return;
    }
    setAvatarUrl("");
    await refreshProfile();
  }

  async function handleClearAvatar() {
    setShowAvatarOptions(false);
    const { error } = await supabase.auth.updateUser({
      data: { ...user?.user_metadata, avatarUrl: "", icon: "" },
    });
    if (error) {
      Alert.alert("오류", "프로필 이미지 초기화에 실패했습니다.");
      return;
    }
    setAvatarUrl("");
    setProfileIcon("");
    await refreshProfile();
  }

  async function handleSaveName() {
    if (!editNameVal.trim() || !user) return;
    setSavingName(true);
    try {
      const name = editNameVal.trim();
      const { error } = await supabase.auth.updateUser({
        data: { ...user.user_metadata, name },
      });
      if (error) throw error;
      await ensureProfile(user.id, name);
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setProfileName(name);
      setEditingName(false);
      await refreshProfile();
    } catch {
      Alert.alert("오류", "이름 변경에 실패했습니다.");
    } finally {
      setSavingName(false);
    }
  }

  function handleSelectAddressResult(result: KakaoAddressResult) {
    setHomeAddress(result.label);
    setSelectedHomePoint({
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setShowAddressSearch(false);
  }

  async function handleSaveHome() {
    if (!user) return;

    const address = homeAddress.trim();
    if (!address) {
      Alert.alert("입력 확인", "집 주소를 입력해주세요.");
      return;
    }

    setSavingHome(true);
    try {
      const point = selectedHomePoint ?? (await geocodeAddress(address));
      const payload = {
        name: profileName || user.user_metadata?.name || user.email || null,
        home_address: address,
        home_latitude: point?.latitude ?? null,
        home_longitude: point?.longitude ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id)
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;

      if (!updatedProfile) {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          ...payload,
        });
        if (insertError) throw insertError;
      }
      await refreshProfile();
      if (point) Alert.alert("저장 완료", "출발지 정보가 저장되었습니다.");
      else
        Alert.alert(
          "주소 저장 완료",
          "주소는 저장했지만 좌표를 찾지 못했습니다. 카카오 REST API 키 또는 더 자세한 주소를 확인해주세요.",
        );
    } catch (e: unknown) {
      Alert.alert(
        "오류",
        e instanceof Error ? e.message : "출발지 저장에 실패했습니다.",
      );
    } finally {
      setSavingHome(false);
    }
  }

  function handleChangeDistance(key: ClubDistanceKey, value: string) {
    setDistanceForm((prev) => ({
      ...prev,
      [key]: value.replace(/[^0-9]/g, ""),
    }));
  }

  async function handleSaveDistances() {
    if (!user) return;

    const payload: Record<string, number | string> = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    for (const field of CLUB_DISTANCE_FIELDS) {
      payload[field.key] = normalizeDistanceValue(
        distanceForm[field.key],
        DEFAULT_DISTANCE_VALUES[field.key],
      );
    }

    setSavingDistances(true);
    try {
      const { error } = await supabase
        .from("user_distance_profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      const nextForm = { ...DEFAULT_DISTANCE_FORM };
      CLUB_DISTANCE_FIELDS.forEach((field) => {
        nextForm[field.key] = String(payload[field.key]);
      });
      setDistanceForm(nextForm);
      Alert.alert("저장 완료", "클럽별 거리 정보가 저장되었습니다.");
    } catch (e: unknown) {
      Alert.alert(
        "오류",
        e instanceof Error ? e.message : "클럽 거리 저장에 실패했습니다.",
      );
    } finally {
      setSavingDistances(false);
    }
  }

  async function handleChangePassword() {
    if (newPw.length < 6) {
      Alert.alert("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert("비밀번호가 일치하지 않습니다.");
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setShowPwModal(false);
      setNewPw("");
      setConfirmPw("");
      Alert.alert("비밀번호가 변경되었습니다.");
    } catch (e: unknown) {
      Alert.alert("오류", e instanceof Error ? e.message : String(e));
    } finally {
      setSavingPw(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut({ scope: "local" });
    if (Platform.OS === "web") window.location.href = "/";
  }

  return (
    <View style={p.screen}>
      {pendingPhotoCrop && (
        <ImageCropModal
          uri={pendingPhotoCrop.uri}
          width={pendingPhotoCrop.width}
          height={pendingPhotoCrop.height}
          aspect={[1, 1]}
          title="프로필 사진 자르기"
          onCancel={() => setPendingPhotoCrop(null)}
          onConfirm={handleSaveCroppedPhoto}
        />
      )}
      {showAvatarOptions && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setShowAvatarOptions(false)}
        >
          <TouchableOpacity
            style={p.overlay}
            activeOpacity={1}
            onPress={() => setShowAvatarOptions(false)}
          >
            <TouchableOpacity
              style={p.avatarOptionsCard}
              activeOpacity={1}
              onPress={() => {}}
            >
              <Text style={p.avatarOptionsTitle}>프로필 이미지 변경</Text>
              <TouchableOpacity
                style={p.avatarOption}
                onPress={() => handlePickPhoto("camera")}
              >
                <Text style={p.avatarOptionIcon}>📷</Text>
                <View>
                  <Text style={p.avatarOptionText}>카메라로 촬영</Text>
                  <Text style={p.avatarOptionSub}>
                    1:1 비율로 자동 크롭됩니다
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={p.menuDivider} />
              <TouchableOpacity
                style={p.avatarOption}
                onPress={() => handlePickPhoto("gallery")}
              >
                <Text style={p.avatarOptionIcon}>🖼️</Text>
                <View>
                  <Text style={p.avatarOptionText}>갤러리에서 사진 선택</Text>
                  <Text style={p.avatarOptionSub}>
                    1:1 비율로 자동 크롭됩니다
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={p.menuDivider} />
              <TouchableOpacity
                style={p.avatarOption}
                onPress={() => {
                  setShowAvatarOptions(false);
                  setShowProfileIconPicker(true);
                }}
              >
                <Text style={p.avatarOptionIcon}>😊</Text>
                <View>
                  <Text style={p.avatarOptionText}>이모지로 선택</Text>
                  <Text style={p.avatarOptionSub}>
                    간단한 아이콘으로 표시합니다
                  </Text>
                </View>
              </TouchableOpacity>
              {(avatarUrl || profileIcon) && (
                <>
                  <View style={p.menuDivider} />
                  <TouchableOpacity
                    style={p.avatarOption}
                    onPress={handleClearAvatar}
                  >
                    <Text style={p.avatarOptionIcon}>🗑️</Text>
                    <Text style={[p.avatarOptionText, { color: C.danger }]}>
                      기본 이미지로 초기화
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={p.cancelButton}
                onPress={() => setShowAvatarOptions(false)}
              >
                <Text style={p.cancelButtonText}>취소</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {showProfileIconPicker && (
        <EmojiPicker
          emojis={PROFILE_EMOJIS}
          selected={profileIcon}
          onSelect={handleSelectProfileIcon}
          onClose={() => setShowProfileIconPicker(false)}
        />
      )}

      {showPwModal && (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setShowPwModal(false)}
        >
          <TouchableOpacity
            style={p.overlay}
            activeOpacity={1}
            onPress={() => setShowPwModal(false)}
          >
            <TouchableOpacity
              style={p.modalCard}
              activeOpacity={1}
              onPress={() => {}}
            >
              <View style={p.modalHeader}>
                <Text style={p.modalTitle}>비밀번호 변경</Text>
                <TouchableOpacity onPress={() => setShowPwModal(false)}>
                  <Text style={p.modalClose}>닫기</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={p.modalInput}
                value={newPw}
                onChangeText={setNewPw}
                placeholder="새 비밀번호 (6자 이상)"
                secureTextEntry
                placeholderTextColor={C.muted}
              />
              <TextInput
                style={p.modalInput}
                value={confirmPw}
                onChangeText={setConfirmPw}
                placeholder="새 비밀번호 확인"
                secureTextEntry
                placeholderTextColor={C.muted}
              />
              <TouchableOpacity
                style={[p.modalBtn, savingPw && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={savingPw}
              >
                {savingPw ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={p.modalBtnText}>변경하기</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <KakaoAddressSearchModal
        visible={showAddressSearch}
        initialQuery={homeAddress}
        onSelect={handleSelectAddressResult}
        onClose={() => setShowAddressSearch(false)}
      />
      <ScrollView contentContainerStyle={p.content}>
        <View style={p.profileSection}>
          <TouchableOpacity
            onPress={() => setShowAvatarOptions(true)}
            style={p.avatarWrap}
          >
            <View style={p.avatar}>
              {uploadingPhoto ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={p.avatarImage} />
              ) : profileIcon ? (
                <Text style={p.avatarEmoji}>{profileIcon}</Text>
              ) : (
                <Text style={p.avatarInitial}>{userInitial}</Text>
              )}
            </View>
            <View style={p.avatarEditBadge}>
              <EmojiIcon char="✏️" size={11} color={C.text} />
            </View>
          </TouchableOpacity>

          <View style={p.nameArea}>
            {editingName ? (
              <>
                <TextInput
                  style={p.nameInput}
                  value={editNameVal}
                  onChangeText={setEditNameVal}
                  autoFocus
                  maxLength={20}
                  placeholder="닉네임"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                />
                <View style={p.nameActions}>
                  <TouchableOpacity
                    style={[p.nameSaveBtn, savingName && { opacity: 0.6 }]}
                    onPress={handleSaveName}
                    disabled={savingName}
                  >
                    {savingName ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={p.nameSaveBtnText}>저장</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingName(false)}>
                    <Text style={p.nameCancelText}>취소</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={p.profileName}>{userName || "닉네임 없음"}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditNameVal(userName);
                    setEditingName(true);
                  }}
                >
                  <Text style={p.profileEditHint}>닉네임 수정</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <Text style={p.sectionLabel}>출발지 설정</Text>
        <View style={p.settingsCard}>
          <View style={p.settingHeaderRow}>
            <View>
              <Text style={p.settingTitle}>🏠 집 주소</Text>
              <Text style={p.settingHint}>
                카카오 주소 검색으로 선택한 주소가 골프장 이동시간 계산에 사용됩니다.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => setShowAddressSearch(true)}
            style={p.addressPickerButton}
          >
            <Text
              style={[p.addressPickerText, !homeAddress && { color: C.muted }]}
              numberOfLines={2}
            >
              {homeAddress || "카카오 주소 검색으로 집 주소를 선택하세요"}
            </Text>
            <Text style={p.addressPickerAction}>검색</Text>
          </TouchableOpacity>
          <View style={p.bufferRow}>
            <View>
              <Text style={p.bufferTitle}>🚗 출발 준비시간</Text>
              <Text style={p.settingHint}>
                현재 Sprint에서는 40분으로 고정합니다.
              </Text>
            </View>
            <View style={p.bufferPill}>
              <Text style={p.bufferPillText}>{departureBufferMinutes}분</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[p.homeSaveButton, savingHome && { opacity: 0.6 }]}
            onPress={handleSaveHome}
            disabled={savingHome}
          >
            {savingHome ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={p.homeSaveButtonText}>출발지 저장</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={p.sectionLabel}>클럽별 평균거리</Text>
        <View style={p.settingsCard}>
          <Text style={p.settingHint}>
            AI 캐디의 클럽 추천과 Shot Plan 계산에 사용됩니다. 단위는 m입니다.
          </Text>
          <View style={p.distanceGrid}>
            {CLUB_DISTANCE_FIELDS.map((field) => (
              <View key={field.key} style={p.distanceItem}>
                <Text style={p.distanceLabel}>{field.label}</Text>
                <TextInput
                  style={p.distanceInput}
                  value={distanceForm[field.key]}
                  onChangeText={(value) =>
                    handleChangeDistance(field.key, value)
                  }
                  placeholder="0"
                  placeholderTextColor={C.muted}
                  keyboardType="number-pad"
                />
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[p.homeSaveButton, savingDistances && { opacity: 0.6 }]}
            onPress={handleSaveDistances}
            disabled={savingDistances}
          >
            {savingDistances ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={p.homeSaveButtonText}>클럽 거리 저장</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={p.sectionLabel}>디자인 스킨</Text>
        <View style={p.skinGrid}>
          {skins.map((item) => {
            const active = item.id === skinId;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  p.skinCard,
                  {
                    borderColor: active ? palette.green : palette.border,
                    backgroundColor: palette.card,
                    borderRadius: palette.cardRadius,
                  },
                  active && { backgroundColor: palette.greenLight },
                ]}
                onPress={() => setSkinId(item.id as SkinId)}
                activeOpacity={0.82}
              >
                <View style={p.skinSwatches}>
                  <View
                    style={[
                      p.skinSwatch,
                      { backgroundColor: item.palette.headerBg },
                    ]}
                  />
                  <View
                    style={[
                      p.skinSwatch,
                      { backgroundColor: item.palette.accent },
                    ]}
                  />
                  <View
                    style={[p.skinSwatch, { backgroundColor: item.palette.bg }]}
                  />
                </View>
                <Text style={[p.skinName, { color: palette.text }]}>
                  {item.name}
                </Text>
                <Text
                  style={[p.skinDesc, { color: palette.muted }]}
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
                {active && (
                  <Text style={[p.skinActiveText, { color: palette.green }]}>
                    적용중
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={p.sectionLabel}>계정</Text>
        <View style={p.menuCard}>
          <TouchableOpacity
            style={p.menuRow}
            onPress={() => setShowPwModal(true)}
          >
            <Text style={p.menuIcon}>🔑</Text>
            <Text style={p.menuText}>비밀번호 변경</Text>
            <Text style={p.menuArrow}>›</Text>
          </TouchableOpacity>
          <View style={p.menuDivider} />
          <TouchableOpacity style={p.menuRow} onPress={handleLogout}>
            <View style={[p.menuIcon, p.centerIcon]}>
              <EmojiIcon char="🚪" size={17} color={C.danger} />
            </View>
            <Text style={[p.menuText, { color: C.danger }]}>로그아웃</Text>
            <Text style={p.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={p.version}>GogoPar v1.0</Text>
      </ScrollView>
    </View>
  );
}

const p = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f4f6" },
  content: { paddingBottom: 40 },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: C.greenDark,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  avatarEmoji: { fontSize: 30 },
  avatarInitial: { fontSize: 26, fontWeight: "900", color: "#fff" },
  avatarEditBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: C.greenDark,
  },
  nameArea: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: "800", color: "#fff" },
  profileEditHint: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    borderBottomWidth: 1.5,
    borderBottomColor: "rgba(255,255,255,0.5)",
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  nameActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  nameSaveBtn: {
    backgroundColor: C.gold,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  nameSaveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  nameCancelText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.muted,
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  settingsCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginHorizontal: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  settingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  settingTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  settingHint: { fontSize: 11, lineHeight: 15, color: C.muted, marginTop: 3 },
  settingInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: C.text,
    backgroundColor: "#fafafa",
    minHeight: 44,
  },
  addressPickerButton: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: "#fafafa",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addressPickerText: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  addressPickerAction: {
    color: C.green,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  bufferRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginTop: 14,
    paddingTop: 14,
  },
  bufferTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  bufferPill: {
    backgroundColor: C.greenLight,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  bufferPillText: { color: C.green, fontSize: 13, fontWeight: "900" },
  homeSaveButton: {
    backgroundColor: C.green,
    borderRadius: 50,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 14,
  },
  homeSaveButtonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  distanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  distanceItem: { width: "31.5%" },
  distanceLabel: {
    color: C.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    marginBottom: 5,
  },
  distanceInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: C.text,
    backgroundColor: "#fafafa",
    textAlign: "center",
    fontWeight: "800",
  },
  skinGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
  },
  skinCard: { width: "48%", borderWidth: 1.5, padding: 12, minHeight: 118 },
  skinSwatches: { flexDirection: "row", gap: 5, marginBottom: 10 },
  skinSwatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  skinName: { fontSize: 14, fontWeight: "800", marginBottom: 4 },
  skinDesc: { fontSize: 11, lineHeight: 15 },
  skinActiveText: { fontSize: 11, fontWeight: "800", marginTop: 8 },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 4,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 12,
  },
  menuIcon: { fontSize: 18, width: 26, textAlign: "center" },
  centerIcon: { alignItems: "center" },
  menuText: { flex: 1, fontSize: 15, color: C.text, fontWeight: "500" },
  menuArrow: { fontSize: 16, color: C.muted },
  menuDivider: { height: 1, backgroundColor: C.border, marginLeft: 54 },
  version: {
    textAlign: "center",
    color: C.muted,
    fontSize: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  avatarOptionsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 8,
    width: "100%",
    maxWidth: 380,
  },
  avatarOptionsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.muted,
    textAlign: "center",
    paddingVertical: 14,
    letterSpacing: 0.3,
  },
  avatarOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  avatarOptionIcon: { fontSize: 26, width: 36, textAlign: "center" },
  avatarOptionText: { fontSize: 15, fontWeight: "600", color: C.text },
  avatarOptionSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  cancelButton: { paddingVertical: 14, alignItems: "center" },
  cancelButtonText: { color: C.muted, fontSize: 14 },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 22,
    width: "100%",
    maxWidth: 380,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: C.text },
  modalClose: { color: C.muted, fontSize: 13 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
    marginBottom: 10,
    backgroundColor: "#fafafa",
  },
  modalBtn: {
    backgroundColor: C.green,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  addressModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  addressModalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 34,
    maxHeight: "82%",
  },
  addressModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  addressModalTitle: {
    flex: 1,
    color: C.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
  },
  addressModalClose: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  addressSearchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  addressSearchInput: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
    backgroundColor: "#fafafa",
  },
  addressSearchButton: {
    minWidth: 70,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
  },
  addressSearchButtonText: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  addressSearchError: {
    color: C.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 10,
  },
  addressResultList: { marginTop: 12 },
  addressResultItem: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  addressResultTitle: {
    color: C.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },
  addressResultSubtitle: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 3,
  },
});

const ep = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  title: { flex: 1, fontSize: 16, fontWeight: "800", color: C.text },
  closeBtn: {
    backgroundColor: C.green,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  closeBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  emojiBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  emojiBtnActive: { borderColor: C.green, backgroundColor: C.greenLight },
  emoji: { fontSize: 26 },
});
