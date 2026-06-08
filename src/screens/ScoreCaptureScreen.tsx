import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, Image, Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useState, useEffect } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { recognizeScorecard, mergeScorecards, type RecognizedScorecard } from '../features/ocr'
import { getClubMembers, getClubSettlement, saveClubSettlement, type SettlementConfig } from '../lib/store'
import { useAsync } from '../lib/useAsync'
import { useClub } from '../lib/ClubContext'
import { C } from '../theme'
import AppTabBar from '../components/AppTabBar'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

function totalScore(diffs: (number | null)[], pars: (number | null)[]): number {
  return diffs.reduce<number>((a, d, i) => a + (d == null ? 0 : (pars[i] ?? 4) + d), 0)
}

export default function ScoreCaptureScreen() {
  const nav = useNavigation<Nav>()
  const { activeClub } = useClub()
  const { data: members } = useAsync(
    () => activeClub ? getClubMembers(activeClub.id) : Promise.resolve([]),
    [activeClub?.id]
  )

  const [imageUris, setImageUris] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RecognizedScorecard | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // 정산 설정
  const [cardOpen, setCardOpen] = useState(false)
  const [settlementOn, setSettlementOn] = useState(false)
  const [participants, setParticipants] = useState<string[]>([])
  const [strokeFee, setStrokeFee] = useState(5000)
  const [birdieBonus, setBirdieBonus] = useState<5000 | 10000>(5000)

  // 클럽에 저장된 정산 설정 자동 로드 (먼저 설정 → 나중에 스코어 등록해도 적용)
  const { data: savedSettlement } = useAsync(
    () => activeClub ? getClubSettlement(activeClub.id) : Promise.resolve(null),
    [activeClub?.id]
  )
  useEffect(() => {
    if (savedSettlement) {
      setSettlementOn(true)
      setParticipants(savedSettlement.participants)
      setStrokeFee(savedSettlement.strokeFee)
      setBirdieBonus(savedSettlement.birdieBonus)
      setCardOpen(true)
    }
  }, [savedSettlement])

  // 변경 즉시 클럽 설정에 자동 저장 → 화면 나갔다 와도 상태 유지 (OFF는 null로 저장)
  async function persistSettlement(on: boolean, parts: string[], fee: number, bonus: 5000 | 10000) {
    if (!activeClub) return
    try {
      await saveClubSettlement(activeClub.id, on ? { participants: parts, strokeFee: fee, birdieBonus: bonus } : null)
    } catch {
      // 자동 저장 실패는 조용히 무시 (다음 변경 때 재시도)
    }
  }

  function handleToggleOn(next: boolean) {
    setSettlementOn(next)
    persistSettlement(next, participants, strokeFee, birdieBonus)
  }

  function toggleParticipant(name: string) {
    const next = participants.includes(name)
      ? participants.filter((n) => n !== name)
      : [...participants, name]
    setParticipants(next)
    persistSettlement(settlementOn, next, strokeFee, birdieBonus)
  }

  function buildSettlement(): SettlementConfig | undefined {
    if (!settlementOn || participants.length < 2) return undefined
    return { participants, strokeFee, birdieBonus }
  }

  async function runOCR(uris: string[]) {
    setBusy(true)
    setResult(null)
    setErrorMsg('')
    try {
      const cards = await Promise.all(uris.map((u) => recognizeScorecard(u)))
      setResult(mergeScorecards(cards))
    } catch (err) {
      setErrorMsg('인식 중 오류가 발생했습니다: ' + String(err))
    } finally {
      setBusy(false)
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.')
      return
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    })
    if (!res.canceled && res.assets.length > 0) {
      setImageUris((prev) => [...prev, ...res.assets.map((a) => a.uri)])
      setResult(null)
      setErrorMsg('')
    }
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsMultipleSelection: true,
    })
    if (!res.canceled && res.assets.length > 0) {
      setImageUris((prev) => [...prev, ...res.assets.map((a) => a.uri)])
      setResult(null)
      setErrorMsg('')
    }
  }

  function removePhoto(index: number) {
    setImageUris((prev) => prev.filter((_, i) => i !== index))
    setResult(null)
    setErrorMsg('')
  }

  function goReview(recognized?: RecognizedScorecard) {
    const settlement = buildSettlement()
    const ocrPlayers = recognized
      ? recognized.players.map((p, i) => ({
          name: p.name || `플레이어 ${i + 1}`,
          strokes: p.diffs.map((d, j) => (recognized.pars[j] ?? 4) + (d ?? 0)),
        }))
      : undefined
    nav.navigate('RoundSetup', { ocrPlayers, settlement })
  }


  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
      {/* 정산 설정 카드 */}
      <View style={s.card}>
        {/* 헤더 — 터치로 펼치기/접기 */}
        <TouchableOpacity
          style={[s.settleHeader, cardOpen && { marginBottom: 14 }]}
          onPress={() => setCardOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={[s.cardTitle, { marginBottom: 0 }]}>🏆 정산 설정</Text>
          {!cardOpen && (
            <View style={s.statusWrap}>
              <View style={[s.statusDot, settlementOn ? s.dotOn : s.dotOff]} />
              <Text style={s.muted}>
                {settlementOn ? `적용 중 · ${strokeFee.toLocaleString('ko-KR')}원` : '미적용'}
              </Text>
            </View>
          )}
          <Text style={s.muted}>{cardOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {cardOpen && (
          <>
            {/* 정산 적용 — 신호등 토글 */}
            <View style={s.onOffRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.settleLabel}>정산 적용</Text>
                <Text style={[{ fontSize: 12, fontWeight: '700' }, { color: settlementOn ? C.green : C.danger }]}>
                  {settlementOn ? '🟢 적용 중 · 자동 저장됨' : '🔴 미적용'}
                </Text>
              </View>
              <TouchableOpacity style={s.trafficLight} onPress={() => handleToggleOn(!settlementOn)} activeOpacity={0.8}>
                <View style={[s.lightDot, settlementOn ? s.redOff : s.redOn]} />
                <View style={[s.lightDot, settlementOn ? s.greenOn : s.greenOff]} />
              </TouchableOpacity>
            </View>

            {settlementOn && (
              <>
                {/* 참가 선수 */}
                <Text style={s.settleLabel}>참가 선수</Text>
                {(!members || members.length === 0) ? (
                  <Text style={s.muted}>클럽 멤버가 없습니다. 라운드 저장 후 참가자를 확인하세요.</Text>
                ) : (
                  <View style={s.chipRow}>
                    {members.map((m) => {
                      const on = participants.includes(m.name)
                      return (
                        <TouchableOpacity
                          key={m.userId}
                          style={[s.chip, on && s.chipOn]}
                          onPress={() => toggleParticipant(m.name)}
                        >
                          <Text style={[s.chipText, on && s.chipTextOn]}>{m.name}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
                {participants.length < 2 && (
                  <Text style={[s.muted, { marginTop: 4, color: C.warn }]}>2명 이상 선택하세요</Text>
                )}

                {/* 타당 */}
                <Text style={[s.settleLabel, { marginTop: 14 }]}>타당 (1타 단가)</Text>
                <View style={s.shuttleRow}>
                  <TouchableOpacity
                    style={s.shuttleBtn}
                    onPress={() => { const next = Math.max(1000, strokeFee - 1000); setStrokeFee(next); persistSettlement(settlementOn, participants, next, birdieBonus) }}
                  >
                    <Text style={s.shuttleBtnText}>◀</Text>
                  </TouchableOpacity>
                  <Text style={s.shuttleVal}>{strokeFee.toLocaleString('ko-KR')}원</Text>
                  <TouchableOpacity
                    style={s.shuttleBtn}
                    onPress={() => { const next = Math.min(20000, strokeFee + 1000); setStrokeFee(next); persistSettlement(settlementOn, participants, next, birdieBonus) }}
                  >
                    <Text style={s.shuttleBtnText}>▶</Text>
                  </TouchableOpacity>
                </View>

                {/* 버디 보너스 */}
                <Text style={[s.settleLabel, { marginTop: 14 }]}>버디 보너스</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  {([5000, 10000] as const).map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[s.bonusBtn, birdieBonus === v && s.bonusBtnOn]}
                      onPress={() => { setBirdieBonus(v); persistSettlement(settlementOn, participants, strokeFee, v) }}
                    >
                      <Text style={[s.bonusText, birdieBonus === v && s.bonusTextOn]}>
                        {v.toLocaleString('ko-KR')}원
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 배판 안내 */}
                <Text style={[s.muted, { marginTop: 12, lineHeight: 18 }]}>
                  배판 (×2): 파3 더블↑ · 파4↑ 트리플↑ · 동타 2명↑
                </Text>

                {/* 자동 저장 안내 */}
                <Text style={[s.muted, { marginTop: 14, fontSize: 12, textAlign: 'center', lineHeight: 18 }]}>
                  변경하면 자동으로 저장돼요.{'\n'}게임 후 스코어 등록 시 이 설정이 자동 적용됩니다.
                </Text>
              </>
            )}
          </>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>스코어카드 사진</Text>
        <Text style={s.desc}>
          Claude가 플레이어 이름과 홀별 타수를 읽어옵니다.{'\n'}
          • 전반/후반 나눠 찍어도 홀 번호로 자동 합산{'\n'}
          • 2팀(8명)도 사진 4장 한 번에 선택 가능{'\n'}
          다음 화면에서 이름·스코어 확인·보정 후 저장하세요.
        </Text>

        {/* 촬영/선택 버튼 */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={takePhoto} disabled={busy}>
            <Text style={s.btnText}>📷 사진 찍기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnSecondary, { flex: 1 }]} onPress={pickFromLibrary} disabled={busy}>
            <Text style={s.btnSecondaryText}>🖼️ 갤러리</Text>
          </TouchableOpacity>
        </View>

        {/* 선택된 사진 목록 */}
        {imageUris.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={[s.muted, { marginBottom: 8 }]}>선택된 사진 {imageUris.length}장</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {imageUris.map((uri, i) => (
                <View key={i} style={s.thumbWrap}>
                  <Image source={{ uri }} style={s.thumb} resizeMode="cover" />
                  <TouchableOpacity style={s.removeBtn} onPress={() => removePhoto(i)}>
                    <Text style={s.removeBtnText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {/* 인식 시작 버튼 */}
            <TouchableOpacity
              style={[s.btn, { marginTop: 14 }, busy && { opacity: 0.6 }]}
              onPress={() => runOCR(imageUris)}
              disabled={busy}
            >
              <Text style={s.btnText}>
                {busy ? '인식 중...' : `🔍 ${imageUris.length}장 인식 시작`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {errorMsg !== '' && (
          <Text style={[s.muted, { marginTop: 12, color: '#c0392b' }]}>{errorMsg}</Text>
        )}

        {result && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontWeight: '700', color: C.text, marginBottom: 8 }}>
              인식 결과 ({result.players.length}명)
            </Text>
            {result.players.length === 0 ? (
              <Text style={s.muted}>플레이어를 찾지 못했습니다. 직접 입력하세요.</Text>
            ) : (
              <>
                {result.players.length >= 8 && (
                  <View style={s.warnBox}>
                    <Text style={s.warnText}>
                      ⚠️ {result.players.length}명 인식됨. 이름이 다르게 읽혀 중복된 경우 다음 화면에서 이름을 수정하거나 × 버튼으로 삭제하세요.
                    </Text>
                  </View>
                )}
                <View style={s.tableHeader}>
                  <Text style={[s.th, { flex: 2 }]}>플레이어</Text>
                  <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>총타수</Text>
                </View>
                {result.players.map((p, i) => (
                  <View key={i} style={s.tableRow}>
                    <Text style={[s.td, { flex: 2 }]}>{p.name || `플레이어 ${i + 1}`}</Text>
                    <Text style={[s.td, { flex: 1, textAlign: 'right', fontWeight: '600' }]}>
                      {totalScore(p.diffs, result.pars)}
                    </Text>
                  </View>
                ))}
              </>
            )}
            <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={() => goReview(result)}>
              <Text style={s.btnText}>확인 / 보정하기</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>또는 수동 입력</Text>
        <Text style={s.desc}>홀별 타수를 직접 입력합니다.</Text>
        <TouchableOpacity style={[s.btnSecondary, { marginTop: 10 }]} onPress={() => goReview()}>
          <Text style={s.btnSecondaryText}>입력 화면으로</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    <AppTabBar />
    </View>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 8 },
  desc: { fontSize: 13, color: C.muted, lineHeight: 19 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 100, height: 100, borderRadius: 10, backgroundColor: C.greenLight },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  btn: { backgroundColor: C.green, borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnSecondary: { backgroundColor: C.greenLight, borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  btnSecondaryText: { color: C.green, fontWeight: '600', fontSize: 14 },
  muted: { fontSize: 13, color: C.muted },
  settleHeader: { flexDirection: 'row', alignItems: 'center' },
  onOffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  settleLabel: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 },
  toggleBtn: { backgroundColor: C.greenLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  toggleBtnOn: { backgroundColor: C.green },
  toggleText: { fontSize: 12, fontWeight: '700', color: C.muted },
  toggleTextOn: { color: '#fff' },
  // 신호등 표시
  statusWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginRight: 8 },
  statusDot: { width: 11, height: 11, borderRadius: 6 },
  dotOn: { backgroundColor: '#2ecc71' },
  dotOff: { backgroundColor: '#e74c3c' },
  trafficLight: { width: 56, height: 32, borderRadius: 9, backgroundColor: '#2b2b2b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 6 },
  lightDot: { width: 18, height: 18, borderRadius: 9 },
  redOn: { backgroundColor: '#e74c3c' },
  redOff: { backgroundColor: '#4a2420' },
  greenOn: { backgroundColor: '#2ecc71' },
  greenOff: { backgroundColor: '#1f3d2b' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chip: { borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { borderColor: C.green, backgroundColor: C.greenLight },
  chipText: { fontSize: 13, color: C.muted, fontWeight: '500' },
  chipTextOn: { color: C.green, fontWeight: '700' },
  shuttleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  shuttleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  shuttleBtnText: { color: C.green, fontWeight: '700', fontSize: 14 },
  shuttleVal: { fontSize: 16, fontWeight: '700', color: C.text, minWidth: 100, textAlign: 'center' },
  bonusBtn: { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  bonusBtnOn: { borderColor: C.green, backgroundColor: C.greenLight },
  bonusText: { fontSize: 14, fontWeight: '600', color: C.muted },
  bonusTextOn: { color: C.green },
  warnBox: { backgroundColor: '#fff8e1', borderRadius: 10, padding: 10, marginBottom: 10 },
  warnText: { fontSize: 12, color: '#b8860b', lineHeight: 18 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { fontSize: 12, color: C.muted, fontWeight: '600' },
  td: { fontSize: 14, color: C.text },
})
