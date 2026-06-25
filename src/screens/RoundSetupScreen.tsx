import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, Modal } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useState, useEffect } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import {
  getGolfCourses, getCourseLayouts, getClubMembers, getClubSettlement, saveClubSettlement,
  saveRound,
  type GolfCourse, type CourseLayout, type SettlementConfig, type BaepanConditions,
} from '../lib/store'
import { recognizeScorecard, mergeScorecards, type RecognizedScorecard } from '../features/ocr'
import { findBestOcrMatch } from '../lib/nameMatch'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAsync } from '../lib/useAsync'
import { useClub } from '../lib/ClubContext'
import DateField, { todayLocal } from '../components/DateField'
import { C } from '../theme'
import { EmojiIcon } from '../components/EmojiIcon'
import type { RootStackProps } from '../navigation/types'
import { AWARD_CONFIG_KEY, AWARD_CATEGORIES, fillToCount, type AwardItemDef } from '../lib/awardConfig'

type Nav = RootStackProps<'RoundSetup'>['navigation']

// ─── 스텝 카드 헤더 ───────────────────────────────────────────────────────────
function StepCard({
  num, title, summary, done, open,
  onHeaderPress, children,
}: {
  num: number; title: string; summary?: string
  done: boolean; open: boolean
  onHeaderPress: () => void; children: React.ReactNode
}) {
  return (
    <View style={s.stepCard}>
      <TouchableOpacity style={s.stepHeader} onPress={onHeaderPress} activeOpacity={0.7}>
        <View style={[s.stepCircle, done && s.stepCircleDone]}>
          <Text style={[s.stepNum, done && s.stepNumDone]}>{done ? '✓' : num}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.stepTitle}>{title}</Text>
          {done && !open && summary ? <Text style={s.stepSummary} numberOfLines={1}>{summary}</Text> : null}
        </View>
        {done && <Text style={s.editLabel}>{open ? '접기' : '수정'}</Text>}
      </TouchableOpacity>
      {open && <View style={s.stepContent}>{children}</View>}
    </View>
  )
}

// ─── 메인 화면 ────────────────────────────────────────────────────────────────
export default function RoundSetupScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<RootStackProps<'RoundSetup'>['route']>()
  const { ocrPlayers, settlement: paramSettlement } = route.params ?? {}

  const [openStep, setOpenStep] = useState(0)
  const [doneSteps, setDoneSteps] = useState(new Set<number>())

  function advance(from: number) {
    setDoneSteps((prev) => new Set([...prev, from]))
    setOpenStep(from + 1)
  }
  function toggleStep(n: number) {
    if (openStep === n) setOpenStep(-1)
    else setOpenStep(n)
  }

  // ── Step 0: 날짜 ──────────────────────────────────────────────────────────
  const [date, setDate] = useState(todayLocal())

  // ── Step 1: 골프장 ────────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<GolfCourse | null>(null)
  const [layouts, setLayouts] = useState<CourseLayout[]>([])
  const [frontLayout, setFrontLayout] = useState<CourseLayout | null>(null)
  const [backLayout, setBackLayout] = useState<CourseLayout | null>(null)
  const [layout18, setLayout18] = useState<CourseLayout | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualName, setManualName] = useState('')

  const { data: allCourses } = useAsync(() => getGolfCourses(), [])
  const filtered = (allCourses ?? []).filter((c) =>
    !query.trim() || c.name.includes(query) || c.region.includes(query)
  )
  const layouts9 = layouts.filter((l) => l.holes === 9)
  const layouts18 = layouts.filter((l) => l.holes === 18)
  const is9mode = layouts18.length === 0 && layouts9.length > 0

  async function pickCourse(c: GolfCourse) {
    setSelectedCourse(c); setQuery(c.name)
    setFrontLayout(null); setBackLayout(null); setLayout18(null)
    const lays = await getCourseLayouts(c.id)
    setLayouts(lays)
    const l18 = lays.filter((l) => l.holes === 18)
    if (l18.length === 1) setLayout18(l18[0])
  }
  function clearCourse() {
    setSelectedCourse(null); setLayouts([])
    setFrontLayout(null); setBackLayout(null); setLayout18(null)
  }
  function getPars(): number[] | null {
    if (showManual) return new Array(18).fill(4)
    if (layout18) return layout18.pars
    if (is9mode && frontLayout && backLayout) return [...frontLayout.pars, ...backLayout.pars]
    return null
  }
  function getCourseName(): string {
    if (showManual) return manualName.trim()
    if (!selectedCourse) return ''
    if (layout18) return layout18.name === '메인코스' ? selectedCourse.name : `${selectedCourse.name} ${layout18.name}`
    if (frontLayout && backLayout) return `${selectedCourse.name} ${frontLayout.name}+${backLayout.name}`
    return selectedCourse.name
  }
  // 홀 레이블 (9홀 모드만): ['밸리1',...,'밸리9','파인1',...,'파인9']
  function getHoleLabels(): string[] | undefined {
    if (!is9mode || !frontLayout || !backLayout) return undefined
    const front = frontLayout.name.replace(/코스$/, '')
    const back = backLayout.name.replace(/코스$/, '')
    return [
      ...Array.from({ length: 9 }, (_, i) => `${front}${i + 1}`),
      ...Array.from({ length: 9 }, (_, i) => `${back}${i + 1}`),
    ]
  }
  const courseDone = getPars() !== null

  // ── Step 2: 플레이어 ──────────────────────────────────────────────────────
  const { activeClub } = useClub()
  const { data: members } = useAsync(
    () => activeClub ? getClubMembers(activeClub.id) : Promise.resolve([]),
    [activeClub?.id]
  )
  // 멤버/게스트 역할: 'game'(초록=경기) | 'settle'(붉은=경기+정산). 없으면 미참가.
  const [roles, setRoles] = useState<Record<string, 'game' | 'settle'>>(() => {
    const init: Record<string, 'game' | 'settle'> = {}
    const settleSet = new Set(paramSettlement?.participants ?? [])
    const names = ocrPlayers?.map((p) => p.name) ?? (paramSettlement?.participants ?? [])
    for (const n of names) init[n] = settleSet.has(n) ? 'settle' : 'game'
    return init
  })
  const [guestInput, setGuestInput] = useState('')
  const [guestNames, setGuestNames] = useState<string[]>([])

  // off → game(초록) → settle(붉은) → off 순환. 게스트는 off 시 목록에서 제거.
  function cycleRole(name: string, isGuest = false) {
    const cur = roles[name]
    if (!cur) setRoles({ ...roles, [name]: 'game' })
    else if (cur === 'game') setRoles({ ...roles, [name]: 'settle' })
    else {
      const { [name]: _omit, ...rest } = roles
      setRoles(rest)
      if (isGuest) setGuestNames(guestNames.filter((n) => n !== name))
    }
  }
  function addGuest() {
    const name = guestInput.trim()
    if (!name || guestNames.includes(name) || roles[name]) return
    setGuestNames((prev) => [...prev, name])
    setRoles((prev) => ({ ...prev, [name]: 'game' }))
    setGuestInput('')
  }

  const activeNames = [
    ...(members ?? []).map((m) => m.name).filter((n) => roles[n]),
    ...guestNames.filter((n) => roles[n]),
  ]
  const gamePlayers = activeNames                                      // 초록∪붉은 → 경기(점수 입력)
  const settlePlayers = activeNames.filter((n) => roles[n] === 'settle') // 붉은 → 정산

  // ── Step 4: 시상 룰 ──────────────────────────────────────────────────────
  const [awardCount, setAwardCount] = useState(2)
  const [selectedAwardItems, setSelectedAwardItems] = useState<string[]>(['medal', 'birdieKing', 'last'])
  const [infoItem, setInfoItem] = useState<AwardItemDef | null>(null)

  // 멤버 로드 완료 시 신규 라운드이면 전체 멤버를 'game'으로 초기 선택
  useEffect(() => {
    if (!members || members.length === 0) return
    if (ocrPlayers || paramSettlement) return  // OCR/기존 정산 데이터가 있으면 스킵
    setRoles(prev => {
      if (Object.keys(prev).length > 0) return prev  // 이미 초기화된 경우 스킵
      const init: Record<string, 'game' | 'settle'> = {}
      for (const m of members) init[m.name] = 'game'
      return init
    })
  }, [members])

  useEffect(() => {
    AsyncStorage.getItem(AWARD_CONFIG_KEY).then(v => {
      if (v) {
        try {
          const cfg = JSON.parse(v)
          if (typeof cfg.count === 'number') setAwardCount(cfg.count)
          if (Array.isArray(cfg.items)) setSelectedAwardItems(cfg.items)
        } catch {}
      }
    })
  }, [])

  function toggleAwardItem(id: string) {
    setSelectedAwardItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function handleAwardRandom() {
    const all = AWARD_CATEGORIES.flatMap(c => c.items)
    const shuffled = [...all].sort(() => Math.random() - 0.5)
    setSelectedAwardItems(shuffled.slice(0, awardCount).map(a => a.id))
  }
  async function advanceAward() {
    // count보다 items가 적으면 ranked 항목(shin1→2, regular1→2→3) 자동 보완 후 저장
    const filledItems = fillToCount(selectedAwardItems, awardCount)
    await AsyncStorage.setItem(AWARD_CONFIG_KEY, JSON.stringify({ count: awardCount, items: filledItems }))
    advance(4)
  }

  // ── Step 3: Game Rule ─────────────────────────────────────────────────────
  const [settlementOn, setSettlementOn] = useState(!!paramSettlement)
  const [strokeFee, setStrokeFee] = useState(paramSettlement?.strokeFee ?? 5000)
  const [birdieBonus, setBirdieBonus] = useState<5000 | 10000>(paramSettlement?.birdieBonus ?? 10000)
  const [baepanCond, setBaepanCond] = useState<BaepanConditions>(
    paramSettlement?.baepanConditions ?? { strokeOverpar: true, tie: true, birdie: false }
  )

  const { data: savedSettlement } = useAsync(
    () => activeClub ? getClubSettlement(activeClub.id) : Promise.resolve(null),
    [activeClub?.id]
  )
  useEffect(() => {
    if (paramSettlement) return
    if (savedSettlement) {
      setSettlementOn(true)
      setStrokeFee(savedSettlement.strokeFee)
      setBirdieBonus(savedSettlement.birdieBonus)
      if (savedSettlement.baepanConditions) setBaepanCond(savedSettlement.baepanConditions)
    }
  }, [savedSettlement]) // eslint-disable-line react-hooks/exhaustive-deps

  function buildSettlement(): SettlementConfig | undefined {
    if (!settlementOn || settlePlayers.length < 2) return undefined
    return { participants: settlePlayers, strokeFee, birdieBonus, baepanConditions: baepanCond }
  }

  async function persistSettlement(on: boolean, fee: number, bonus: 5000 | 10000, cond?: BaepanConditions) {
    if (!activeClub) return
    const c = cond ?? baepanCond
    try {
      await saveClubSettlement(activeClub.id, on ? { participants: settlePlayers, strokeFee: fee, birdieBonus: bonus, baepanConditions: c } : null)
    } catch {}
  }

  function toggleBaepan(key: keyof BaepanConditions) {
    const next = { ...baepanCond, [key]: !baepanCond[key] }
    setBaepanCond(next)
    persistSettlement(settlementOn, strokeFee, birdieBonus, next)
  }

  // ── 시작 ──────────────────────────────────────────────────────────────────
  function handleStart() {
    const pars = getPars()
    if (!pars || gamePlayers.length < 1) return
    const players = gamePlayers.map((name) => {
      const ocr = ocrPlayers?.find((p) => p.name === name)
      return { name, strokes: ocr?.strokes ?? pars.map((p) => p) }
    })
    nav.navigate('ScoreEntry', {
      date,
      courseName: getCourseName(),
      pars,
      golfCourseId: showManual ? undefined : selectedCourse?.id,
      players,
      settlement: buildSettlement(),
      holeLabels: getHoleLabels(),
      photoUris: imageUris.length > 0 ? imageUris : undefined,
    })
  }

  const allDone = doneSteps.has(0) && doneSteps.has(1) && doneSteps.has(2) && doneSteps.has(3) && doneSteps.has(4)

  // ── 입력 방식 선택 ────────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<'direct' | 'photo' | null>(null)
  const [imageUris, setImageUris] = useState<string[]>([])
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrResult, setOcrResult] = useState<RecognizedScorecard | null>(null)
  const [ocrError, setOcrError] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.'); return }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 })
    if (!res.canceled && res.assets.length > 0) {
      setImageUris((prev) => [...prev, ...res.assets.map((a) => a.uri)])
      setOcrResult(null); setOcrError('')
    }
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.'); return }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9, allowsMultipleSelection: true,
    })
    if (!res.canceled && res.assets.length > 0) {
      setImageUris((prev) => [...prev, ...res.assets.map((a) => a.uri)])
      setOcrResult(null); setOcrError('')
    }
  }

  async function runOCR() {
    setOcrBusy(true); setOcrResult(null); setOcrError('')
    try {
      const cards = await Promise.all(imageUris.map((u) => recognizeScorecard(u)))
      setOcrResult(mergeScorecards(cards, frontLayout?.name, backLayout?.name))
    } catch (err) {
      setOcrError('인식 중 오류: ' + String(err))
    } finally { setOcrBusy(false) }
  }

  function buildPlayers(recognized?: RecognizedScorecard) {
    const pars = getPars()!
    if (!recognized) return gamePlayers.map((name) => ({ name, strokes: pars.map((p) => p) }))

    const ocrNames = recognized.players.map((p) => p.name)
    const used = new Set<number>()

    return gamePlayers.map((name) => {
      const idx = findBestOcrMatch(name, ocrNames, used)
      if (idx < 0) return { name, strokes: pars.map((p) => p) }
      used.add(idx)
      return {
        name,
        strokes: recognized.players[idx].diffs.map((d, i) => Math.max(1, pars[i] + (d ?? 0))),
      }
    })
  }

  async function handleDirectSave() {
    const pars = getPars()
    if (!pars || gamePlayers.length < 1 || !ocrResult) return
    setSaveBusy(true)
    try {
      const photoData: string[] = []
      for (const uri of imageUris) {
        const res = await manipulateAsync(uri, [{ resize: { width: 800 } }], {
          compress: 0.6, format: SaveFormat.JPEG, base64: true,
        })
        if (res.base64) photoData.push(`data:image/jpeg;base64,${res.base64}`)
      }
      const saved = await saveRound({
        date,
        courseName: getCourseName(),
        pars,
        players: buildPlayers(ocrResult),
        photoData,
        clubId: activeClub?.id,
        settlement: buildSettlement(),
        golfCourseId: showManual ? undefined : selectedCourse?.id,
      })
      nav.navigate('RoundDetail', { id: saved.id })
    } catch (err) {
      Alert.alert('저장 오류', String(err))
    } finally {
      setSaveBusy(false)
    }
  }

  return (
    <View style={{ flex: 1 }}>
    {/* 시상 항목 설명 모달 */}
    {infoItem && (
      <Modal visible transparent animationType="fade" onRequestClose={() => setInfoItem(null)}>
        <TouchableOpacity style={s.infoOverlay} activeOpacity={1} onPress={() => setInfoItem(null)}>
          <TouchableOpacity style={s.infoCard} activeOpacity={1} onPress={() => {}}>
            <Text style={s.infoIcon}>{infoItem.icon}</Text>
            <Text style={s.infoTitle}>{infoItem.label}</Text>
            <Text style={s.infoDetail}>{infoItem.detail}</Text>
            <TouchableOpacity style={s.infoOkBtn} onPress={() => setInfoItem(null)}>
              <Text style={s.infoOkBtnText}>확인</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    )}
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Step 0: 날짜 */}
      <StepCard
        num={1} title="날짜"
        summary={date}
        done={doneSteps.has(0)} open={openStep === 0}
        onHeaderPress={() => toggleStep(0)}
      >
        <DateField value={date} onChange={setDate} />
        <TouchableOpacity style={s.nextBtn} onPress={() => advance(0)}>
          <Text style={s.nextBtnText}>완료 →</Text>
        </TouchableOpacity>
      </StepCard>

      {/* Step 1: 골프장 */}
      <StepCard
        num={2} title="골프장"
        summary={courseDone ? `${getCourseName()} · 파${getPars()!.reduce((a, b) => a + b, 0)}` : ''}
        done={doneSteps.has(1)} open={openStep === 1}
        onHeaderPress={() => (doneSteps.has(1) || openStep === 1) && toggleStep(1)}
      >
        {!showManual && (
          <>
            <View style={s.searchRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={query}
                onChangeText={(v) => { setQuery(v); clearCourse() }}
                placeholder="골프장 이름 또는 지역 검색"
              />
              {selectedCourse && (
                <TouchableOpacity style={s.clearBtn} onPress={() => { setQuery(''); clearCourse() }}>
                  <Text style={s.clearBtnText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
            {!selectedCourse && filtered.length > 0 && (
              <ScrollView style={s.courseList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filtered.map((c) => (
                  <TouchableOpacity key={c.id} style={s.courseRow} onPress={() => pickCourse(c)}>
                    <Text style={s.courseName}>{c.name}</Text>
                    <Text style={s.courseRegion}>{c.region}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {selectedCourse && layouts.length > 0 && (
              <View style={{ marginTop: 10 }}>
                {layouts18.length > 1 && (
                  <>
                    <Text style={s.layoutLabel}>코스</Text>
                    <View style={s.chipRow}>
                      {layouts18.map((l) => (
                        <TouchableOpacity key={l.id} style={[s.chip, layout18?.id === l.id && s.chipOn]} onPress={() => setLayout18(l)}>
                          <Text style={[s.chipText, layout18?.id === l.id && s.chipTextOn]}>{l.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                {is9mode && (
                  <>
                    <Text style={s.layoutLabel}>전반 (1~9홀)</Text>
                    <View style={s.chipRow}>
                      {layouts9.map((l) => (
                        <TouchableOpacity key={l.id} style={[s.chip, frontLayout?.id === l.id && s.chipOn]} onPress={() => setFrontLayout(l)}>
                          <Text style={[s.chipText, frontLayout?.id === l.id && s.chipTextOn]}>{l.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={[s.layoutLabel, { marginTop: 8 }]}>후반 (10~18홀)</Text>
                    <View style={s.chipRow}>
                      {layouts9.map((l) => (
                        <TouchableOpacity key={l.id} style={[s.chip, backLayout?.id === l.id && s.chipOn]} onPress={() => setBackLayout(l)}>
                          <Text style={[s.chipText, backLayout?.id === l.id && s.chipTextOn]}>{l.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                {getPars() && (
                  <View style={s.parPreview}>
                    <Text style={s.parPreviewText}>{getCourseName()} · 파{getPars()!.reduce((a, b) => a + b, 0)}</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
        {showManual && (
          <TextInput style={s.input} value={manualName} onChangeText={setManualName}
            placeholder="골프장명 직접 입력" autoFocus />
        )}
        <TouchableOpacity style={s.manualToggle} onPress={() => { setShowManual((v) => !v); clearCourse(); setQuery('') }}>
          <Text style={s.manualToggleText}>{showManual ? '↩ 목록에서 선택' : '목록에 없는 골프장 직접 입력'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.nextBtn, !courseDone && s.nextBtnDisabled]}
          onPress={() => courseDone && advance(1)} disabled={!courseDone}
        >
          <Text style={s.nextBtnText}>완료 →</Text>
        </TouchableOpacity>
      </StepCard>

      {/* Step 2: 플레이어 */}
      <StepCard
        num={3} title="플레이어"
        summary={gamePlayers.length > 0 ? `경기 ${gamePlayers.length}명 · 정산 ${settlePlayers.length}명` : ''}
        done={doneSteps.has(2)} open={openStep === 2}
        onHeaderPress={() => (doneSteps.has(2) || openStep === 2) && toggleStep(2)}
      >
        <Text style={s.fieldLabel}>클럽 멤버</Text>
        <View style={s.legendRow}>
          <View style={[s.legendDot, s.legendGame]} /><Text style={s.legendText}>경기</Text>
          <View style={[s.legendDot, s.legendSettle]} /><Text style={s.legendText}>경기+정산</Text>
          <Text style={s.legendHint}>· 탭하여 전환</Text>
        </View>
        {(!members || members.length === 0) ? (
          <Text style={s.muted}>클럽 멤버가 없습니다.</Text>
        ) : (
          <View style={s.chipRow}>
            {members.map((m) => {
              const r = roles[m.name]
              return (
                <TouchableOpacity
                  key={m.userId}
                  style={[s.chip, r === 'game' && s.chipGame, r === 'settle' && s.chipSettle]}
                  onPress={() => cycleRole(m.name)}
                >
                  <Text style={[s.chipText, r === 'game' && s.chipTextGame, r === 'settle' && s.chipTextSettle]}>{m.name}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
        <Text style={[s.fieldLabel, { marginTop: 12 }]}>게스트</Text>
        <View style={s.guestRow}>
          <TextInput
            style={[s.input, { flex: 1 }]} value={guestInput} onChangeText={setGuestInput}
            placeholder="이름 입력" onSubmitEditing={addGuest} returnKeyType="done"
          />
          <TouchableOpacity style={s.addBtn} onPress={addGuest}>
            <Text style={s.addBtnText}>+ 추가</Text>
          </TouchableOpacity>
        </View>
        {guestNames.length > 0 && (
          <View style={[s.chipRow, { marginTop: 8 }]}>
            {guestNames.map((g) => {
              const r = roles[g]
              return (
                <TouchableOpacity
                  key={g}
                  style={[s.chip, r === 'game' && s.chipGame, r === 'settle' && s.chipSettle]}
                  onPress={() => cycleRole(g, true)}
                >
                  <Text style={[s.chipText, r === 'game' && s.chipTextGame, r === 'settle' && s.chipTextSettle]}>{g}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
        {gamePlayers.length > 0 && (
          <Text style={[s.muted, { marginTop: 8 }]}>
            경기: {gamePlayers.join(', ')}{settlePlayers.length > 0 ? `\n정산: ${settlePlayers.join(', ')}` : ''}
          </Text>
        )}
        <TouchableOpacity
          style={[s.nextBtn, gamePlayers.length < 1 && s.nextBtnDisabled]}
          onPress={() => gamePlayers.length >= 1 && advance(2)} disabled={gamePlayers.length < 1}
        >
          <Text style={s.nextBtnText}>완료 →</Text>
        </TouchableOpacity>
      </StepCard>

      {/* Step 3: Game Rule */}
      <StepCard
        num={4} title="Game Rule"
        summary={settlementOn ? `정산 ${strokeFee.toLocaleString('ko-KR')}원/타 · 버디 ${birdieBonus.toLocaleString('ko-KR')}원` : '정산 없음'}
        done={doneSteps.has(3)} open={openStep === 3}
        onHeaderPress={() => (doneSteps.has(3) || openStep === 3) && toggleStep(3)}
      >
        <View style={s.onOffRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>정산</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: settlementOn ? C.green : C.danger }}>
              {settlementOn ? '🟢 적용 중' : '🔴 미적용'}
            </Text>
          </View>
          <TouchableOpacity style={s.trafficLight} onPress={() => { setSettlementOn((v) => !v); persistSettlement(!settlementOn, strokeFee, birdieBonus) }} activeOpacity={0.8}>
            <View style={[s.lightDot, settlementOn ? s.redOff : s.redOn]} />
            <View style={[s.lightDot, settlementOn ? s.greenOn : s.greenOff]} />
          </TouchableOpacity>
        </View>
        {settlementOn && (
          <>
            <Text style={[s.fieldLabel, { marginTop: 4 }]}>타당 (1타 단가)</Text>
            <View style={s.shuttleRow}>
              <TouchableOpacity style={s.shuttleBtn} onPress={() => { const v = Math.max(1000, strokeFee - 1000); setStrokeFee(v); persistSettlement(true, v, birdieBonus) }}>
                <Text style={s.shuttleBtnText}>◀</Text>
              </TouchableOpacity>
              <Text style={s.shuttleVal}>{strokeFee.toLocaleString('ko-KR')}원</Text>
              <TouchableOpacity style={s.shuttleBtn} onPress={() => { const v = Math.min(20000, strokeFee + 1000); setStrokeFee(v); persistSettlement(true, v, birdieBonus) }}>
                <Text style={s.shuttleBtnText}>▶</Text>
              </TouchableOpacity>
            </View>
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>버디 보너스</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              {([5000, 10000] as const).map((v) => (
                <TouchableOpacity key={v} style={[s.bonusBtn, birdieBonus === v && s.bonusBtnOn]} onPress={() => { setBirdieBonus(v); persistSettlement(true, strokeFee, v) }}>
                  <Text style={[s.bonusText, birdieBonus === v && s.bonusTextOn]}>{v.toLocaleString('ko-KR')}원</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>배판 조건</Text>
            {([
              { key: 'strokeOverpar', label: '더블/트리플 오버파 (파3 더블↑ · 파4이상 트리플↑)' },
              { key: 'tie',           label: '2명 이상 동타' },
              { key: 'birdie',        label: '버디 이하' },
            ] as { key: keyof BaepanConditions; label: string }[]).map(({ key, label }) => (
              <TouchableOpacity key={key} style={s.checkRow} onPress={() => toggleBaepan(key)}>
                <View style={[s.checkbox, baepanCond[key] && s.checkboxOn]}>
                  {baepanCond[key] && <Text style={s.checkmark}>✓</Text>}
                </View>
                <Text style={s.checkLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        <TouchableOpacity style={s.nextBtn} onPress={() => advance(3)}>
          <Text style={s.nextBtnText}>완료 →</Text>
        </TouchableOpacity>
      </StepCard>

      {/* Step 4: 시상 룰 */}
      <StepCard
        num={5} title="시상 룰"
        summary={selectedAwardItems.length > 0 ? selectedAwardItems.map(id => AWARD_CATEGORIES.flatMap(c => c.items).find(a => a.id === id)?.icon ?? '').join(' ') : '없음'}
        done={doneSteps.has(4)} open={openStep === 4}
        onHeaderPress={() => (doneSteps.has(4) || openStep === 4) && toggleStep(4)}
      >
        {/* 시상 인원 */}
        <Text style={s.fieldLabel}>시상 인원 (랜덤 선정 기준)</Text>
        <View style={[s.chipRow, { marginBottom: 14 }]}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity key={n}
              style={[s.chip, awardCount === n && s.chipOn]}
              onPress={() => setAwardCount(n)}
            >
              <Text style={[s.chipText, awardCount === n && s.chipTextOn]}>{n}명</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 시상 항목 */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={s.fieldLabel}>시상 항목 선택</Text>
          <TouchableOpacity style={s.addBtn} onPress={handleAwardRandom}>
            <Text style={s.addBtnText}>🎲 랜덤</Text>
          </TouchableOpacity>
        </View>

        {AWARD_CATEGORIES.map(cat => (
          <View key={cat.label} style={{ marginBottom: 10 }}>
            <Text style={s.layoutLabel}>{cat.label}</Text>
            <View style={s.chipRow}>
              {cat.items.map(item => {
                const on = selectedAwardItems.includes(item.id)
                return (
                  <View key={item.id} style={[s.chip, s.awardChipWrap, on && s.chipOn]}>
                    <TouchableOpacity style={s.awardChipMain} onPress={() => toggleAwardItem(item.id)}>
                      <Text style={[s.chipText, on && s.chipTextOn]}>{item.icon} {item.label}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.awardChipInfo}
                      onPress={() => setInfoItem(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                    >
                      <Text style={[s.awardChipInfoText, on && s.awardChipInfoTextOn]}>ⓘ</Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </View>
          </View>
        ))}

        <TouchableOpacity style={s.nextBtn} onPress={advanceAward}>
          <Text style={s.nextBtnText}>완료 →</Text>
        </TouchableOpacity>
      </StepCard>

      {/* 입력 방식 선택 */}
      {allDone && (
        <View style={s.modeSection}>
          <Text style={s.modeSectionTitle}>스코어 입력 방식</Text>
          <View style={s.modeRow}>
            <TouchableOpacity
              style={[s.modeBtn, inputMode === 'direct' && s.modeBtnOn]}
              onPress={() => setInputMode('direct')}
            >
              <View style={s.modeIcon}><EmojiIcon char="✏️" size={16} color={C.green} /></View>
              <Text style={[s.modeBtnText, inputMode === 'direct' && s.modeBtnTextOn]}>직접 입력</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modeBtn, inputMode === 'photo' && s.modeBtnOn]}
              onPress={() => setInputMode('photo')}
            >
              <Text style={s.modeIcon}>📷</Text>
              <Text style={[s.modeBtnText, inputMode === 'photo' && s.modeBtnTextOn]}>사진 업로드</Text>
            </TouchableOpacity>
          </View>

          {/* 직접 입력 시작 */}
          {inputMode === 'direct' && (
            <TouchableOpacity
              style={[s.startBtn, (!getPars() || gamePlayers.length < 1) && s.startBtnDisabled]}
              onPress={handleStart}
              disabled={!getPars() || gamePlayers.length < 1}
            >
              <Text style={s.startBtnText}>입력 시작</Text>
            </TouchableOpacity>
          )}

          {/* 사진 업로드 + OCR */}
          {inputMode === 'photo' && (
            <View style={s.photoSection}>
              {/* 사진 선택 버튼 */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[s.photoBtn, { flex: 1 }]} onPress={takePhoto} disabled={ocrBusy}>
                  <Text style={s.photoBtnText}>📷 사진 찍기</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.photoBtn, { flex: 1 }]} onPress={pickFromLibrary} disabled={ocrBusy}>
                  <Text style={s.photoBtnText}>🖼️ 갤러리</Text>
                </TouchableOpacity>
              </View>

              {/* 썸네일 */}
              {imageUris.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
                  {imageUris.map((uri, i) => (
                    <View key={i} style={s.thumbWrap}>
                      <Image source={{ uri }} style={s.thumb} resizeMode="cover" />
                      <TouchableOpacity
                        style={s.removeThumb}
                        onPress={() => { setImageUris((prev) => prev.filter((_, j) => j !== i)); setOcrResult(null) }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* OCR 시작 */}
              {imageUris.length > 0 && !ocrResult && (
                <TouchableOpacity
                  style={[s.startBtn, { marginTop: 10 }, ocrBusy && { opacity: 0.6 }]}
                  onPress={runOCR} disabled={ocrBusy}
                >
                  {ocrBusy
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.startBtnText}>🔍 {imageUris.length}장 인식 시작</Text>
                  }
                </TouchableOpacity>
              )}

              {ocrError !== '' && (
                <Text style={{ marginTop: 8, color: C.danger, fontSize: 13 }}>{ocrError}</Text>
              )}

              {/* OCR 결과 */}
              {ocrResult && (
                <View style={s.ocrResult}>
                  <Text style={s.ocrResultTitle}>인식 결과 ({ocrResult.players.length}명)</Text>
                  {(() => {
                    const appPars = getPars()!
                    const ocrNames = ocrResult.players.map((p) => p.name)
                    const previewUsed = new Set<number>()
                    return gamePlayers.map((memberName) => {
                      const idx = findBestOcrMatch(memberName, ocrNames, previewUsed)
                      if (idx < 0) return null
                      previewUsed.add(idx)
                      const p = ocrResult.players[idx]
                      const total = p.diffs.reduce<number>((a, d, j) => a + appPars[j] + (d ?? 0), 0)
                      return (
                        <View key={memberName} style={s.ocrRow}>
                          <Text style={s.ocrName}>
                            {memberName}
                            {p.name && p.name !== memberName
                              ? <Text style={{ color: '#aaa', fontSize: 11 }}> ({p.name})</Text>
                              : null}
                          </Text>
                          <Text style={s.ocrTotal}>{total}타</Text>
                        </View>
                      )
                    })
                  })()}
                  {/* 바로 저장 */}
                  <TouchableOpacity
                    style={[s.startBtn, { marginTop: 12 }, saveBusy && { opacity: 0.6 }]}
                    onPress={handleDirectSave}
                    disabled={saveBusy}
                  >
                    {saveBusy
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.startBtnText}>바로 저장</Text>
                    }
                  </TouchableOpacity>
                  {/* 수정 필요 → ScoreEntry */}
                  <TouchableOpacity
                    style={[s.editBtn, { marginTop: 8 }]}
                    onPress={() => {
                      const pars = getPars()
                      if (!pars || gamePlayers.length < 1) return
                      nav.navigate('ScoreEntry', {
                        date, courseName: getCourseName(), pars,
                        golfCourseId: showManual ? undefined : selectedCourse?.id,
                        players: buildPlayers(ocrResult),
                        settlement: buildSettlement(),
                        holeLabels: getHoleLabels(),
                        photoUris: imageUris.length > 0 ? imageUris : undefined,
                      })
                    }}
                    disabled={saveBusy}
                  >
                    <Text style={s.editBtnText}>수정 필요</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ marginTop: 8, alignItems: 'center' }}
                    onPress={() => { setOcrResult(null); setImageUris([]) }}
                  >
                    <Text style={{ fontSize: 12, color: C.muted, textDecorationLine: 'underline' }}>다시 촬영하기</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  // 스텝 카드
  stepCard: {
    backgroundColor: C.card, borderRadius: 16, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, overflow: 'hidden',
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.border, alignItems: 'center', justifyContent: 'center',
  },
  stepCircleDone: { backgroundColor: C.green },
  stepNum: { fontSize: 13, fontWeight: '700', color: C.muted },
  stepNumDone: { color: '#fff' },
  stepTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  stepSummary: { fontSize: 12, color: C.muted, marginTop: 2 },
  editLabel: { fontSize: 12, color: C.green, fontWeight: '600' },
  stepContent: { paddingHorizontal: 16, paddingBottom: 16 },
  // 필드
  fieldLabel: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: C.text, backgroundColor: C.bg },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  clearBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  clearBtnText: { fontSize: 16, color: C.muted, fontWeight: '700' },
  courseList: { maxHeight: 280 },
  courseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  courseName: { fontSize: 14, fontWeight: '600', color: C.text },
  courseRegion: { fontSize: 12, color: C.muted },
  layoutLabel: { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  chipOn: { borderColor: C.green, backgroundColor: C.greenLight },
  chipText: { fontSize: 13, color: C.muted, fontWeight: '500' },
  chipTextOn: { color: C.green, fontWeight: '700' },
  chipGame: { borderColor: C.green, backgroundColor: C.greenLight },
  chipSettle: { borderColor: C.danger, backgroundColor: '#fdecea' },
  chipTextGame: { color: C.green, fontWeight: '700' },
  chipTextSettle: { color: C.danger, fontWeight: '700' },
  legendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendGame: { backgroundColor: C.green },
  legendSettle: { backgroundColor: C.danger },
  legendText: { fontSize: 11, color: C.muted, marginRight: 8 },
  legendHint: { fontSize: 11, color: C.muted, fontStyle: 'italic' },
  parPreview: { marginTop: 10, backgroundColor: C.greenLight, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
  parPreviewText: { fontSize: 13, fontWeight: '700', color: C.green },
  manualToggle: { marginTop: 12, alignItems: 'center' },
  manualToggleText: { fontSize: 12, color: C.muted, textDecorationLine: 'underline' },
  guestRow: { flexDirection: 'row', gap: 8 },
  addBtn: { backgroundColor: C.greenLight, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: C.green, fontWeight: '700', fontSize: 13 },
  muted: { fontSize: 13, color: C.muted },
  // 다음/완료
  nextBtn: { backgroundColor: C.green, borderRadius: 50, paddingVertical: 11, alignItems: 'center', marginTop: 16 },
  nextBtnDisabled: { opacity: 0.35 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // 시작 버튼
  startBtn: { backgroundColor: C.greenDark, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  // 정산
  onOffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  trafficLight: { width: 56, height: 32, borderRadius: 9, backgroundColor: '#2b2b2b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 6 },
  lightDot: { width: 18, height: 18, borderRadius: 9 },
  redOn: { backgroundColor: '#e74c3c' },
  redOff: { backgroundColor: '#4a2420' },
  greenOn: { backgroundColor: '#2ecc71' },
  greenOff: { backgroundColor: '#1f3d2b' },
  shuttleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  shuttleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  shuttleBtnText: { color: C.green, fontWeight: '700', fontSize: 14 },
  shuttleVal: { fontSize: 16, fontWeight: '700', color: C.text, minWidth: 100, textAlign: 'center' },
  bonusBtn: { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  bonusBtnOn: { borderColor: C.green, backgroundColor: C.greenLight },
  bonusText: { fontSize: 14, fontWeight: '600', color: C.muted },
  bonusTextOn: { color: C.green },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { borderColor: C.green, backgroundColor: C.green },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '900' },
  checkLabel: { fontSize: 13, color: C.text, flex: 1 },
  // 입력 방식
  modeSection: {
    backgroundColor: C.card, borderRadius: 16, padding: 18, marginTop: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  modeSectionTitle: { fontSize: 13, fontWeight: '700', color: C.muted, marginBottom: 12 },
  modeRow: { flexDirection: 'row', gap: 12 },
  modeBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', gap: 6,
  },
  modeBtnOn: { borderColor: C.green, backgroundColor: C.greenLight },
  modeIcon: { fontSize: 26 },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: C.muted },
  modeBtnTextOn: { color: C.green, fontWeight: '700' },
  // 사진
  photoSection: { marginTop: 14 },
  photoBtn: {
    backgroundColor: C.greenLight, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  photoBtnText: { color: C.green, fontWeight: '600', fontSize: 14 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: C.greenLight },
  removeThumb: {
    position: 'absolute', top: -5, right: -5, width: 20, height: 20,
    borderRadius: 10, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center',
  },
  editBtn: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 50,
    paddingVertical: 13, alignItems: 'center',
  },
  editBtnText: { color: C.muted, fontWeight: '600', fontSize: 15 },
  ocrResult: {
    backgroundColor: '#f8fff8', borderRadius: 12, padding: 14, marginTop: 10,
    borderWidth: 1, borderColor: C.greenLight,
  },
  ocrResultTitle: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 10 },
  ocrRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  ocrName: { fontSize: 14, color: C.text, fontWeight: '600' },
  ocrTotal: { fontSize: 14, color: C.green, fontWeight: '700' },
  // 시상 항목 칩 (선택 + ⓘ 분리)
  awardChipWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0, paddingVertical: 0 },
  awardChipMain: { paddingLeft: 12, paddingRight: 4, paddingVertical: 7 },
  awardChipInfo: { paddingLeft: 2, paddingRight: 10, paddingVertical: 7 },
  awardChipInfoText: { fontSize: 13, color: C.muted },
  awardChipInfoTextOn: { color: C.green },
  // 시상 항목 설명 모달
  infoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  infoCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' },
  infoIcon: { fontSize: 48, marginBottom: 8 },
  infoTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 12 },
  infoDetail: { fontSize: 14, color: C.muted, lineHeight: 22, textAlign: 'center', marginBottom: 20 },
  infoOkBtn: { backgroundColor: C.green, borderRadius: 50, paddingVertical: 11, paddingHorizontal: 36 },
  infoOkBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
