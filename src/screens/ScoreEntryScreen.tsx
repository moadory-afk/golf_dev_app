import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Platform,
  Modal, ScrollView, Image, ActivityIndicator,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { saveRound, updateRound, createRoundDraft, completeRound, deleteRound, shortName } from '../lib/store'
import { calcSettlement, holeStrokeNetForPlayer, holeBonusNetForPlayer, fmtKRW } from '../features/settlement'
import { recognizeScorecard, mergeScorecards, type RecognizedScorecard } from '../features/ocr'
import { findBestOcrMatch } from '../lib/nameMatch'
import { useClub } from '../lib/ClubContext'
import { C } from '../theme'
import type { RootStackProps } from '../navigation/types'

type Nav = RootStackProps<'ScoreEntry'>['navigation']

function scoreLabel(strokes: number, par: number): { text: string; color: string } {
  const d = strokes - par
  if (d <= -2) return { text: '🦅 이글', color: C.eagle }
  if (d === -1) return { text: '🐦 버디', color: C.info }
  if (d === 0)  return { text: 'E 파',    color: C.muted }
  if (d === 1)  return { text: '+1 보기', color: C.warn }
  if (d === 2)  return { text: '+2 더블', color: C.danger }
  if (d === 3)  return { text: '+3 트리플', color: C.danger }
  return { text: `+${d}`, color: C.danger }
}

export default function ScoreEntryScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<RootStackProps<'ScoreEntry'>['route']>()
  const { date, courseName, pars, golfCourseId, players: initPlayers, editId, settlement, holeLabels, photoUris: initPhotoUris } = route.params
  const holeLabel = (i: number) => holeLabels?.[i] ?? `${i + 1}홀`

  const [hole, setHole] = useState(0)
  const [players, setPlayers] = useState(() =>
    initPlayers.map((p) => ({
      ...p,
      strokes: p.strokes.length === 18 ? [...p.strokes] : pars.map((par) => par),
    }))
  )
  const [saving, setSaving] = useState(false)
  const { activeClub } = useClub()

  // 자동저장
  const roundIdRef = useRef<string | null>(editId ?? null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMounted = useRef(false)

  useEffect(() => {
    if (editId) return
    createRoundDraft({
      courseName, date, pars,
      players: players.map((p) => ({ name: p.name, strokes: p.strokes })),
      golfCourseId, settlement, clubId: activeClub?.id,
    }).then((saved) => {
      roundIdRef.current = saved.id
      setAutoSaveStatus('saved')
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setAutoSaveStatus('saving')
    saveTimerRef.current = setTimeout(async () => {
      const id = roundIdRef.current
      if (!id) { setAutoSaveStatus('idle'); return }
      try {
        await updateRound(id, {
          courseName, date, pars,
          players: players.map((p) => ({ name: p.name, strokes: p.strokes })),
          golfCourseId, settlement,
        })
        setAutoSaveStatus('saved')
      } catch { setAutoSaveStatus('error') }
    }, 800)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [players]) // eslint-disable-line react-hooks/exhaustive-deps

  // 사진 업로드 모달
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [photoUris, setPhotoUris] = useState<string[]>(() => initPhotoUris ?? [])
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrResult, setOcrResult] = useState<RecognizedScorecard | null>(null)
  const [ocrError, setOcrError] = useState('')

  // 헤더에 📷 + 닫기 버튼 설정
  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 12 }}>
          <TouchableOpacity
            style={hdrStyles.cameraBtn}
            onPress={() => setShowPhotoModal(true)}
          >
            <Text style={{ fontSize: 15 }}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={hdrStyles.closeBtn}
            onPress={() => nav.navigate('Main', { screen: 'History' })}
          >
            <Text style={hdrStyles.closeBtnText}>닫기</Text>
          </TouchableOpacity>
        </View>
      ),
    })
  }, [nav])

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.'); return }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 })
    if (!res.canceled && res.assets.length > 0) {
      setPhotoUris((p) => [...p, ...res.assets.map((a) => a.uri)])
      setOcrResult(null); setOcrError('')
    }
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.'); return }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9, allowsMultipleSelection: true,
    })
    if (!res.canceled && res.assets.length > 0) {
      setPhotoUris((p) => [...p, ...res.assets.map((a) => a.uri)])
      setOcrResult(null); setOcrError('')
    }
  }

  async function runOCR() {
    setOcrBusy(true); setOcrResult(null); setOcrError('')
    try {
      const cards = await Promise.all(photoUris.map((u) => recognizeScorecard(u)))
      const frontCourseName = holeLabels?.[0]?.replace(/\d+$/, '')
      const backCourseName = holeLabels?.[9]?.replace(/\d+$/, '')
      setOcrResult(mergeScorecards(cards, frontCourseName, backCourseName))
    } catch (err) {
      setOcrError('인식 오류: ' + String(err))
    } finally { setOcrBusy(false) }
  }

  function applyOcr() {
    if (!ocrResult) return
    const ocrNames = ocrResult.players.map((p) => p.name)
    const used = new Set<number>()

    setPlayers((prev) =>
      prev.map((p) => {
        const idx = findBestOcrMatch(p.name, ocrNames, used)
        if (idx < 0) return p
        used.add(idx)
        const op = ocrResult.players[idx]
        const newStrokes = [...p.strokes]
        op.diffs.forEach((d, i) => {
          if (d !== null) newStrokes[i] = Math.max(1, pars[i] + d)
        })
        return { ...p, strokes: newStrokes }
      })
    )
    setShowPhotoModal(false)
    setOcrResult(null); setOcrError('')
  }

  const par = pars[hole]

  function changeScore(pi: number, delta: number) {
    setPlayers((prev) =>
      prev.map((p, i) => {
        if (i !== pi) return p
        const newStrokes = [...p.strokes]
        newStrokes[hole] = Math.max(1, p.strokes[hole] + delta)
        return { ...p, strokes: newStrokes }
      })
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      // 사진 압축 → base64 (실패한 장은 건너뜀)
      const photoData: string[] = []
      for (const uri of photoUris) {
        try {
          const res = await manipulateAsync(
            uri, [{ resize: { width: 800 } }],
            { compress: 0.6, format: SaveFormat.JPEG, base64: true },
          )
          if (res.base64) photoData.push(`data:image/jpeg;base64,${res.base64}`)
        } catch { /* ignore */ }
      }

      const id = roundIdRef.current
      if (id) {
        await updateRound(id, {
          courseName, date, pars,
          players: players.map((p) => ({ name: p.name, strokes: p.strokes })),
          golfCourseId, settlement,
          photoData: photoData.length > 0 ? photoData : undefined,
        })
        await completeRound(id)
        nav.navigate('RoundDetail', { id })
      } else {
        const input = {
          courseName, date, pars,
          players: players.map((p) => ({ name: p.name, strokes: p.strokes })),
          golfCourseId, settlement, clubId: activeClub?.id,
          photoData: photoData.length > 0 ? photoData : undefined,
        }
        const saved = editId ? await updateRound(editId, input) : await saveRound(input)
        await completeRound(saved.id)
        nav.navigate('RoundDetail', { id: saved.id })
      }
    } catch (err) {
      Alert.alert('저장 실패', err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  function confirmDelete() {
    const doDelete = async () => {
      const id = roundIdRef.current ?? editId
      if (id) {
        try { await deleteRound(id) } catch { /* ignore */ }
      }
      nav.navigate('Main', { screen: 'History' })
    }
    if (Platform.OS === 'web') {
      if (confirm('이 라운드를 삭제하시겠습니까?')) doDelete()
    } else {
      Alert.alert('라운드 삭제', '기록이 삭제됩니다. 계속할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: doDelete },
      ])
    }
  }

  function confirmSave() {
    if (Platform.OS === 'web') {
      if (confirm('라운드를 저장하시겠습니까?')) handleSave()
    } else {
      Alert.alert('저장', '이 라운드를 저장하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        { text: '저장', onPress: handleSave },
      ])
    }
  }

  // 정산 계산
  const settlementResult = settlement
    ? calcSettlement(settlement, pars, players.map((p) => ({ name: p.name, strokes: p.strokes })))
    : null
  const holeResult = settlementResult?.holes[hole] ?? null

  // 인원수에 따라 열 수 및 카드 크기 결정
  const COLS = players.length <= 4 ? 2 : players.length <= 6 ? 3 : 4
  const CARD = COLS === 2
    ? { name: 15, num: 28, btn: 34, gap: 8, pad: 12, labelSize: 10 }
    : COLS === 3
    ? { name: 13, num: 22, btn: 30, gap: 6, pad: 8,  labelSize: 9 }
    : { name: 11, num: 18, btn: 26, gap: 4, pad: 6,  labelSize: 8 }
  const playerRows: typeof players[] = []
  for (let i = 0; i < players.length; i += COLS) playerRows.push(players.slice(i, i + COLS))

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* 사진 업로드 모달 */}
      <Modal visible={showPhotoModal} animationType="slide" transparent onRequestClose={() => setShowPhotoModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>📷 스코어카드 인식</Text>
              <TouchableOpacity onPress={() => { setShowPhotoModal(false); setPhotoUris([]); setOcrResult(null); setOcrError('') }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.modalSub}>미입력 홀(파 기본값)만 인식 결과로 채웁니다.</Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[s.photoBtn, { flex: 1 }]} onPress={takePhoto} disabled={ocrBusy}>
                <Text style={s.photoBtnText}>📷 사진 찍기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.photoBtn, { flex: 1 }]} onPress={pickPhoto} disabled={ocrBusy}>
                <Text style={s.photoBtnText}>🖼️ 갤러리</Text>
              </TouchableOpacity>
            </View>

            {photoUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8 }}>
                {photoUris.map((uri, i) => (
                  <View key={i} style={s.thumbWrap}>
                    <Image source={{ uri }} style={s.thumb} resizeMode="cover" />
                    <TouchableOpacity
                      style={s.removeThumb}
                      onPress={() => { setPhotoUris((p) => p.filter((_, j) => j !== i)); setOcrResult(null) }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 16 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {photoUris.length > 0 && !ocrResult && (
              <TouchableOpacity style={[s.ocrBtn, ocrBusy && { opacity: 0.6 }]} onPress={runOCR} disabled={ocrBusy}>
                {ocrBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.ocrBtnText}>🔍 {photoUris.length}장 인식 시작</Text>}
              </TouchableOpacity>
            )}

            {ocrError !== '' && <Text style={{ marginTop: 8, color: C.danger, fontSize: 13 }}>{ocrError}</Text>}

            {ocrResult && (
              <View style={s.ocrResult}>
                <Text style={s.ocrResultTitle}>인식 결과</Text>
                {ocrResult.players.map((p, i) => {
                  const total = p.diffs.reduce<number>((a, d, j) => a + pars[j] + (d ?? 0), 0)
                  return (
                    <View key={i} style={s.ocrRow}>
                      <Text style={s.ocrName}>{p.name || `플레이어 ${i + 1}`}</Text>
                      <Text style={s.ocrTotal}>{total}타</Text>
                    </View>
                  )
                })}
                <TouchableOpacity style={s.applyBtn} onPress={applyOcr}>
                  <Text style={s.applyBtnText}>✓ 미입력 홀에 적용</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 콘텐츠 영역 — flex:1로 네비 하단 고정 */}
      <View style={{ flex: 1 }}>

      {/* 선수 카드 — 인원수 가변 그리드 */}
      <View style={[s.playersArea, { padding: CARD.gap }]}>
        {playerRows.map((row, ri) => (
          <View key={ri} style={[s.playerRow, { gap: CARD.gap, marginBottom: CARD.gap }]}>
            {row.map((p, ci) => {
              const pi = ri * COLS + ci
              const strokes = p.strokes[hole]
              const { text, color } = scoreLabel(strokes, par)
              return (
                <View key={p.name} style={[s.playerCard, { paddingVertical: CARD.pad, paddingHorizontal: CARD.pad / 2 }]}>
                  <Text style={[s.playerName, { fontSize: CARD.name }]}>{shortName(p.name)}</Text>
                  <View style={[s.shuttle, { gap: CARD.gap / 2 }]}>
                    <TouchableOpacity
                      style={[s.shuttleBtn, { width: CARD.btn, height: CARD.btn, borderRadius: CARD.btn / 2 }]}
                      onPress={() => changeScore(pi, -1)}
                    >
                      <Text style={[s.shuttleIcon, { fontSize: CARD.labelSize + 2 }]}>▼</Text>
                    </TouchableOpacity>
                    <View style={[s.scoreBox, { width: CARD.btn + 4 }]}>
                      <Text style={[s.scoreNum, { fontSize: CARD.num, lineHeight: CARD.num + 4 }]}>{strokes}</Text>
                      <Text style={[s.scoreLabel, { fontSize: CARD.labelSize, color }]}>{text}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.shuttleBtn, { width: CARD.btn, height: CARD.btn, borderRadius: CARD.btn / 2 }]}
                      onPress={() => changeScore(pi, 1)}
                    >
                      <Text style={[s.shuttleIcon, { fontSize: CARD.labelSize + 2 }]}>▲</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
          </View>
        ))}
      </View>

      {/* 순위 */}
      <View style={s.rankCard}>
        <Text style={s.rankTitle}>순위  ({holeLabel(hole)}까지)</Text>
        <View style={s.rankRow}>
          {[...players]
            .map((p) => ({ name: p.name, total: p.strokes.slice(0, hole + 1).reduce((a, b) => a + b, 0) }))
            .sort((a, b) => a.total - b.total)
            .map((r, i) => (
              <View key={r.name} style={s.rankItem}>
                <Text style={s.rankPos}>{i + 1}</Text>
                <Text style={s.rankName}>{shortName(r.name)}</Text>
                <Text style={s.rankTotal}>{r.total}</Text>
              </View>
            ))}
        </View>
      </View>

      {/* 홀 정산 */}
      {holeResult && settlement && (
        <View style={s.settlementCard}>
          <Text style={s.settlementTitle}>
            💰 {hole + 1}홀 {holeResult.isBaepan ? '배판' : '호판'}  타당 {fmtKRW(holeResult.holeFee)}
          </Text>
          <View style={s.settleLine}>
            <Text style={s.settleType}>타당</Text>
            <View style={s.settleAmounts}>
              {players.map((p) => {
                const net = holeStrokeNetForPlayer(holeResult, p.name)
                if (net === 0) return null
                return (
                  <Text key={p.name} style={[s.settleAmt, { color: net > 0 ? C.green : C.danger }]}>
                    {shortName(p.name)} {net > 0 ? `+${fmtKRW(net)}` : `-${fmtKRW(Math.abs(net))}`}
                  </Text>
                )
              })}
            </View>
          </View>
          <View style={s.settleLine}>
            <Text style={s.settleType}>보너스</Text>
            {holeResult.birdies.length === 0 ? (
              <Text style={s.settleNone}>🐦 없음</Text>
            ) : (
              <View style={s.settleAmounts}>
                {players.map((p) => {
                  const net = holeBonusNetForPlayer(holeResult, p.name)
                  if (net === 0) return null
                  return (
                    <Text key={p.name} style={[s.settleAmt, { color: net > 0 ? C.green : C.danger }]}>
                      {shortName(p.name)} {net > 0 ? `+${fmtKRW(net)}` : `-${fmtKRW(Math.abs(net))}`}
                    </Text>
                  )
                })}
              </View>
            )}
          </View>
        </View>
      )}

      </View>{/* 콘텐츠 영역 끝 */}

      {/* 하단 바: 삭제 | 종료 | 이전홀 | [홀정보] | 다음홀 */}
      <View style={s.bottomBar}>
        {/* 라운드 삭제 */}
        <TouchableOpacity style={s.barBtn} onPress={confirmDelete}>
          <Text style={s.barBtnIcon}>🗑</Text>
          <Text style={[s.barBtnText, { color: C.danger }]}>삭제</Text>
        </TouchableOpacity>

        {/* 라운드 종료 */}
        <TouchableOpacity style={s.barBtn} onPress={confirmSave} disabled={saving}>
          <Text style={s.barBtnIcon}>⏹</Text>
          <Text style={[s.barBtnText, { color: C.warn }]}>{saving ? '...' : '종료'}</Text>
        </TouchableOpacity>

        {/* 이전홀 */}
        <TouchableOpacity
          style={[s.barBtn, hole === 0 && { opacity: 0.3 }]}
          onPress={() => setHole((h) => Math.max(0, h - 1))}
          disabled={hole === 0}
        >
          <Text style={s.barBtnIcon}>◀</Text>
          <Text style={s.barBtnText}>이전홀</Text>
        </TouchableOpacity>

        {/* 홀 정보 */}
        <View style={s.holeInfo}>
          <Text style={s.holeInfoNum}>{holeLabel(hole)}  파{par}</Text>
          <Text style={s.holeInfoSub}>
            {hole + 1} / 18{'  '}
            {autoSaveStatus === 'saved' ? '✓저장됨' : autoSaveStatus === 'saving' ? '저장중...' : ''}
          </Text>
        </View>

        {/* 다음홀 */}
        <TouchableOpacity
          style={[s.barBtn, hole === 17 && { opacity: 0.3 }]}
          onPress={() => setHole((h) => Math.min(17, h + 1))}
          disabled={hole === 17}
        >
          <Text style={s.barBtnIcon}>▶</Text>
          <Text style={[s.barBtnText, { color: C.green }]}>다음홀</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// 네비게이션 헤더 버튼 스타일 (useLayoutEffect 내부에서 참조)
const hdrStyles = StyleSheet.create({
  cameraBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  closeBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
})

const s = StyleSheet.create({
  // 선수 그리드
  playersArea: { padding: 6 },
  playerRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  playerCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 4,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  playerName: { fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 4 },
  shuttle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shuttleBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  shuttleIcon: { fontSize: 11, color: C.green, fontWeight: '700' },
  scoreBox: { alignItems: 'center', width: 36 },
  scoreNum: { fontSize: 22, fontWeight: '900', color: C.text, lineHeight: 26 },
  scoreLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },

  // 정산 카드
  settlementCard: {
    marginHorizontal: 8, marginBottom: 6,
    backgroundColor: '#fffbe8', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: '#f0e090',
  },
  settlementTitle: { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 6 },
  settleLine: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 },
  settleType: { fontSize: 11, fontWeight: '700', color: C.muted, width: 40, paddingTop: 1 },
  settleAmounts: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  settleAmt: { fontSize: 12, fontWeight: '700' },
  settleNone: { fontSize: 12, color: C.muted },

  // 순위 카드
  rankCard: {
    marginHorizontal: 8, marginBottom: 6,
    backgroundColor: C.card, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12,
  },
  rankTitle: { fontSize: 10, fontWeight: '700', color: C.muted, marginBottom: 6 },
  rankRow: { flexDirection: 'row', justifyContent: 'space-around' },
  rankItem: { alignItems: 'center', gap: 2 },
  rankPos: { fontSize: 10, color: C.muted, fontWeight: '600' },
  rankName: { fontSize: 13, color: C.text, fontWeight: '700' },
  rankTotal: { fontSize: 12, color: C.green, fontWeight: '800' },

  // 하단 바
  bottomBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 4,
    backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border,
  },
  barBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  barBtnIcon: { fontSize: 16 },
  barBtnText: { fontSize: 11, fontWeight: '700', color: C.muted, marginTop: 2 },
  holeInfo: { flex: 1.6, alignItems: 'center' },
  holeInfoNum: { fontSize: 14, fontWeight: '800', color: C.text },
  holeInfoSub: { fontSize: 10, color: C.muted, marginTop: 2 },

  // 사진 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  modalClose: { fontSize: 20, color: C.muted, fontWeight: '600', padding: 4 },
  modalSub: { fontSize: 12, color: C.muted, marginTop: 4 },
  photoBtn: { backgroundColor: C.greenLight, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  photoBtnText: { color: C.green, fontWeight: '600', fontSize: 14 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: C.greenLight },
  removeThumb: {
    position: 'absolute', top: -5, right: -5, width: 18, height: 18,
    borderRadius: 9, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center',
  },
  ocrBtn: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  ocrBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ocrResult: { backgroundColor: '#f8fff8', borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: C.greenLight },
  ocrResultTitle: { fontSize: 13, fontWeight: '700', color: C.muted, marginBottom: 8 },
  ocrRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.border },
  ocrName: { fontSize: 14, color: C.text, fontWeight: '600' },
  ocrTotal: { fontSize: 14, color: C.green, fontWeight: '700' },
  applyBtn: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
