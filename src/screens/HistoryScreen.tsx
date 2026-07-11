import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Modal, Dimensions, TextInput, ImageBackground, Animated, Alert, ActivityIndicator,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import Svg, { Polyline, Circle, Line, Text as SvgText, G, Polygon } from 'react-native-svg'
import { DEFAULT_LOTTO_AWARD_CONFIG, getClubAwardConfig, getClubAwardSnapshots, getClubLottoAwardConfig, getClubMembers, getRoundLottoDraw, getRoundLottoEntries, getRounds, getRound, getPersonalRoundStat, playerTotal, totalPar, getHandicapsForRound, computeHandicaps, shortName, updateRound, type ClubAwardSnapshot, type LottoAwardConfig, type PersonalRoundFir, type PersonalRoundHoleStat, type RoundLottoDraw, type RoundLottoEntry, type SavedRound } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useClub } from '../lib/ClubContext'
import { useUserProfile } from '../lib/UserProfileContext'
import { useAsync } from '../lib/useAsync'
import { loadHandicapBasis, type HandicapBasis } from '../lib/handicapBasis'
import { fillToCount } from '../lib/awardConfig'
import { computeClubAwardResults } from '../lib/awardResults'
import { getRoundSchedules, type ScheduledRound } from '../lib/roundSchedule'
import { calcSettlement, fmtKRW } from '../features/settlement'
import { C } from '../theme'
import { EmojiIcon } from '../components/EmojiIcon'
import { Icon } from '../components/Icon'
import { TopActionButtons } from '../components/TopActionButtons'
import { ImageCropModal, type ImageCropRect } from '../components/ImageCropModal'
import { getCourseHeroImageSource } from '../data/courseHeroImages'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Tab = 'byRound' | 'byPlayer' | 'club' | 'hall'
type RankingType = 'wins' | 'streak' | 'lowestHandicap' | 'birdie' | 'singleBirdie' | 'frontBack' | 'avgImprove' | 'handicapImprove' | 'singlePar' | 'roundsPlayed' | 'lowestScore' | 'highestScore'
type RoundDetailTab = 'regular' | 'peoria' | 'score' | 'award'

function formatWon(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString('ko-KR')}원`
}

function lottoPrizeForHits(hits: number, config: LottoAwardConfig, jackpot: number) {
  if (hits === 6) return jackpot
  if (hits === 3 || hits === 4 || hits === 5) return config.prizes[String(hits) as '3' | '4' | '5']
  return 0
}

function diffText(d: number) { return d > 0 ? `+${d}` : `${d}` }

function formatWinners(names: string[], value: string): string {
  if (names.length === 0) return '-'
  const label = names.length <= 3
    ? names.map(shortName).join(', ')
    : `${shortName(names[0])} 외 ${names.length - 1}명`
  return `${label} (${value})`
}


function normalizeRecordName(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, '').toLowerCase()
}

function decodeGogoParEmailName(value: string | null | undefined): string {
  const email = (value ?? '').trim()
  const match = email.match(/^([0-9a-f]{4,})@gogopar\.app$/i)
  if (!match) return ''
  const hex = match[1]
  try {
    const chars: string[] = []
    for (let i = 0; i < hex.length; i += 4) {
      const code = Number.parseInt(hex.slice(i, i + 4), 16)
      if (!Number.isFinite(code)) return ''
      chars.push(String.fromCharCode(code))
    }
    return chars.join('').trim()
  } catch {
    return ''
  }
}

function resolvePersonalPlayerName(
  myName: string | null,
  byName: Map<string, PlayerRound[]>,
  scheduleMemberNames: string[] = [],
): string | null {
  if (byName.size === 0) return null

  const candidates = [
    myName,
    decodeGogoParEmailName(myName),
    ...scheduleMemberNames,
  ].filter((value): value is string => !!value?.trim())

  const names = [...byName.keys()]
  for (const candidate of candidates) {
    if (byName.has(candidate)) return candidate
    const normalized = normalizeRecordName(candidate)
    const matched = names.find((name) => normalizeRecordName(name) === normalized)
    if (matched) return matched
  }

  // 실제 사용자명 또는 라운드 조편성의 member_user_id로 확인된 이름이 없으면
  // 임의의 플레이어 기록을 개인 기록으로 표시하지 않는다.
  return null
}


function holeStats(strokes: number[], pars: number[]) {
  let birdie = 0, par = 0, bogey = 0, dbl = 0, dblPlus = 0
  strokes.forEach((s, i) => {
    const d = s - pars[i]
    if (d <= -1) birdie++
    else if (d === 0) par++
    else if (d === 1) bogey++
    else if (d === 2) dbl++
    else dblPlus++
  })
  return { birdie, par, bogey, dbl, dblPlus }
}

function getWinnerLocal(r: SavedRound, handicaps: Map<string, number>): string | null {
  const best = Math.min(...r.players.map((p) => playerTotal(p.strokes)))
  const medalWinner = r.players.find((p) => playerTotal(p.strokes) === best)?.name
  const ranked = r.players
    .map((p) => ({ name: p.name, net: playerTotal(p.strokes) - (handicaps.get(p.name) ?? 0) }))
    .sort((a, b) => a.net - b.net)
  if (ranked[0]?.name === medalWinner) return ranked[1]?.name ?? null
  return ranked[0]?.name ?? null
}

interface Badge { icon: string; label: string }

function getPlayerBadges(rounds: SavedRound[], basis = 5): Map<string, Badge[]> {
  const badges = new Map<string, Badge[]>()
  const add = (name: string, icon: string, label: string) => {
    const arr = badges.get(name) ?? []
    arr.push({ icon, label })
    badges.set(name, arr)
  }

  let medalName = '', medalScore = Infinity
  for (const r of rounds)
    for (const p of r.players) {
      const t = playerTotal(p.strokes)
      if (t < medalScore) { medalScore = t; medalName = p.name }
    }
  if (medalName) add(medalName, '🏆', '메달리스트')

  const sorted = [...rounds].sort((a, b) => a.date.localeCompare(b.date))

  const winCount = new Map<string, number>()
  for (const r of sorted) {
    const w = getWinnerLocal(r, getHandicapsForRound(r, rounds, basis))
    if (w) winCount.set(w, (winCount.get(w) ?? 0) + 1)
  }
  let topWinName = '', topWinCount = 0
  for (const [n, c] of winCount) if (c > topWinCount) { topWinCount = c; topWinName = n }
  if (topWinName) add(topWinName, '🥇', '최다우승')

  const streakMap = new Map<string, number>()
  let curPlayer = '', curStreak = 0
  for (const r of sorted) {
    const w = getWinnerLocal(r, getHandicapsForRound(r, rounds, basis))
    if (w && w === curPlayer) {
      curStreak++
    } else {
      if (curPlayer && curStreak > 0)
        streakMap.set(curPlayer, Math.max(streakMap.get(curPlayer) ?? 0, curStreak))
      curPlayer = w ?? ''; curStreak = w ? 1 : 0
    }
  }
  if (curPlayer && curStreak > 0)
    streakMap.set(curPlayer, Math.max(streakMap.get(curPlayer) ?? 0, curStreak))
  let maxStreak = 0, maxStreakPlayer = ''
  for (const [n, st] of streakMap) if (st > maxStreak) { maxStreak = st; maxStreakPlayer = n }
  if (maxStreak >= 2 && maxStreakPlayer) add(maxStreakPlayer, '🔥', `${maxStreak}연승`)

  const birdieTotal = new Map<string, number>()
  for (const r of rounds)
    for (const p of r.players) {
      let b = 0
      p.strokes.forEach((s, i) => { if (s - r.pars[i] <= -1) b++ })
      birdieTotal.set(p.name, (birdieTotal.get(p.name) ?? 0) + b)
    }
  let topBirdieName = '', topBirdieCount = 0
  for (const [n, c] of birdieTotal) if (c > topBirdieCount) { topBirdieCount = c; topBirdieName = n }
  if (topBirdieName && topBirdieCount > 0) add(topBirdieName, '🐦', '버디왕')

  const singleBirdie = new Map<string, number>()
  for (const r of rounds)
    for (const p of r.players) {
      let b = 0
      p.strokes.forEach((s, i) => { if (s - r.pars[i] <= -1) b++ })
      singleBirdie.set(p.name, Math.max(singleBirdie.get(p.name) ?? 0, b))
    }
  let topSingleName = '', topSingleCount = 0
  for (const [n, c] of singleBirdie) if (c > topSingleCount) { topSingleCount = c; topSingleName = n }
  if (topSingleName && topSingleCount > 0) add(topSingleName, '⛳', '한경기버디')

  return badges
}

export default function HistoryScreen() {
  const nav = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<Tab>('byPlayer')
  const [refreshKey, setRefreshKey] = useState(0)
  const { name: myName, userId: myUserId } = useUserProfile()
  const [handicapBasis, setHandicapBasis] = useState<HandicapBasis>(5)
  const { activeClub, clubsLoaded } = useClub()
  const { data, loading } = useAsync(
    () => (activeClub ? getRounds(activeClub.id) : Promise.resolve([])),
    [refreshKey, activeClub?.id],
  )
  const rounds = data ?? []
  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // 화면 포커스 복귀 시 자동 새로고침 (삭제/저장 후 즉시 반영)
  useFocusEffect(useCallback(() => { setRefreshKey((k) => k + 1) }, []))

  useEffect(() => {
    loadHandicapBasis(activeClub?.id).then(setHandicapBasis)
  }, [activeClub?.id])

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.topActions, { paddingTop: insets.top + 10 }]}>
        <TopActionButtons />
      </View>
      <View style={s.tabs}>
        {(['byPlayer', 'byRound', 'club', 'hall'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'byRound' ? '라운딩별' : t === 'byPlayer' ? '개인별' : t === 'club' ? '클럽 전체' : '기네스 북'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.green} />}
      >
        {!clubsLoaded || loading ? (
          <Text style={s.muted}>데이터를 불러오는 중입니다.</Text>
        ) : (
          <>
            {tab === 'byRound' && <ByRound rounds={rounds} handicapBasis={handicapBasis} />}
            {tab === 'byPlayer' && <ByPlayer rounds={rounds} handicapBasis={handicapBasis} myName={myName} myUserId={myUserId} />}
            {tab === 'club' && <Club rounds={rounds} handicapBasis={handicapBasis} />}
            {tab === 'hall' && <HallOfFame rounds={rounds} handicapBasis={handicapBasis} />}
          </>
        )}
      </ScrollView>
    </View>
  )
}

// ─── 라운딩별 ────────────────────────────────────────────────────────────────

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonthKey(key: string, offset: number) {
  const [year, month] = key.split('-').map(Number)
  const next = new Date(year, month - 1 + offset, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [year, month] = key.split('-')
  return `${year}년 ${Number(month)}월`
}

function ByRound({ rounds, handicapBasis = 5 }: { rounds: SavedRound[]; handicapBasis?: number }) {
  if (rounds.length === 0) return <Text style={s.muted}>아직 라운드 기록이 없습니다.</Text>

  const filtered = [...rounds].sort((a, b) => {
    if (!a.isComplete && b.isComplete) return -1
    if (a.isComplete && !b.isComplete) return 1
    return b.date.localeCompare(a.date)
  })
  const cardWidth = Math.min(Dimensions.get('window').width - 32, 430)
  const cardHeight = Math.max(500, Math.min(590, Dimensions.get('window').height - 220))

  return (
    <View style={s.roundCarouselWrap}>
      <ScrollView
        horizontal
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={cardWidth + 12}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.roundCarouselContent}
      >
        {filtered.map((round, index) => (
          <RoundFlipCard
            key={round.id}
            round={round}
            rounds={rounds}
            handicapBasis={handicapBasis}
            index={index}
            totalCount={filtered.length}
            width={cardWidth}
            height={cardHeight}
          />
        ))}
      </ScrollView>
      <Text style={s.roundSwipeHint}>좌우로 스와이프해 다른 라운드를 확인하세요</Text>
    </View>
  )
}

function RoundFlipCard({
  round, rounds, handicapBasis, index, totalCount, width, height,
}: {
  round: SavedRound
  rounds: SavedRound[]
  handicapBasis: number
  index: number
  totalCount: number
  width: number
  height: number
}) {
  const nav = useNavigation<Nav>()
  const { activeClub } = useClub()
  const [flipped, setFlipped] = useState(false)
  const [detailTab, setDetailTab] = useState<RoundDetailTab>('regular')
  const [detailRound, setDetailRound] = useState<SavedRound | null>(null)
  const [awardSnapshots, setAwardSnapshots] = useState<ClubAwardSnapshot[]>([])
  const [lottoEntries, setLottoEntries] = useState<RoundLottoEntry[]>([])
  const [lottoDraw, setLottoDraw] = useState<RoundLottoDraw | null>(null)
  const [lottoAwardConfig, setLottoAwardConfig] = useState<LottoAwardConfig>(DEFAULT_LOTTO_AWARD_CONFIG)
  const [clubMembers, setClubMembers] = useState<Array<{ userId: string; name: string; role: string }>>([])
  const [roundSchedules, setRoundSchedules] = useState<ScheduledRound[]>([])
  const [clubAwardConfig, setClubAwardConfig] = useState<{ count: number; items: string[] } | null>(null)
  const [photoData, setPhotoData] = useState<string[]>(round.photoData ?? [])
  const [photoSaving, setPhotoSaving] = useState(false)
  const [photoCropSource, setPhotoCropSource] = useState<{ uri: string; width: number; height: number } | null>(null)
  const flip = useRef(new Animated.Value(0)).current
  const effectiveRound = detailRound ?? round
  const coverPhoto = photoData[0]
  const par = totalPar(round.pars)
  const totals = round.players.map((p) => playerTotal(p.strokes))
  const best = Math.min(...totals)
  const avg = Math.ceil(totals.reduce((a, b) => a + b, 0) / Math.max(totals.length, 1))
  const bestPlayer = round.players.find((p) => playerTotal(p.strokes) === best)
  const roundHandicaps = getHandicapsForRound(round, rounds, handicapBasis)
  const regularRank = round.players
    .map((p) => {
      const total = playerTotal(p.strokes)
      const handicap = roundHandicaps.get(p.name) ?? 0
      return { name: p.name, total, handicap, net: total - handicap }
    })
    .sort((a, b) => a.net - b.net)
  const winner = regularRank.find((row) => row.name !== bestPlayer?.name) ?? regularRank[0]
  const runnerUp = regularRank.find((row) => row.name !== bestPlayer?.name && row.name !== winner?.name)

  const playerHighlights = round.players.map((p) => {
    const stats = holeStats(p.strokes, round.pars)
    return { name: p.name, ...stats }
  })
  const birdieTop = [...playerHighlights].sort((a, b) => b.birdie - a.birdie)[0]
  const parTop = [...playerHighlights].sort((a, b) => b.par - a.par)[0]
  const bestHole = round.players.flatMap((p) => p.strokes.map((score, i) => ({ name: p.name, hole: i + 1, par: round.pars[i], score, diff: score - round.pars[i] })))
    .sort((a, b) => a.diff - b.diff)[0]

  const priorRounds = rounds.filter((r) => r.date < round.date)
  const records: { icon: string; label: string; value: string }[] = []
  const priorBest = priorRounds.length
    ? Math.min(...priorRounds.flatMap((r) => r.players.map((p) => playerTotal(p.strokes))))
    : Infinity
  if (best < priorBest) records.push({ icon: '🏆', label: '최저타 갱신', value: `${shortName(bestPlayer?.name ?? '')} ${best}타` })
  const priorBirdie = priorRounds.length ? Math.max(0, ...priorRounds.flatMap((r) => r.players.map((p) => holeStats(p.strokes, r.pars).birdie))) : 0
  if (birdieTop?.birdie > priorBirdie) records.push({ icon: '🟡', label: '버디왕 갱신', value: `${shortName(birdieTop.name)} ${birdieTop.birdie}개` })
  const priorPar = priorRounds.length ? Math.max(0, ...priorRounds.flatMap((r) => r.players.map((p) => holeStats(p.strokes, r.pars).par))) : 0
  if (parTop?.par > priorPar) records.push({ icon: '⛳', label: '파왕 갱신', value: `${shortName(parTop.name)} ${parTop.par}개` })
  if (records.length === 0) records.push({ icon: '✨', label: '라운드 기록', value: '새 기록 도전 완료' })


  const toggleFlip = async () => {
    const next = !flipped
    if (next && !detailRound) {
      const [full, snapshots, entries, draw, members, lottoConfig, schedules, awardConfig] = await Promise.all([
        getRound(round.id),
        getClubAwardSnapshots(round.id).catch(() => []),
        round.scheduleId ? getRoundLottoEntries(round.scheduleId).catch(() => []) : Promise.resolve([]),
        round.scheduleId ? getRoundLottoDraw(round.scheduleId).catch(() => null) : Promise.resolve(null),
        activeClub?.id ? getClubMembers(activeClub.id).catch(() => []) : Promise.resolve([]),
        activeClub?.id ? getClubLottoAwardConfig(activeClub.id).catch(() => DEFAULT_LOTTO_AWARD_CONFIG) : Promise.resolve(DEFAULT_LOTTO_AWARD_CONFIG),
        activeClub?.id ? getRoundSchedules(activeClub.id).catch(() => []) : Promise.resolve([]),
        activeClub?.id ? getClubAwardConfig(activeClub.id).catch(() => null) : Promise.resolve(null),
      ])
      if (full) setDetailRound(full)
      setAwardSnapshots(snapshots)
      setLottoEntries(entries)
      setLottoDraw(draw)
      setClubMembers(members)
      setLottoAwardConfig(lottoConfig)
      setRoundSchedules(schedules)
      setClubAwardConfig(awardConfig)
    }
    Animated.spring(flip, { toValue: next ? 1 : 0, friction: 8, tension: 72, useNativeDriver: true }).start()
    setFlipped(next)
  }
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] })
  const frontOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] })
  const backOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] })

  useEffect(() => {
    setPhotoData(round.photoData ?? [])
  }, [round.id, round.photoData])

  const handlePickRoundPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    })
    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    setPhotoCropSource({
      uri: asset.uri,
      width: asset.width || 1200,
      height: asset.height || 900,
    })
  }

  const saveRoundPhoto = async (crop: ImageCropRect) => {
    if (!photoCropSource) return
    setPhotoSaving(true)
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        photoCropSource.uri,
        [{ crop }, { resize: { width: 1200 } }],
        { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      )
      if (!compressed.base64) throw new Error('사진 처리에 실패했습니다.')

      const nextPhotoData = [`data:image/jpeg;base64,${compressed.base64}`, ...photoData].slice(0, 8)
      const updated = await updateRound(round.id, {
        courseName: round.courseName,
        date: round.date,
        pars: round.pars,
        players: round.players,
        photoData: nextPhotoData,
        settlement: round.settlement,
        golfCourseId: round.golfCourseId,
        holeLabels: round.holeLabels,
      })
      setPhotoData(updated.photoData ?? nextPhotoData)
      setDetailRound((current) => current ? { ...current, photoData: updated.photoData ?? nextPhotoData } : current)
      setPhotoCropSource(null)
    } catch (error) {
      Alert.alert('오류', error instanceof Error ? error.message : String(error))
    } finally {
      setPhotoSaving(false)
    }
  }

  const openRound = async () => {
    if (!round.isComplete) {
      const full = await getRound(round.id)
      if (full) nav.navigate('ScoreEntry', { date: full.date, courseName: full.courseName, pars: full.pars, golfCourseId: full.golfCourseId, players: full.players, editId: full.id, settlement: full.settlement })
      return
    }
    nav.navigate('RoundDetail', { id: round.id })
  }

  const detailPar = totalPar(effectiveRound.pars)
  const actualRegularRank = effectiveRound.players
    .map((p) => {
      const total = playerTotal(p.strokes)
      return { name: p.name, total, diff: total - detailPar }
    })
    .sort((a, b) => a.total - b.total)

  const hiddenHoles = effectiveRound.shinperioHoles.length
    ? effectiveRound.shinperioHoles
    : effectiveRound.pars.map((_, i) => i + 1)

  const shinRank = effectiveRound.players
    .map((p) => {
      const hiddenScore = hiddenHoles.reduce(
        (sum, hole) => sum + (p.strokes[hole - 1] ?? effectiveRound.pars[hole - 1] ?? 0),
        0,
      )
      const hiddenPar = hiddenHoles.reduce(
        (sum, hole) => sum + (effectiveRound.pars[hole - 1] ?? 0),
        0,
      )
      const scaledScore = hiddenHoles.length > 0
        ? hiddenScore * (effectiveRound.pars.length / hiddenHoles.length)
        : hiddenScore
      const scaledPar = hiddenHoles.length > 0
        ? hiddenPar * (effectiveRound.pars.length / hiddenHoles.length)
        : hiddenPar
      const handicap = Math.max(0, Math.round((scaledScore - scaledPar) * 0.8 * 10) / 10)
      const total = playerTotal(p.strokes)
      const net = Math.round((total - handicap) * 10) / 10
      return { name: p.name, total, handicap, net }
    })
    .sort((a, b) => a.net - b.net || a.total - b.total)

  const scoreRows = effectiveRound.players
    .map((p) => {
      const total = playerTotal(p.strokes)
      const stats = holeStats(p.strokes, effectiveRound.pars)
      return { name: p.name, total, diff: total - detailPar, stats }
    })
    .sort((a, b) => a.total - b.total)

  const scheduleAwardConfig = effectiveRound.scheduleId
    ? roundSchedules.find((item) => item.id === effectiveRound.scheduleId)?.awardConfig
    : null
  const effectiveAwardConfig = scheduleAwardConfig ?? clubAwardConfig
  const fallbackAwardRows = effectiveAwardConfig
    ? computeClubAwardResults(
        fillToCount(effectiveAwardConfig.items, effectiveAwardConfig.count),
        effectiveRound,
        getHandicapsForRound(effectiveRound, rounds, handicapBasis),
        detailPar,
      ).map((award) => ({
        icon: award.icon,
        label: award.label,
        winner: shortName(award.winner),
        detail: award.detail,
      }))
    : []
  const awardRows = awardSnapshots.length > 0
    ? awardSnapshots.map((award) => ({
        icon: award.icon,
        label: award.label,
        winner: shortName(award.winner),
        detail: award.detail,
      }))
    : fallbackAwardRows
  const lottoJackpot = lottoAwardConfig.prizes['6'] + (lottoAwardConfig.rollover ? lottoAwardConfig.carryoverAmount : 0)
  const lottoAwardRows = lottoEntries.map((entry) => {
    const member = clubMembers.find((item) => item.userId === entry.userId)
    const name = member?.name ?? '회원'
    const player = effectiveRound.players.find((item) => item.name === name)
    const selectedHoles = [
      ...entry.selectedHoles.par3,
      ...entry.selectedHoles.par4,
      ...entry.selectedHoles.par5,
    ].sort((a, b) => a - b)
    const hasScore = Boolean(player && lottoDraw?.drawStatus === 'COMPLETED' && lottoDraw.drawnScores)
    const hits = hasScore
      ? selectedHoles.filter((hole) => player!.strokes[hole - 1] === lottoDraw!.drawnScores?.[String(hole)]?.score).length
      : 0
    const prize = hasScore ? lottoPrizeForHits(hits, lottoAwardConfig, lottoJackpot) : 0
    return { name, hits, prize, hasScore }
  })
  const lottoAwardGroups = [3, 4, 5, 6]
    .map((hits) => ({
      hits,
      prize: hits === 6 ? lottoJackpot : lottoAwardConfig.prizes[String(hits) as '3' | '4' | '5'],
      names: lottoAwardRows
        .filter((row) => row.hasScore && row.hits === hits && row.prize > 0)
        .map((row) => shortName(row.name))
        .join(', '),
    }))
    .filter((group) => group.names)
  const moneyGame = effectiveRound.settlement ? calcSettlement(effectiveRound.settlement, effectiveRound.pars, effectiveRound.players) : null
  const moneyPairs = moneyGame
    ? moneyGame.participants.flatMap((from, i) => moneyGame.participants.slice(i + 1).map((to) => {
        const net = moneyGame.totals[from][to]
        if (net > 0) return { from, to, amount: net }
        if (net < 0) return { from: to, to: from, amount: -net }
        return { from, to, amount: 0 }
      }))
    : []

  const detailTabs: { key: RoundDetailTab; label: string }[] = [
    { key: 'regular', label: '정규' },
    { key: 'peoria', label: '신페리오' },
    { key: 'award', label: '시상' },
  ]

  return (
    <>
    <View style={[s.flipCardScene, { width, height }]}>
      <Animated.View pointerEvents={flipped ? 'none' : 'auto'} style={[s.flipFace, { opacity: frontOpacity, transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }]}>
        <TouchableOpacity activeOpacity={0.96} style={s.flipTouch} onPress={toggleFlip}>
          <View style={s.roundHero}>
            <ImageBackground source={coverPhoto ? { uri: coverPhoto } : getCourseHeroImageSource(round.courseName)} style={s.roundPhotoHeader} imageStyle={s.roundHeroImage}>
              <View style={s.roundHeroShade} />
              <View style={s.roundHeroTopRow}>
                <View style={s.roundCounter}><Text style={s.roundCounterText}>{index + 1} / {totalCount}</Text></View>
                <View style={{ alignItems: 'flex-end', gap: 7 }}>
                  <View style={round.isComplete ? s.heroCompleteBadge : s.heroProgressBadge}><Text style={s.heroStatusText}>{round.isComplete ? '라운드 완료' : '라운드 중'}</Text></View>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.84}
                disabled={photoSaving}
                onPress={(event) => {
                  event.stopPropagation()
                  handlePickRoundPhoto()
                }}
                style={s.roundPhotoButton}
              >
                {photoSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.roundPhotoButtonText}>{coverPhoto ? '사진 변경' : '사진 등록'}</Text>}
              </TouchableOpacity>
              <View style={s.heroCourseBlock}>
                <Text style={s.heroDate}>{round.date.replace(/-/g, '.')}</Text>
                <Text style={s.heroCourseName} numberOfLines={2}>{round.courseName}</Text>
              </View>
            </ImageBackground>
            <View style={s.roundSummaryBody}>
              <View style={s.heroSummaryPanel}>
                <SummaryCell icon="🏆" label={shortName(bestPlayer?.name ?? '메달')} value={String(best)} />
                <SummaryCell icon="🥇" label={shortName(winner?.name ?? '우승')} value={winner ? diffText(winner.net - par) : '-'} accent />
                <SummaryCell icon="🥈" label={shortName(runnerUp?.name ?? '준우승')} value={runnerUp ? diffText(runnerUp.net - par) : '-'} />
                <SummaryCell label="평균" value={String(avg)} />
              </View>
              <View style={s.heroInfoPanel}>
                <Text style={s.heroSectionTitle}>👑 기네스 북 갱신 현황</Text>
                <View style={s.recordGrid}>
                  {records.slice(0, 3).map((r, i) => <View key={`${r.label}-${i}`} style={s.recordMiniCard}><Text style={s.recordMiniIcon}>{r.icon}</Text><Text style={s.recordMiniLabel}>{r.label}</Text><Text style={s.recordMiniValue} numberOfLines={1}>{r.value}</Text></View>)}
                </View>
                <Text style={[s.heroSectionTitle, { marginTop: 7 }]}>⭐ 주요 하이라이트</Text>
                <View style={s.highlightRow}>
                  <Highlight icon="🏆" label="최다 버디" value={`${shortName(birdieTop?.name ?? '-')} ${birdieTop?.birdie ?? 0}개`} />
                  <Highlight icon="🎯" label="베스트 홀" value={bestHole ? `${bestHole.hole}번 ${bestHole.score}타` : '-'} />
                  <Highlight icon="⛳" label="파 세이브" value={`${shortName(parTop?.name ?? '-')} ${parTop?.par ?? 0}개`} />
                </View>
              </View>
              <Text style={s.flipHint}>탭하면 라운드 상세 보기 ↻</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View pointerEvents={flipped ? 'auto' : 'none'} style={[s.flipFace, s.flipBackFace, { opacity: backOpacity, transform: [{ perspective: 1200 }, { rotateY: backRotate }] }]}>
        <View style={s.backCard}>
          <View style={s.backHeader}>
            <TouchableOpacity onPress={toggleFlip} style={s.backIconBtn}><Text style={s.backIconText}>↻</Text></TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.backCourseName} numberOfLines={1}>{round.courseName}</Text>
              <Text style={s.backDate}>{round.date.replace(/-/g, '.')} · PAR {par} · 참가 {round.players.length}명</Text>
            </View>
            <TouchableOpacity onPress={openRound} style={s.detailOpenBtn}><Text style={s.detailOpenText}>전체 상세</Text></TouchableOpacity>
          </View>
          <View style={s.backTabs}>
            {detailTabs.map((item) => <TouchableOpacity key={item.key} style={[s.backTab, detailTab === item.key && s.backTabActive]} onPress={() => setDetailTab(item.key)}><Text style={[s.backTabText, detailTab === item.key && s.backTabTextActive]}>{item.label}</Text></TouchableOpacity>)}
          </View>
          <View style={s.backBody}>{!detailRound && <Text style={s.detailLoadingText}>라운드 상세 데이터를 불러오는 중입니다.</Text>}
            {detailTab === 'regular' && <View style={s.detailPanel}>
              <View style={s.detailTableHeader}><Text style={[s.detailTh,{width:34}]}>순위</Text><Text style={[s.detailTh,{flex:1}]}>이름</Text><Text style={[s.detailTh,{width:52,textAlign:'right'}]}>스코어</Text><Text style={[s.detailTh,{width:52,textAlign:'right'}]}>파대비</Text></View>
              {actualRegularRank.slice(0,7).map((row,i)=><View key={row.name} style={[s.detailTableRow,i<3&&s.detailPodiumRow]}><Text style={[s.detailRank,{width:34}]}>{i+1}</Text><Text style={s.detailPlayerName} numberOfLines={1}>{shortName(row.name)}</Text><Text style={s.detailScoreText}>{row.total}</Text><Text style={s.detailNetText}>{diffText(row.diff)}</Text></View>)}
            </View>}
            {detailTab === 'peoria' && <View style={s.detailPanel}><Text style={s.shinperioHoleText}>숨김홀 {hiddenHoles.join(', ')}</Text>
              <View style={s.detailTableHeader}><Text style={[s.detailTh,{width:34}]}>순위</Text><Text style={[s.detailTh,{flex:1}]}>이름</Text><Text style={[s.detailTh,{width:48,textAlign:'right'}]}>총타</Text><Text style={[s.detailTh,{width:48,textAlign:'right'}]}>핸디</Text><Text style={[s.detailTh,{width:48,textAlign:'right'}]}>NET</Text></View>
              {shinRank.slice(0,7).map((row,i)=><View key={row.name} style={[s.detailTableRow,i<3&&s.detailPodiumRow]}><Text style={[s.detailRank,{width:34}]}>{i+1}</Text><Text style={s.detailPlayerName} numberOfLines={1}>{shortName(row.name)}</Text><Text style={s.detailSmallScore}>{row.total}</Text><Text style={s.detailSmallScore}>{row.handicap.toFixed(1)}</Text><Text style={s.detailNetText}>{row.net.toFixed(1)}</Text></View>)}
            </View>}
            {detailTab === 'score' && <View style={s.detailPanel}><View style={s.scoreSummaryGrid}>{scoreRows.slice(0,6).map((row)=><View key={row.name} style={s.scoreSummaryCard}><View style={{flex:1,minWidth:0}}><Text style={s.scoreSummaryName} numberOfLines={1}>{shortName(row.name)}</Text><Text style={s.scoreSummarySub}>버디 {row.stats.birdie} · 파 {row.stats.par} · 보기 {row.stats.bogey}</Text></View><View style={{alignItems:'flex-end'}}><Text style={s.scoreSummaryTotal}>{row.total}</Text><Text style={s.scoreSummaryDiff}>{diffText(row.diff)}</Text></View></View>)}</View></View>}
            {detailTab === 'award' && <ScrollView style={s.backAwardScroll} contentContainerStyle={s.backAwardStack} showsVerticalScrollIndicator={false}>
              <AwardCard title="클럽 시상" icon="🏆">
                {awardRows.length === 0 ? (
                  <Text style={s.backAwardMuted}>설정된 시상 항목이 없습니다.</Text>
                ) : awardRows.map((award, i) => (
                  <AwardRow key={`${award.label}-${i}`} icon={award.icon} label={award.label} winner={award.winner} detail={award.detail} first={i === 0} />
                ))}
              </AwardCard>
              <AwardCard title="Lotto 6/18" icon="◎">
                {!effectiveRound.scheduleId ? (
                  <Text style={s.backAwardMuted}>라운드 일정 연결이 없습니다.</Text>
                ) : lottoEntries.length === 0 ? (
                  <Text style={s.backAwardMuted}>구매 내역이 없습니다.</Text>
                ) : lottoDraw?.drawStatus !== 'COMPLETED' ? (
                  <Text style={s.backAwardMuted}>추첨 완료 후 구매자별 적중 현황이 표시됩니다.</Text>
                ) : lottoAwardGroups.length === 0 ? (
                  <Text style={s.backAwardMuted}>시상 대상자가 없습니다.</Text>
                ) : lottoAwardGroups.map((group, i) => (
                  <View key={group.hits} style={[s.lottoAwardGroupRow, i === 0 && { borderTopWidth: 0 }]}>
                    <Text style={s.lottoAwardGroupText}>{group.hits}개 적중 시상금 {formatWon(group.prize)}</Text>
                    <Text style={s.lottoAwardGroupNames} numberOfLines={2}>{group.names}</Text>
                  </View>
                ))}
              </AwardCard>
              {effectiveRound.settlement ? (
                <>
                  <View style={s.backMoneySummary}>
                    <Text style={s.backAwardMuted}>타당 {effectiveRound.settlement.strokeFee.toLocaleString('ko-KR')}원 · 버디 {effectiveRound.settlement.birdieBonus.toLocaleString('ko-KR')}원 · 참가 {moneyGame?.participants.length ?? 0}명</Text>
                  </View>
                  <AwardCard title="머니게임">
                    {moneyPairs.length === 0 ? (
                      <Text style={s.backAwardMuted}>참가자 이름이 선수와 맞지 않습니다.</Text>
                    ) : moneyPairs.map((pair, i) => (
                      <View key={`${pair.from}-${pair.to}-${i}`} style={[s.moneyPairRow, i === 0 && { borderTopWidth: 0 }]}>
                        <Text style={s.moneyPairName}>{shortName(pair.from)}</Text>
                        <Text style={s.moneyPairArrow}>→</Text>
                        <Text style={s.moneyPairName}>{shortName(pair.to)}</Text>
                        <Text style={[s.moneyPairAmount, { color: pair.amount === 0 ? C.muted : C.text }]}>{pair.amount === 0 ? '동점' : fmtKRW(pair.amount)}</Text>
                      </View>
                    ))}
                  </AwardCard>
                </>
              ) : (
                <AwardCard title="머니게임">
                  <Text style={s.backAwardMuted}>이 라운드에는 정산 설정이 없습니다.</Text>
                </AwardCard>
              )}
            </ScrollView>}
          </View>
          <TouchableOpacity style={s.flipBackHint} onPress={toggleFlip}><Text style={s.flipBackHintText}>↻ 앞면 요약으로 돌아가기</Text></TouchableOpacity>
        </View>
      </Animated.View>
    </View>
    {photoCropSource ? (
      <ImageCropModal
        uri={photoCropSource.uri}
        width={photoCropSource.width}
        height={photoCropSource.height}
        aspect={[16, 10]}
        title="라운드 사진 맞추기"
        onCancel={() => setPhotoCropSource(null)}
        onConfirm={saveRoundPhoto}
      />
    ) : null}
    </>
  )

}

function SummaryCell({ icon, label, value, accent = false }: { icon?: string; label: string; value: string; accent?: boolean }) {
  return <View style={s.summaryCell}><Text style={s.summaryLabel}>{icon ? `${icon} ` : ''}{label}</Text><Text style={[s.summaryValue, accent && { color: '#52e39a' }]}>{value}</Text></View>
}
function Highlight({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <View style={s.highlightCard}><Text style={s.highlightIcon}>{icon}</Text><Text style={s.highlightLabel}>{label}</Text><Text style={s.highlightValue}>{value}</Text></View>
}
function RankingPanel({ title, rows }: { title: string; rows: { name: string; main: string; sub: string }[] }) {
  return <View style={s.detailPanel}><Text style={s.detailPanelTitle}>{title}</Text>{rows.map((row, i) => <View key={`${row.name}-${i}`} style={s.rankRow}><View style={[s.rankNo, i === 0 && s.rankNoFirst]}><Text style={[s.rankNoText, i === 0 && { color: '#fff' }]}>{i + 1}</Text></View><View style={{ flex: 1 }}><Text style={s.rankName}>{row.name}</Text><Text style={s.rankSub}>{row.sub}</Text></View><Text style={s.rankMain}>{row.main}</Text></View>)}</View>
}
function AwardCard({ title, icon, children }: { title: string; icon?: string; children: ReactNode }) {
  return <View style={s.backAwardCard}><View style={s.backAwardHeader}>{icon ? <Text style={s.backAwardHeaderIcon}>{icon}</Text> : null}<Text style={s.backAwardTitle}>{title}</Text></View>{children}</View>
}
function AwardRow({ icon, label, winner, detail, first = false }: { icon: string; label: string; winner: string; detail: string; first?: boolean }) {
  return <View style={[s.awardRow, first && { borderTopWidth: 0 }]}><View style={s.awardIconWrap}><Text style={s.awardIcon}>{icon}</Text></View><Text style={s.awardLabel}>{label}</Text><Text style={s.awardWinner} numberOfLines={1}>{winner}</Text><View style={s.awardDetailWrap}><Text style={s.awardDetail} numberOfLines={1}>{detail}</Text></View></View>
}

// ─── 개인별 ──────────────────────────────────────────────────────────────────

interface PlayerRound {
  roundId: string; date: string; courseName: string
  total: number; diff: number; strokes: number[]; pars: number[]
  front: number; back: number; birdie: number; parCount: number; bogey: number; double: number; triplePlus: number
}

function firLabel(value: PersonalRoundFir) {
  if (value === 'center') return '중앙'
  if (value === 'long') return '상'
  if (value === 'short') return '하'
  if (value === 'left_ob') return '좌 OB'
  if (value === 'right_ob') return '우 OB'
  if (value === 'other_ob') return '기타 OB'
  if (value === 'hazard') return '해저드'
  return '미입력'
}

function ByPlayer({ rounds, handicapBasis = 5, myName, myUserId }: { rounds: SavedRound[]; handicapBasis?: number; myName: string | null; myUserId: string | null }) {
  const [targetScore, setTargetScore] = useState('')
  const [detailModal, setDetailModal] = useState<'target' | 'trend' | 'hole' | 'score' | 'rank' | 'improve' | 'rounds' | 'shot' | null>(null)
  const [personalStatsBySchedule, setPersonalStatsBySchedule] = useState<Record<string, PersonalRoundHoleStat[]>>({})
  const [memberNamesBySchedule, setMemberNamesBySchedule] = useState<Record<string, string>>({})
  const byName = new Map<string, PlayerRound[]>()

  for (const r of rounds) {
    const coursePar = totalPar(r.pars)
    for (const p of r.players) {
      const total = playerTotal(p.strokes)
      const stats = holeStats(p.strokes, r.pars)
      const arr = byName.get(p.name) ?? []
      arr.push({
        roundId: r.id,
        date: r.date,
        courseName: r.courseName,
        total,
        diff: total - coursePar,
        strokes: p.strokes,
        pars: r.pars,
        front: p.strokes.slice(0, 9).reduce((sum, score) => sum + score, 0),
        back: p.strokes.slice(9, 18).reduce((sum, score) => sum + score, 0),
        birdie: stats.birdie,
        parCount: stats.par,
        bogey: stats.bogey,
        double: stats.dbl,
        triplePlus: stats.dblPlus,
      })
      byName.set(p.name, arr)
    }
  }

  const allScheduleIds = Array.from(new Set(rounds.map((round) => round.scheduleId).filter((id): id is string => !!id)))

  useEffect(() => {
    if (!myUserId || allScheduleIds.length === 0) {
      setMemberNamesBySchedule({})
      return
    }

    let cancelled = false
    supabase
      .from('club_round_group_members')
      .select('schedule_id, member_name')
      .eq('member_user_id', myUserId)
      .in('schedule_id', allScheduleIds)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setMemberNamesBySchedule({})
          return
        }

        const next: Record<string, string> = {}
        ;(data ?? []).forEach((item) => {
          if (item.schedule_id && item.member_name) next[item.schedule_id] = item.member_name
        })
        setMemberNamesBySchedule(next)
      })

    return () => { cancelled = true }
  }, [myUserId, allScheduleIds.join('|')])

  const scheduleMemberNames = Array.from(new Set(Object.values(memberNamesBySchedule).filter(Boolean)))
  const personalPlayerName = resolvePersonalPlayerName(myName, byName, scheduleMemberNames)
  const playerRounds = personalPlayerName ? [...(byName.get(personalPlayerName) ?? [])].sort((a, b) => b.date.localeCompare(a.date)) : []
  const scheduleIds = playerRounds
    .map((round) => rounds.find((item) => item.id === round.roundId)?.scheduleId)
    .filter((id): id is string => !!id)

  useEffect(() => {
    if (!myUserId || scheduleIds.length === 0) {
      setPersonalStatsBySchedule({})
      return
    }
    let cancelled = false
    Promise.all(scheduleIds.map(async (scheduleId) => {
      const item = await getPersonalRoundStat(scheduleId, myUserId)
      return [scheduleId, item?.holeStats ?? []] as const
    }))
      .then((items) => {
        if (!cancelled) setPersonalStatsBySchedule(Object.fromEntries(items))
      })
      .catch(() => {
        if (!cancelled) setPersonalStatsBySchedule({})
      })
    return () => { cancelled = true }
  }, [myUserId, scheduleIds.join('|')])

  if (!personalPlayerName || playerRounds.length === 0) return <Text style={s.muted}>내 개인 기록 데이터가 없습니다.</Text>

  const totals = playerRounds.map((round) => round.total)
  const avg = Math.ceil(totals.reduce((sum, total) => sum + total, 0) / totals.length)
  const best = Math.min(...totals)
  const lastN = [...playerRounds].sort((a, b) => a.date.localeCompare(b.date)).slice(-handicapBasis)
  const handicap = Math.ceil(lastN.reduce((sum, round) => sum + round.diff, 0) / lastN.length)
  const recent5 = playerRounds.slice(0, 5)
  const recent5Avg = Math.ceil(recent5.reduce((sum, round) => sum + round.total, 0) / recent5.length)
  const oldestRecent = recent5[recent5.length - 1]
  const latestRecent = recent5[0]
  const trendText = oldestRecent && latestRecent
    ? latestRecent.total < oldestRecent.total
      ? `최근 흐름이 ${oldestRecent.total - latestRecent.total}타 개선됐습니다.`
      : latestRecent.total > oldestRecent.total
        ? `최근 흐름이 ${latestRecent.total - oldestRecent.total}타 높아졌습니다.`
        : '최근 흐름이 안정적으로 유지되고 있습니다.'
    : '최근 흐름을 분석할 기록이 부족합니다.'
  const parType = { 3: { total: 0, count: 0 }, 4: { total: 0, count: 0 }, 5: { total: 0, count: 0 } }
  const scoreTotals = { birdie: 0, par: 0, bogey: 0, double: 0, triplePlus: 0 }
  let frontTotal = 0, backTotal = 0
  for (const round of playerRounds) {
    round.strokes.forEach((score, index) => {
      const par = round.pars[index] as 3 | 4 | 5
      if (parType[par]) {
        parType[par].total += score
        parType[par].count += 1
      }
    })
    scoreTotals.birdie += round.birdie
    scoreTotals.par += round.parCount
    scoreTotals.bogey += round.bogey
    scoreTotals.double += round.double
    scoreTotals.triplePlus += round.triplePlus
    frontTotal += round.front
    backTotal += round.back
  }
  const avgParType = (par: 3 | 4 | 5) => parType[par].count ? (parType[par].total / parType[par].count).toFixed(1) : '-'
  const frontAvg = Math.round(frontTotal / playerRounds.length)
  const backAvg = Math.round(backTotal / playerRounds.length)
  const parAverages = [
    { label: 'Par 3', value: Number(avgParType(3)) },
    { label: 'Par 4', value: Number(avgParType(4)) },
    { label: 'Par 5', value: Number(avgParType(5)) },
  ].filter((item) => !Number.isNaN(item.value))
  const strength = [...parAverages].sort((a, b) => a.value - b.value)[0]
  const weakness = [...parAverages].sort((a, b) => b.value - a.value)[0]
  const playerStats = [...byName.entries()].map(([name, list]) => {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    const playerTotals = sorted.map((round) => round.total)
    const playerLastN = sorted.slice(-handicapBasis)
    return {
      name,
      avg: Math.ceil(playerTotals.reduce((sum, total) => sum + total, 0) / playerTotals.length),
      handicap: Math.ceil(playerLastN.reduce((sum, round) => sum + round.diff, 0) / playerLastN.length),
      birdie: sorted.reduce((sum, round) => sum + round.birdie, 0),
    }
  })
  const rankOf = (items: typeof playerStats, key: 'avg' | 'handicap' | 'birdie', lowerBetter: boolean) => {
    const sorted = [...items].sort((a, b) => lowerBetter ? a[key] - b[key] : b[key] - a[key])
    return sorted.findIndex((item) => item.name === personalPlayerName) + 1
  }
  const totalPlayers = playerStats.length
  const target = Number(targetScore.replace(/[^0-9]/g, ''))
  const targetGap = target ? avg - target : 0
  const personalHoleStats = scheduleIds.flatMap((scheduleId) => personalStatsBySchedule[scheduleId] ?? [])
  const personalHoleStatsWithScore = scheduleIds.flatMap((scheduleId) => {
    const round = rounds.find((item) => item.scheduleId === scheduleId)
    const playerRound = round ? playerRounds.find((item) => item.roundId === round.id) : null
    return (personalStatsBySchedule[scheduleId] ?? []).map((item) => ({
      ...item,
      score: playerRound?.strokes[item.hole - 1] ?? null,
    }))
  })
  const firTargets = personalHoleStats.filter((item) => item.par !== 3)
  const firSuccess = firTargets.filter((item) => !item.fir || item.fir === 'center').length
  const firRate = firTargets.length ? Math.round((firSuccess / firTargets.length) * 100) : null
  const girTargets = personalHoleStatsWithScore.filter((item) => item.score !== null && item.putts > 0)
  const girSuccess = girTargets.filter((item) => item.score !== null && item.score - item.putts <= item.par - 2).length
  const girRate = girTargets.length ? Math.round((girSuccess / girTargets.length) * 100) : null
  const obCount = personalHoleStats.filter((item) => item.fir === 'left_ob' || item.fir === 'right_ob' || item.fir === 'other_ob').length
  const hazardCount = personalHoleStats.filter((item) => item.fir === 'hazard').length
  const avgPutts = personalHoleStats.length ? (personalHoleStats.reduce((sum, item) => sum + item.putts, 0) / personalHoleStats.length).toFixed(1) : '-'
  const threePuttCount = personalHoleStats.filter((item) => item.putts >= 3).length
  const penaltyTotal = personalHoleStats.reduce((sum, item) => sum + item.penalties, 0)
  const firCounts = new Map<PersonalRoundFir, number>()
  for (const item of personalHoleStats) if (item.fir) firCounts.set(item.fir, (firCounts.get(item.fir) ?? 0) + 1)
  const mainMiss = [...firCounts.entries()].filter(([key]) => key !== 'center').sort((a, b) => b[1] - a[1])[0]
  const mainMissText = mainMiss ? firLabel(mainMiss[0]) : '미입력'
  const roundsOldToNew = [...playerRounds].sort((a, b) => a.date.localeCompare(b.date))
  const trendRounds = roundsOldToNew.slice(-6)
  const trendWithStats = trendRounds.map((round) => {
    const scheduleId = rounds.find((item) => item.id === round.roundId)?.scheduleId
    const holeStats = scheduleId ? personalStatsBySchedule[scheduleId] ?? [] : []
    const holeStatsWithScore = holeStats.map((item) => ({ ...item, score: round.strokes[item.hole - 1] ?? null }))
    const roundFirTargets = holeStats.filter((item) => item.par !== 3)
    const roundGirTargets = holeStatsWithScore.filter((item) => item.score !== null && item.putts > 0)
    return {
      round,
      fir: roundFirTargets.length ? Math.round((roundFirTargets.filter((item) => !item.fir || item.fir === 'center').length / roundFirTargets.length) * 100) : null,
      gir: roundGirTargets.length ? Math.round((roundGirTargets.filter((item) => item.score !== null && item.score - item.putts <= item.par - 2).length / roundGirTargets.length) * 100) : null,
      putts: holeStats.length ? Number((holeStats.reduce((sum, item) => sum + item.putts, 0) / holeStats.length).toFixed(1)) : null,
    }
  })
  const toTrendData = <T extends { round: PlayerRound }>(items: T[], valueOf: (item: T) => number | null) => (
    items.map((item) => {
      const value = valueOf(item)
      return value === null ? null : { date: item.round.date, value }
    }).filter((item): item is { date: string; value: number } => !!item)
  )
  const puttTrendData = toTrendData(trendWithStats, (item) => item.putts)
  const obDistributionData = [
    { label: '좌 OB', value: firCounts.get('left_ob') ?? 0 },
    { label: '우 OB', value: firCounts.get('right_ob') ?? 0 },
    { label: '기타 OB', value: firCounts.get('other_ob') ?? 0 },
    { label: '해저드', value: firCounts.get('hazard') ?? 0 },
  ]
  const parRadarData = ([3, 4, 5] as const).map((par) => ({ label: `Par ${par}`, value: Number(avgParType(par)) })).filter((item) => !Number.isNaN(item.value))
  const scoreDistributionData = [
    { label: '버디', value: scoreTotals.birdie, color: C.info },
    { label: '파', value: scoreTotals.par, color: C.green },
    { label: '보기', value: scoreTotals.bogey, color: C.warn },
    { label: '더블+', value: scoreTotals.double + scoreTotals.triplePlus, color: C.danger },
  ]
  const scoreStackData = trendRounds.map((round) => ({
    date: round.date,
    birdie: round.birdie,
    par: round.parCount,
    bogey: round.bogey,
    doublePlus: round.double + round.triplePlus,
  }))
  const aiComments = [
    recent5Avg < avg
      ? `최근 5경기 평균이 전체 평균보다 ${avg - recent5Avg}타 낮아져 흐름이 좋습니다.`
      : recent5Avg > avg
        ? `최근 5경기 평균이 전체 평균보다 ${recent5Avg - avg}타 높아졌습니다.`
        : '최근 5경기 평균이 전체 평균과 비슷하게 유지되고 있습니다.',
    backAvg > frontAvg
      ? `후반이 전반보다 ${backAvg - frontAvg}타 높아 후반 집중 관리가 필요합니다.`
      : backAvg < frontAvg
        ? `후반이 전반보다 ${frontAvg - backAvg}타 낮아 마무리 흐름이 좋습니다.`
        : '전후반 타수 균형이 안정적입니다.',
    scoreTotals.double + scoreTotals.triplePlus > playerRounds.length * 3
      ? '더블 이상 홀이 많은 편이라 큰 실수를 줄이는 전략이 효과적입니다.'
      : '더블 이상 관리가 비교적 안정적입니다.',
  ]
  const improvementItems = [
    `1순위: ${weakness?.label ?? '취약 홀'}에서 안전한 공략으로 평균 타수를 낮추기`,
    `2순위: 후반 평균 ${backAvg}타를 전반 평균 ${frontAvg}타에 가깝게 만들기`,
    `3순위: 더블/트리플+ ${scoreTotals.double + scoreTotals.triplePlus}개를 줄이기`,
  ]

  const modalTitle = detailModal === 'target' ? '목표 설정'
    : detailModal === 'trend' ? '추이 분석'
      : detailModal === 'hole' ? '홀 유형별 평균'
        : detailModal === 'score' ? '스코어 분포'
          : detailModal === 'rank' ? '클럽 내 순위'
            : detailModal === 'improve' ? '개선 리포트'
              : detailModal === 'shot' ? '샷/퍼팅 분석'
                : '라운드별 상세'

  const reportCardWidth = Math.min(270, Math.max(224, Dimensions.get('window').width * 0.64))
  const personalReportCards = [
    { key: 'target', icon: '🎯', title: '목표 설정', subtitle: `${targetScore || '100'}타 목표 관리`, modal: 'target' },
    { key: 'trend', icon: '📈', title: '스코어 추이', subtitle: `최근5 평균 ${recent5Avg}타`, modal: 'trend' },
    { key: 'shot', icon: '🏌️', title: '샷·퍼팅', subtitle: `FIR ${firRate === null ? '-' : `${firRate}%`} · 퍼팅 ${avgPutts === '-' ? '-' : `${avgPutts}개`}`, modal: 'shot' },
    { key: 'hole', icon: '⛳', title: '홀 유형', subtitle: weakness ? `${weakness.label} 보완 필요` : 'Par3/4/5 분석', modal: 'hole' },
    { key: 'score', icon: '📊', title: '스코어 분포', subtitle: `Par ${scoreTotals.par} · Bogey ${scoreTotals.bogey}`, modal: 'score' },
    { key: 'rank', icon: '🏆', title: '클럽 순위', subtitle: `${playerStats.length}명 비교`, modal: 'rank' },
    { key: 'rounds', icon: '📖', title: '라운드 상세', subtitle: `${playerRounds.length}경기 기록`, modal: 'rounds' },
    { key: 'improve', icon: '🤖', title: '개선 리포트', subtitle: `OB ${obCount}회 · 패널티 ${penaltyTotal}개`, modal: 'improve' },
  ] as const


  return (
    <>
      {detailModal && (
        <Modal transparent animationType="fade" onRequestClose={() => setDetailModal(null)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setDetailModal(null)}>
            <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{modalTitle}</Text>
                <TouchableOpacity style={s.closeBtn} onPress={() => setDetailModal(null)}><Text style={s.closeBtnText}>닫기</Text></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {detailModal === 'target' && (
                  <>
                    <View style={s.goalRow}>
                      <TextInput
                        style={s.goalInput}
                        value={targetScore}
                        onChangeText={(value) => setTargetScore(value.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder={`${Math.max(1, avg - 3)}`}
                        placeholderTextColor={C.muted}
                      />
                      <Text style={s.goalUnit}>타 목표</Text>
                    </View>
                    <Text style={s.insightText}>
                      {target ? (targetGap > 0 ? `현재 평균에서 ${targetGap}타를 줄이면 목표에 도달합니다.` : '현재 평균이 목표 수준에 도달했습니다.') : '목표 타수를 입력하면 현재 평균과 비교합니다.'}
                    </Text>
                  </>
                )}
                {detailModal === 'trend' && (
                  <>
                    <Text style={s.insightText}>{trendText}</Text>
                    <View style={s.miniTrendRow}>
                      {[...playerRounds].sort((a, b) => a.date.localeCompare(b.date)).slice(-6).map((round) => (
                        <View key={round.roundId} style={s.miniTrendItem}>
                          <Text style={s.miniTrendValue}>{round.total}</Text>
                          <View style={[s.miniTrendBar, { height: Math.max(18, 72 - (round.total - best) * 2) }]} />
                          <Text style={s.miniTrendDate}>{round.date.slice(5)}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>최근 5경기 평균</Text><Text style={s.analysisValue}>{recent5Avg}타</Text></View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>전후반 차이</Text><Text style={s.analysisValue}>{diffText(backAvg - frontAvg)}타</Text></View>
                  </>
                )}
                {detailModal === 'hole' && (
                  <>
                    <RadarChart data={parRadarData} />
                    <View style={s.metricGrid}>
                      <MetricCard label="Par 3" value={`${avgParType(3)}타`} />
                      <MetricCard label="Par 4" value={`${avgParType(4)}타`} />
                      <MetricCard label="Par 5" value={`${avgParType(5)}타`} />
                    </View>
                    {strength && weakness && <Text style={s.insightText}>강점은 {strength.label}, 보완 포인트는 {weakness.label}입니다.</Text>}
                  </>
                )}
                {detailModal === 'score' && (
                  <>
                    <ScoreDonut data={scoreDistributionData} />
                    <StackedScoreBars data={scoreStackData} />
                    <View style={s.scoreDistRow}>
                      <ScoreDist label="버디" value={scoreTotals.birdie} color={C.info} />
                      <ScoreDist label="파" value={scoreTotals.par} color={C.green} />
                      <ScoreDist label="보기" value={scoreTotals.bogey} color={C.warn} />
                      <ScoreDist label="더블" value={scoreTotals.double} color={C.danger} />
                      <ScoreDist label="트리플+" value={scoreTotals.triplePlus} color={C.text} />
                    </View>
                  </>
                )}
                {detailModal === 'rank' && (
                  <>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>평균 순위</Text><Text style={s.analysisValue}>{rankOf(playerStats, 'avg', true)} / {totalPlayers}</Text></View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>핸디 순위</Text><Text style={s.analysisValue}>{rankOf(playerStats, 'handicap', true)} / {totalPlayers}</Text></View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>버디 순위</Text><Text style={s.analysisValue}>{rankOf(playerStats, 'birdie', false)} / {totalPlayers}</Text></View>
                  </>
                )}
                {detailModal === 'shot' && (
                  <>
                    <View style={s.gaugeRow}>
                      <DonutGauge label="FIR" value={firRate} />
                      <DonutGauge label="GIR" value={girRate} />
                    </View>
                    <PuttBars data={puttTrendData} />
                    <ObDistribution data={obDistributionData} />
                    <View style={s.metricGrid}>
                      <MetricCard label="FIR 성공률" value={firRate === null ? '-' : `${firRate}%`} />
                      <MetricCard label="GIR 성공률" value={girRate === null ? '-' : `${girRate}%`} />
                      <MetricCard label="평균 퍼팅" value={avgPutts === '-' ? '-' : `${avgPutts}개`} />
                      <MetricCard label="OB/해저드" value={`${obCount}/${hazardCount}`} />
                      <MetricCard label="패널티" value={`${penaltyTotal}개`} />
                    </View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>주요 미스</Text><Text style={s.analysisValue}>{mainMissText}</Text></View>
                    <View style={s.analysisRow}><Text style={s.analysisLabel}>3퍼트 이상</Text><Text style={s.analysisValue}>{threePuttCount}회</Text></View>
                    <Text style={s.insightText}>OB와 해저드는 티샷 리스크, 3퍼트는 그린 위 손실로 나눠 관리하면 개선 포인트가 더 선명해집니다.</Text>
                  </>
                )}
                {detailModal === 'improve' && improvementItems.map((item) => (
                  <BulletText key={item} text={item} />
                ))}
                {detailModal === 'rounds' && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      <View style={s.tableHeader}>
                        {['날짜', '코스', '총타', '파대비', '전반', '후반', 'B/P/Bg/D/T+'].map((header, index) => (
                          <Text key={header} style={[s.th, { width: [54, 82, 42, 52, 42, 42, 92][index], textAlign: index >= 2 ? 'right' : 'left' }]}>{header}</Text>
                        ))}
                      </View>
                      {playerRounds.map((round) => (
                        <View key={round.roundId} style={s.tableRow}>
                          <Text style={[s.td, { width: 54 }]}>{round.date.slice(5)}</Text>
                          <Text style={[s.td, { width: 82 }]} numberOfLines={1}>{round.courseName.slice(0, 7)}</Text>
                          <Text style={[s.td, { width: 42, textAlign: 'right', fontWeight: '700' }]}>{round.total}</Text>
                          <Text style={[s.td, { width: 52, textAlign: 'right', color: round.diff <= 0 ? C.green : C.warn }]}>{diffText(round.diff)}</Text>
                          <Text style={[s.td, { width: 42, textAlign: 'right' }]}>{round.front}</Text>
                          <Text style={[s.td, { width: 42, textAlign: 'right' }]}>{round.back}</Text>
                          <Text style={[s.td, { width: 92, textAlign: 'right' }]}>{round.birdie}/{round.parCount}/{round.bogey}/{round.double}/{round.triplePlus}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <View style={s.aiCaddieCard}>
        <View style={s.aiCaddieHeader}>
          <View style={s.aiCaddieIconWrap}>
            <Text style={s.aiCaddieIcon}>🤖</Text>
          </View>
          <View style={s.aiCaddieTitleBlock}>
            <Text style={s.aiCaddieEyebrow}>AI Caddie</Text>
            <Text style={s.aiCaddieTitle}>개인 기록 분석</Text>
          </View>
        </View>

        <View style={s.aiCaddieInsightBox}>
          <Text style={s.aiCaddieLead}>{trendText}</Text>
          {aiComments.slice(0, 3).map((comment) => (
            <View key={comment} style={s.aiCaddieBulletRow}>
              <Text style={s.aiCaddieBulletDot}>•</Text>
              <Text style={s.aiCaddieBulletText}>{comment}</Text>
            </View>
          ))}
        </View>

        <View style={s.aiCaddieRecommendRow}>
          <Text style={s.aiCaddieRecommendLabel}>추천</Text>
          <Text style={s.aiCaddieRecommendText} numberOfLines={2}>
            {weakness ? `${weakness.label} 공략을 안정적으로 가져가면 평균 스코어 개선 여지가 큽니다.` : '최근 라운드 패턴을 더 쌓으면 맞춤 개선 포인트를 제안할게요.'}
          </Text>
        </View>
      </View>

      <View style={s.personalReportSection}>
        <View style={s.personalReportHeader}>
          <View>
            <Text style={s.personalReportEyebrow}>Personal Report</Text>
            <Text style={s.personalReportTitle}>개인 리포트</Text>
          </View>
          <Text style={s.personalReportHint}>좌우로 넘겨보기</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={reportCardWidth + 10}
          contentContainerStyle={s.personalReportCarousel}
        >
          {personalReportCards.map((card) => (
            <TouchableOpacity
              key={card.key}
              activeOpacity={0.88}
              style={[s.personalReportCard, { width: reportCardWidth }]}
              onPress={() => setDetailModal(card.modal)}
            >
              <View style={s.personalReportIconWrap}>
                <Text style={s.personalReportIcon}>{card.icon}</Text>
              </View>
              <Text style={s.personalReportCardTitle}>{card.title}</Text>
              <Text style={s.personalReportCardSubtitle} numberOfLines={2}>{card.subtitle}</Text>
              <Text style={s.personalReportCardAction}>자세히 보기 ›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={s.metricCard}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  )
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.compactMetric}>
      <Text style={s.compactMetricLabel}>{label}</Text>
      <Text style={s.compactMetricValue}>{value}</Text>
    </View>
  )
}

function CompactActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.compactActionButton} activeOpacity={0.82} onPress={onPress}>
      <Text style={s.compactActionText}>{label}</Text>
      <Text style={s.compactActionArrow}>›</Text>
    </TouchableOpacity>
  )
}

function DonutGauge({ label, value }: { label: string; value: number | null }) {
  const size = 104
  const radius = 34
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, value ?? 0))
  return (
    <View style={s.gaugeCard}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={radius} stroke={C.border} strokeWidth={11} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={C.green}
          strokeWidth={11}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * progress) / 100},${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <SvgText x={center} y={center - 4} textAnchor="middle" fontSize={12} fontWeight="800" fill={C.muted}>{label}</SvgText>
        <SvgText x={center} y={center + 18} textAnchor="middle" fontSize={18} fontWeight="900" fill={C.text}>{value === null ? '-' : `${value}%`}</SvgText>
      </Svg>
    </View>
  )
}

function PuttBars({ data }: { data: { date: string; value: number }[] }) {
  const max = Math.max(4, ...data.map((item) => item.value))
  return (
    <View style={s.visualCard}>
      <View style={s.visualHeader}><Text style={s.visualTitle}>퍼팅 추세</Text><Text style={s.visualValue}>{data.length ? `${data[data.length - 1].value}개` : '-'}</Text></View>
      <View style={s.puttBarRow}>
        {data.length === 0 ? <Text style={s.visualEmpty}>추세 데이터가 없습니다.</Text> : data.map((item) => (
          <View key={item.date} style={s.puttBarItem}>
            <Text style={s.puttBarValue}>{item.value}</Text>
            <View style={[s.puttBar, { height: Math.max(12, (item.value / max) * 58) }]} />
            <Text style={s.puttBarDate}>{item.date.slice(5)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function ObDistribution({ data }: { data: { label: string; value: number }[] }) {
  return (
    <View style={s.visualCard}>
      <View style={s.visualHeader}><Text style={s.visualTitle}>OB/해저드 분포</Text><Text style={s.visualValue}>{data.reduce((sum, item) => sum + item.value, 0)}회</Text></View>
      <View style={s.obGrid}>
        {data.map((item) => (
          <View key={item.label} style={s.obCell}>
            <Text style={s.obLabel}>{item.label}</Text>
            <Text style={s.obValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function RadarChart({ data }: { data: { label: string; value: number }[] }) {
  const size = 190
  const center = size / 2
  const radius = 58
  const values = data.map((item) => item.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const normalized = (value: number) => max === min ? 0.72 : 0.35 + ((max - value) / (max - min)) * 0.5
  const point = (index: number, ratio: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / data.length
    return { x: center + Math.cos(angle) * radius * ratio, y: center + Math.sin(angle) * radius * ratio }
  }
  const outerPoints = data.map((_, index) => point(index, 1)).map((p) => `${p.x},${p.y}`).join(' ')
  const valuePoints = data.map((item, index) => point(index, normalized(item.value))).map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <View style={s.visualCard}>
      <View style={s.visualHeader}><Text style={s.visualTitle}>홀 유형 밸런스</Text><Text style={s.visualValue}>낮을수록 강점</Text></View>
      {data.length < 3 ? <Text style={s.visualEmpty}>분석 데이터가 부족합니다.</Text> : (
        <Svg width={size} height={size}>
          <Polygon points={outerPoints} fill="none" stroke={C.border} strokeWidth={1} />
          <Polygon points={valuePoints} fill="rgba(32, 160, 91, 0.18)" stroke={C.green} strokeWidth={2} />
          {data.map((item, index) => {
            const p = point(index, 1.24)
            const dot = point(index, normalized(item.value))
            return (
              <G key={item.label}>
                <Line x1={center} y1={center} x2={point(index, 1).x} y2={point(index, 1).y} stroke={C.border} strokeWidth={1} />
                <Circle cx={dot.x} cy={dot.y} r={3} fill={C.green} />
                <SvgText x={p.x} y={p.y + 4} textAnchor="middle" fontSize={10} fontWeight="800" fill={C.muted}>{item.label}</SvgText>
                <SvgText x={p.x} y={p.y + 18} textAnchor="middle" fontSize={10} fill={C.text}>{item.value.toFixed(1)}</SvgText>
              </G>
            )
          })}
        </Svg>
      )}
    </View>
  )
}

function ScoreDonut({ data }: { data: { label: string; value: number; color: string }[] }) {
  const size = 156
  const center = size / 2
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const total = data.reduce((sum, item) => sum + item.value, 0)
  let offset = 0
  return (
    <View style={s.visualCard}>
      <View style={s.visualHeader}><Text style={s.visualTitle}>스코어 구성</Text><Text style={s.visualValue}>{total}홀</Text></View>
      {total === 0 ? <Text style={s.visualEmpty}>스코어 데이터가 없습니다.</Text> : (
        <View style={s.donutRow}>
          <Svg width={size} height={size}>
            <Circle cx={center} cy={center} r={radius} stroke={C.border} strokeWidth={18} fill="none" />
            {data.map((item) => {
              const dash = (item.value / total) * circumference
              const segment = (
                <Circle
                  key={item.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={item.color}
                  strokeWidth={18}
                  fill="none"
                  strokeDasharray={`${dash},${circumference}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${center} ${center})`}
                />
              )
              offset += dash
              return segment
            })}
            <SvgText x={center} y={center - 2} textAnchor="middle" fontSize={13} fontWeight="900" fill={C.text}>총 {total}</SvgText>
            <SvgText x={center} y={center + 16} textAnchor="middle" fontSize={10} fill={C.muted}>holes</SvgText>
          </Svg>
          <View style={s.donutLegend}>
            {data.map((item) => (
              <View key={item.label} style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: item.color }]} />
                <Text style={s.legendLabel}>{item.label}</Text>
                <Text style={s.legendValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

function StackedScoreBars({ data }: { data: { date: string; birdie: number; par: number; bogey: number; doublePlus: number }[] }) {
  return (
    <View style={s.visualCard}>
      <View style={s.visualHeader}><Text style={s.visualTitle}>최근 라운드 구성</Text><Text style={s.visualValue}>스택</Text></View>
      {data.length === 0 ? <Text style={s.visualEmpty}>추세 데이터가 없습니다.</Text> : data.map((item) => {
        const total = Math.max(1, item.birdie + item.par + item.bogey + item.doublePlus)
        return (
          <View key={item.date} style={s.stackRow}>
            <Text style={s.stackDate}>{item.date.slice(5)}</Text>
            <View style={s.stackTrack}>
              <View style={[s.stackSeg, { flex: item.birdie, backgroundColor: C.info }]} />
              <View style={[s.stackSeg, { flex: item.par, backgroundColor: C.green }]} />
              <View style={[s.stackSeg, { flex: item.bogey, backgroundColor: C.warn }]} />
              <View style={[s.stackSeg, { flex: item.doublePlus, backgroundColor: C.danger }]} />
              {total === 1 && item.birdie + item.par + item.bogey + item.doublePlus === 0 && <View style={[s.stackSeg, { flex: 1, backgroundColor: C.border }]} />}
            </View>
          </View>
        )
      })}
    </View>
  )
}

function ScoreDist({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.scoreDistItem}>
      <Text style={[s.scoreDistValue, { color }]}>{value}</Text>
      <Text style={s.scoreDistLabel}>{label}</Text>
    </View>
  )
}

function BulletText({ text }: { text: string }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  )
}

function DetailButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.detailButton} activeOpacity={0.82} onPress={onPress}>
      <Text style={s.detailButtonText}>{label}</Text>
      <Text style={s.detailButtonArrow}>›</Text>
    </TouchableOpacity>
  )
}

// ─── 클럽 전체 ───────────────────────────────────────────────────────────────

function Club({ rounds, handicapBasis: currentHandicapBasis }: { rounds: SavedRound[]; handicapBasis: HandicapBasis }) {
  const [showChart, setShowChart] = useState<'avg' | 'best' | false>(false)
  const [handicapBasis, setHandicapBasis] = useState<HandicapBasis>(currentHandicapBasis)
  const [showBasisDropdown, setShowBasisDropdown] = useState(false)
  useEffect(() => {
    setHandicapBasis(currentHandicapBasis)
  }, [currentHandicapBasis])

  if (rounds.length === 0) return <Text style={s.muted}>데이터가 없습니다.</Text>

  let bestRecord: { name: string; date: string; courseName: string; total: number } | null = null
  for (const r of rounds)
    for (const p of r.players) {
      const t = playerTotal(p.strokes)
      if (!bestRecord || t < bestRecord.total)
        bestRecord = { name: p.name, date: r.date, courseName: r.courseName, total: t }
    }

  const byName = new Map<string, Array<{ date: string; total: number; par: number }>>()
  for (const r of rounds) {
    const par = totalPar(r.pars)
    for (const p of r.players) {
      const arr = byName.get(p.name) ?? []
      arr.push({ date: r.date, total: playerTotal(p.strokes), par })
      byName.set(p.name, arr)
    }
  }

  const stats = Array.from(byName.entries())
    .map(([name, entries]) => {
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
      const totals = sorted.map((e) => e.total)
      const lastN = sorted.slice(-handicapBasis)
      const handicap = Math.ceil(lastN.reduce((sum, e) => sum + (e.total - e.par), 0) / lastN.length)
      return {
        name, rounds: totals.length,
        avg: Math.ceil(totals.reduce((a, b) => a + b, 0) / totals.length),
        worst: Math.max(...totals),
        best: Math.min(...totals),
        handicap,
      }
    })
    .sort((a, b) => a.avg - b.avg)

  const totalAttendance = rounds.reduce((sum, r) => sum + r.players.length, 0)
  const clubAvg = Math.ceil(
    stats.reduce((a, st) => a + st.avg * st.rounds, 0) /
    stats.reduce((a, st) => a + st.rounds, 0)
  )

  const roundAvgs = [...rounds]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date,
      value: Math.ceil(r.players.reduce((sum, p) => sum + playerTotal(p.strokes), 0) / r.players.length),
    }))

  const bestByRound = [...rounds]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date,
      value: Math.min(...r.players.map((p) => playerTotal(p.strokes))),
    }))

  return (
    <>
      {showChart === 'avg' && (
        <TrendModal title="클럽 평균 추이" data={roundAvgs} onClose={() => setShowChart(false)} />
      )}
      {showChart === 'best' && (
        <TrendModal title="최저타 추이" data={bestByRound} onClose={() => setShowChart(false)} />
      )}

      <View style={s.card}>
        <Text style={s.cardTitle}>통합 통계</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* 총 라운드 */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>{rounds.length}</Text>
            <Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>총 라운드</Text>
          </View>
          {/* 연인원 */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>{totalAttendance}</Text>
            <Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>연인원</Text>
          </View>
          {/* 클럽 평균 */}
          <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => setShowChart('avg')}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: C.green }}>{clubAvg}</Text>
            <Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>클럽 평균</Text>
          </TouchableOpacity>
          {/* 최저타 */}
          {bestRecord && (
            <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => setShowChart('best')}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>{bestRecord.total}</Text>
              <Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>최저타</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, zIndex: 99 }}>
          <Text style={[s.cardTitle, { marginBottom: 0 }]}>클럽 랭킹</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 99 }}>
            <Text style={{ fontSize: 12, color: C.muted, fontWeight: '600' }}>핸디</Text>
            <View>
              <TouchableOpacity
                onPress={() => setShowBasisDropdown(v => !v)}
                style={s.dropdownTrigger}
              >
                <Text style={s.dropdownTriggerText}>{handicapBasis}경기 ▾</Text>
              </TouchableOpacity>
              {showBasisDropdown && (
                <View style={s.dropdownMenu}>
                  {([3, 5, 10] as const).map((n) => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => { setHandicapBasis(n); setShowBasisDropdown(false) }}
                      style={s.dropdownItem}
                    >
                      <Text style={[s.dropdownItemText, handicapBasis === n && s.dropdownItemActive]}>
                        {n}경기{handicapBasis === n ? ' ✓' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={s.tableHeader}>
          <Text style={[s.th, { flex: 0.6 }]}>순위</Text>
          <Text style={[s.th, { flex: 2 }]}>이름</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>경기</Text>
          <Text style={[s.th, { flex: 1.2, textAlign: 'center' }]}>평균</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>최고</Text>
          <Text style={[s.th, { flex: 1, textAlign: 'center' }]}>최저</Text>
          <Text style={[s.th, { flex: 1.2, textAlign: 'center' }]}>핸디</Text>
        </View>
        {stats.map((stat, i) => {
          const medalBg = ['#fffbe8', '#f4f6f8', '#fdf5f0']
          const isMedal = i < 3
          return (
            <View key={stat.name} style={[s.tableRow, { alignItems: 'center' }, i < 3 && { backgroundColor: medalBg[i], borderRadius: 8, marginBottom: 2 }]}>
              <View style={{ flex: 0.6, alignItems: 'center' }}>{isMedal ? <EmojiIcon char={['🥇','🥈','🥉'][i]} size={17} /> : <Text style={[s.td, { fontSize: 13 }]}>{i + 1}</Text>}</View>
              <Text style={[s.td, { flex: 2, fontWeight: i < 3 ? '700' : '400' }]}>{shortName(stat.name)}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{stat.rounds}</Text>
              <Text style={[s.td, { flex: 1.2, textAlign: 'center', fontWeight: '700', color: i === 0 ? C.gold : C.text }]}>{stat.avg}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{stat.worst}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{stat.best}</Text>
              <Text style={[s.td, {
                flex: 1.2, textAlign: 'center', fontWeight: '600',
                color: stat.handicap > 0 ? C.warn : stat.handicap < 0 ? C.info : C.text,
              }]}>
                {stat.handicap > 0 ? `+${stat.handicap}` : `${stat.handicap}`}
              </Text>
            </View>
          )
        })}
      </View>
    </>
  )
}

// ─── 기네스 북 ─────────────────────────────────────────────────────────────

function HallOfFame({ rounds, handicapBasis }: { rounds: SavedRound[]; handicapBasis: number }) {
  const [rankingType, setRankingType] = useState<RankingType | null>(null)

  if (rounds.length === 0) return <Text style={s.muted}>기네스 북 데이터가 없습니다.</Text>

  const avgOf = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  const handicaps = computeHandicaps(rounds, handicapBasis)
  const sortedRounds = [...rounds].sort((a, b) => a.date.localeCompare(b.date))
  const winCount = new Map<string, number>()
  for (const r of sortedRounds) {
    const w = getWinnerLocal(r, getHandicapsForRound(r, rounds, handicapBasis))
    if (w) winCount.set(w, (winCount.get(w) ?? 0) + 1)
  }
  const winRanking = [...winCount.entries()].map(([name, wins]) => ({ name, wins })).sort((a, b) => b.wins - a.wins)

  let maxStreak = 0, maxStreakPlayer = '', curStreak = 0, curPlayer = ''
  for (const r of sortedRounds) {
    const w = getWinnerLocal(r, getHandicapsForRound(r, rounds, handicapBasis))
    if (w && w === curPlayer) curStreak++
    else {
      if (curStreak > maxStreak) { maxStreak = curStreak; maxStreakPlayer = curPlayer }
      curPlayer = w ?? ''; curStreak = w ? 1 : 0
    }
  }
  if (curStreak > maxStreak) { maxStreak = curStreak; maxStreakPlayer = curPlayer }

  const birdieCount = new Map<string, number>()
  const singleBirdieMap = new Map<string, { count: number; date: string; courseName: string }>()
  const singleParMap = new Map<string, { count: number; date: string; courseName: string }>()
  const scoreRecords: { name: string; total: number; date: string; courseName: string }[] = []
  for (const r of rounds) {
    for (const p of r.players) {
      let b = 0
      let parCount = 0
      p.strokes.forEach((strokes, i) => {
        const diff = strokes - r.pars[i]
        if (diff <= -1) b++
        if (diff === 0) parCount++
      })
      birdieCount.set(p.name, (birdieCount.get(p.name) ?? 0) + b)
      const prev = singleBirdieMap.get(p.name)
      if (!prev || b > prev.count) singleBirdieMap.set(p.name, { count: b, date: r.date, courseName: r.courseName })
      const prevPar = singleParMap.get(p.name)
      if (!prevPar || parCount > prevPar.count) singleParMap.set(p.name, { count: parCount, date: r.date, courseName: r.courseName })
      scoreRecords.push({ name: p.name, total: playerTotal(p.strokes), date: r.date, courseName: r.courseName })
    }
  }
  const birdieRanking = [...birdieCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  const singleBirdieRanking = [...singleBirdieMap.entries()].map(([name, v]) => ({ name, ...v })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count)
  const singleParRanking = [...singleParMap.entries()].map(([name, v]) => ({ name, ...v })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count)
  const handicapRanking = [...handicaps.entries()].sort((a, b) => a[1] - b[1]).map(([name, handicap]) => ({ name, handicap }))
  const lowestScoreRanking = [...scoreRecords].sort((a, b) => a.total - b.total)
  const highestScoreRanking = [...scoreRecords].sort((a, b) => b.total - a.total)

  const playerRounds = new Map<string, { date: string; total: number; diff: number }[]>()
  const frontBackRanking: { name: string; improvement: number; front: number; back: number; date: string; courseName: string }[] = []
  for (const r of rounds) {
    const coursePar = totalPar(r.pars)
    for (const p of r.players) {
      const total = playerTotal(p.strokes)
      const list = playerRounds.get(p.name) ?? []
      list.push({ date: r.date, total, diff: total - coursePar })
      playerRounds.set(p.name, list)

      const front = p.strokes.slice(0, 9).reduce((sum, score) => sum + score, 0)
      const back = p.strokes.slice(9, 18).reduce((sum, score) => sum + score, 0)
      frontBackRanking.push({ name: p.name, improvement: front - back, front, back, date: r.date, courseName: r.courseName })
    }
  }
  const frontBackImprovementRanking = frontBackRanking.filter((r) => r.improvement > 0).sort((a, b) => b.improvement - a.improvement)

  const avgImproveRanking = [...playerRounds.entries()]
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
      if (sorted.length < 10) return null
      const past7 = sorted.slice(-10, -3).map((r) => r.total)
      const recent3 = sorted.slice(-3).map((r) => r.total)
      const pastAvg = Math.round(avgOf(past7))
      const recentAvg = Math.round(avgOf(recent3))
      return { name, improvement: pastAvg - recentAvg, pastAvg, recentAvg }
    })
    .filter((row): row is { name: string; improvement: number; pastAvg: number; recentAvg: number } => row !== null)
    .filter((row) => row.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement)

  const handicapImproveRanking = [...playerRounds.entries()]
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
      if (sorted.length < handicapBasis * 2) return null
      const pastHandicap = Math.ceil(avgOf(sorted.slice(0, handicapBasis).map((r) => r.diff)))
      const recentHandicap = Math.ceil(avgOf(sorted.slice(-handicapBasis).map((r) => r.diff)))
      return { name, improvement: pastHandicap - recentHandicap, pastHandicap, recentHandicap }
    })
    .filter((row): row is { name: string; improvement: number; pastHandicap: number; recentHandicap: number } => row !== null)
    .filter((row) => row.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement)

  const topWinner = winRanking[0]
  const mostWinsText = topWinner ? formatWinners(winRanking.filter((r) => r.wins === topWinner.wins).map((r) => r.name), `${topWinner.wins}회`) : '-'
  const lowestHandicapEntry = handicapRanking[0]
  const lowestHandiText = lowestHandicapEntry ? formatWinners(handicapRanking.filter((r) => r.handicap === lowestHandicapEntry.handicap).map((r) => r.name), diffText(lowestHandicapEntry.handicap)) : '-'
  const topBirdie = birdieRanking[0]
  const topBirdieText = topBirdie && topBirdie.count > 0 ? formatWinners(birdieRanking.filter((r) => r.count === topBirdie.count).map((r) => r.name), `${topBirdie.count}개`) : '-'
  const topSingleBirdie = singleBirdieRanking[0]
  const topSingleBirdieText = topSingleBirdie ? formatWinners(singleBirdieRanking.filter((r) => r.count === topSingleBirdie.count).map((r) => r.name), `${topSingleBirdie.count}개`) : '-'
  const topSinglePar = singleParRanking[0]
  const topSingleParText = topSinglePar ? formatWinners(singleParRanking.filter((r) => r.count === topSinglePar.count).map((r) => r.name), `${topSinglePar.count}개`) : '-'
  const topRoundsPlayed = [...playerRounds.entries()].map(([name, list]) => ({ name, count: list.length })).sort((a, b) => b.count - a.count)[0]
  const roundsPlayedText = topRoundsPlayed ? formatWinners([...playerRounds.entries()].filter(([, list]) => list.length === topRoundsPlayed.count).map(([name]) => name), `${topRoundsPlayed.count}회`) : '-'
  const topLowestScore = lowestScoreRanking[0]
  const lowestScoreText = topLowestScore ? formatWinners(lowestScoreRanking.filter((r) => r.total === topLowestScore.total).map((r) => r.name), `${topLowestScore.total}타`) : '-'
  const topHighestScore = highestScoreRanking[0]
  const highestScoreText = topHighestScore ? formatWinners(highestScoreRanking.filter((r) => r.total === topHighestScore.total).map((r) => r.name), `${topHighestScore.total}타`) : '-'
  const topFrontBack = frontBackImprovementRanking[0]
  const topFrontBackText = topFrontBack ? `${shortName(topFrontBack.name)} (${topFrontBack.improvement}타 개선)` : '-'
  const topAvgImprove = avgImproveRanking[0]
  const topAvgImproveText = topAvgImprove && topAvgImprove.improvement > 0 ? `${shortName(topAvgImprove.name)} (${topAvgImprove.improvement}타 개선)` : '-'
  const topHandicapImprove = handicapImproveRanking[0]
  const topHandicapImproveText = topHandicapImprove && topHandicapImprove.improvement > 0 ? `${shortName(topHandicapImprove.name)} (${topHandicapImprove.improvement}타 개선)` : '-'

  const rankingConfig: Record<RankingType, { title: string; col: string; rows: { name: string; value: string; sub?: string }[] }> = {
    wins: { title: '최다 우승', col: '우승 횟수', rows: winRanking.map((r) => ({ name: shortName(r.name), value: `${r.wins}회` })) },
    streak: { title: '최다 연속 우승', col: '연속', rows: maxStreak > 0 ? [{ name: shortName(maxStreakPlayer), value: `${maxStreak}연승` }] : [] },
    lowestHandicap: { title: `핸디캡 랭킹 (최근 ${handicapBasis}경기)`, col: '핸디', rows: handicapRanking.map((r) => ({ name: shortName(r.name), value: diffText(r.handicap) })) },
    birdie: { title: '버디왕 (전체)', col: '버디 수', rows: birdieRanking.map((r) => ({ name: shortName(r.name), value: `${r.count}개` })) },
    singleBirdie: { title: '버디왕 (1경기)', col: '버디 수', rows: singleBirdieRanking.map((r) => ({ name: shortName(r.name), value: `${r.count}개`, sub: `${r.date.slice(5)} ${r.courseName}` })) },
    singlePar: { title: '파왕 (1경기)', col: '파 수', rows: singleParRanking.map((r) => ({ name: shortName(r.name), value: `${r.count}개`, sub: `${r.date.slice(5)} ${r.courseName}` })) },
    roundsPlayed: { title: '최다 라운드 참가', col: '참가', rows: [...playerRounds.entries()].map(([name, list]) => ({ name: shortName(name), value: `${list.length}회` })).sort((a, b) => Number(b.value.replace('회', '')) - Number(a.value.replace('회', ''))) },
    lowestScore: { title: '최저타', col: '스코어', rows: lowestScoreRanking.map((r) => ({ name: shortName(r.name), value: `${r.total}타`, sub: `${r.date.slice(5)} ${r.courseName}` })) },
    highestScore: { title: '최고타', col: '스코어', rows: highestScoreRanking.map((r) => ({ name: shortName(r.name), value: `${r.total}타`, sub: `${r.date.slice(5)} ${r.courseName}` })) },
    frontBack: {
      title: '전반 대비 후반 개선 최대',
      col: '개선',
      rows: frontBackImprovementRanking.map((r) => ({ name: shortName(r.name), value: `${r.improvement}타`, sub: `${r.date.slice(5)} ${r.courseName} · 전반 ${r.front} / 후반 ${r.back}` })),
    },
    avgImprove: {
      title: '최대 평균타 개선',
      col: '개선',
      rows: avgImproveRanking.map((r) => ({ name: shortName(r.name), value: `${r.improvement}타`, sub: `과거7 ${r.pastAvg}타 → 최근3 ${r.recentAvg}타` })),
    },
    handicapImprove: {
      title: '최대 핸디 개선',
      col: '개선',
      rows: handicapImproveRanking.map((r) => ({ name: shortName(r.name), value: `${r.improvement}타`, sub: `초기 ${diffText(r.pastHandicap)} → 최근 ${diffText(r.recentHandicap)}` })),
    },
  }
  const highlightSections = [
    {
      title: '우승 기록',
      items: [
        { icon: '🏅', label: '최다 우승', value: mostWinsText, type: 'wins' as RankingType },
        { icon: '🔥', label: '최다 연속 우승', value: maxStreak > 0 ? `${shortName(maxStreakPlayer)} (${maxStreak}연승)` : '-', type: 'streak' as RankingType },
      ],
    },
    {
      title: '스코어 기록',
      items: [
        { icon: '🏆', label: '최저타', value: lowestScoreText, type: 'lowestScore' as RankingType },
        { icon: '📈', label: '최고타', value: highestScoreText, type: 'highestScore' as RankingType },
        { icon: '🐦', label: '버디왕 (전체)', value: topBirdieText, type: 'birdie' as RankingType },
        { icon: '⛳', label: '버디왕 (1경기)', value: topSingleBirdieText, type: 'singleBirdie' as RankingType },
        { icon: '◎', label: '파왕 (1경기)', value: topSingleParText, type: 'singlePar' as RankingType },
      ],
    },
    {
      title: '성장 기록',
      items: [
        { icon: '📉', label: '최저 핸디', value: lowestHandiText, type: 'lowestHandicap' as RankingType },
        { icon: '↘️', label: '전후반 개선', value: topFrontBackText, type: 'frontBack' as RankingType },
        { icon: '📊', label: '평균타 개선', value: topAvgImproveText, type: 'avgImprove' as RankingType },
        { icon: '🪄', label: '핸디 개선', value: topHandicapImproveText, type: 'handicapImprove' as RankingType },
      ],
    },
    {
      title: '참가 기록',
      items: [
        { icon: '🗓️', label: '최다 라운드 참가', value: roundsPlayedText, type: 'roundsPlayed' as RankingType },
      ],
    },
  ]

  return (
    <>
      {rankingType && <RankingModal config={rankingConfig[rankingType]} onClose={() => setRankingType(null)} />}
      <View style={s.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <Icon name="trophy" size={16} color={C.text} />
          <Text style={[s.cardTitle, { marginBottom: 0 }]}>기네스 북</Text>
        </View>
        {highlightSections.map((section) => (
          <View key={section.title} style={s.hallSection}>
            <Text style={s.hallSectionTitle}>{section.title}</Text>
            {section.items.map(({ icon, label, value, type }) => (
              <TouchableOpacity key={label} style={s.hallRow} onPress={() => setRankingType(type)}>
                <View style={s.hallIconWrap}><EmojiIcon char={icon} size={15} color={C.green} /></View>
                <Text style={s.hallLabel}>{label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={s.hallValue}>{value}</Text>
                  <Text style={{ color: C.muted, fontSize: 16 }}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </>
  )
}

function RankingModal({ config, onClose }: {
  config: { title: string; col: string; rows: { name: string; value: string; sub?: string }[] }
  onClose: () => void
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{config.title}</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}><Text style={s.closeBtnText}>닫기</Text></TouchableOpacity>
          </View>
          <ScrollView>
            <View style={s.tableHeader}>
              <Text style={[s.th, { flex: 0.6 }]}>순위</Text>
              <Text style={[s.th, { flex: 2.5 }]}>플레이어</Text>
              <Text style={[s.th, { flex: 1.5, textAlign: 'right' }]}>{config.col}</Text>
            </View>
            {config.rows.length === 0 ? (
              <Text style={[s.muted, { padding: 16, textAlign: 'center' }]}>데이터 없음</Text>
            ) : config.rows.map((row, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={[s.td, { flex: 0.6, textAlign: 'center' }]}>{i + 1}</Text>
                <View style={{ flex: 2.5 }}>
                  <Text style={[s.td, { fontWeight: i < 3 ? '700' : '500' }]}>{row.name}</Text>
                  {row.sub && <Text style={{ fontSize: 11, color: C.muted }}>{row.sub}</Text>}
                </View>
                <Text style={[s.td, { flex: 1.5, textAlign: 'right', fontWeight: '700' }]}>{row.value}</Text>
              </View>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ─── SVG 추이 모달 ───────────────────────────────────────────────────────────

function TrendModal({ title, data, onClose }: {
  title: string; data: { date: string; value: number }[]; onClose: () => void
}) {
  if (data.length === 0) return null

  const W = Dimensions.get('window').width * 0.88 - 40
  const H = 130
  const PAD = { t: 20, r: 12, b: 30, l: 40 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b

  const vals = data.map((d) => d.value)
  const minV = Math.min(...vals) - 3
  const maxV = Math.max(...vals) + 3
  const span = maxV - minV

  const cx = (i: number) => PAD.l + (data.length > 1 ? i / (data.length - 1) : 0.5) * chartW
  const cy = (v: number) => PAD.t + (1 - (v - minV) / span) * chartH
  const polyPoints = data.map((d, i) => `${cx(i)},${cy(d.value)}`).join(' ')

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{title}</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
          <Svg width={W} height={H}>
            {[0, 0.5, 1].map((t, idx) => {
              const yv = PAD.t + t * chartH
              const label = String(Math.round(maxV - t * span))
              return (
                <G key={idx}>
                  <Line x1={PAD.l} y1={yv} x2={W - PAD.r} y2={yv} stroke={C.border} strokeWidth={0.8} />
                  <SvgText x={PAD.l - 4} y={yv + 4} textAnchor="end" fontSize={9} fill="#888">{label}</SvgText>
                </G>
              )
            })}
            {data.length > 1 && (
              <Polyline fill="none" stroke={C.green} strokeWidth={2} strokeLinejoin="round" points={polyPoints} />
            )}
            {data.map((d, i) => (
              <G key={i}>
                <Circle cx={cx(i)} cy={cy(d.value)} r={3} fill={C.green} />
                <SvgText x={cx(i)} y={cy(d.value) - 6} textAnchor="middle" fontSize={8} fill="#333">
                  {String(d.value)}
                </SvgText>
                <SvgText x={cx(i)} y={H - 4} textAnchor="middle" fontSize={8} fill="#888">
                  {d.date.slice(5)}
                </SvgText>
              </G>
            ))}
          </Svg>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  topActions: {
    backgroundColor: C.greenDark,
    paddingBottom: 12,
  },
  appHeader: { backgroundColor: C.greenDark, paddingBottom: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  profileBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  profileInitial: { color: '#fff', fontSize: 16, fontWeight: '900' },
  tabs: { flexDirection: 'row', backgroundColor: C.greenLight, marginHorizontal: 12, marginTop: 8, marginBottom: 0, borderRadius: 50, padding: 3 },
  tab: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 50 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
  tabText: { fontSize: 13, color: C.muted, fontWeight: '500' },
  tabTextActive: { color: C.green, fontWeight: '700' },
  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#1a6b44', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },
  aiCaddieCard: {
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(32,160,91,0.18)',
    shadowColor: '#1a6b44',
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  aiCaddieHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  aiCaddieIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  aiCaddieIcon: { fontSize: 20, lineHeight: 24 },
  aiCaddieTitleBlock: { flex: 1, minWidth: 0 },
  aiCaddieEyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '900', color: C.green, letterSpacing: 0.2 },
  aiCaddieTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginTop: 1 },
  aiCaddieInsightBox: {
    borderRadius: 16,
    backgroundColor: C.greenLight,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  aiCaddieLead: { fontSize: 14, lineHeight: 20, fontWeight: '900', color: C.text, marginBottom: 9, letterSpacing: -0.25 },
  aiCaddieBulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 5 },
  aiCaddieBulletDot: { width: 12, fontSize: 13, lineHeight: 19, color: C.green, fontWeight: '900' },
  aiCaddieBulletText: { flex: 1, fontSize: 12, lineHeight: 19, color: C.muted, fontWeight: '800' },
  aiCaddieRecommendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginTop: 13,
    paddingTop: 12,
  },
  aiCaddieRecommendLabel: {
    width: 44,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
    color: C.green,
  },
  aiCaddieRecommendText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '800', color: C.text },
  roundCarouselWrap: { marginHorizontal: -16 },
  roundCarouselContent: { paddingHorizontal: 16, gap: 12 },
  roundSwipeHint: { textAlign: 'center', marginTop: 10, fontSize: 11, fontWeight: '700', color: C.muted },
  flipCardScene: { position: 'relative' },
  flipFace: { position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden' },
  flipBackFace: { backfaceVisibility: 'hidden' },
  flipTouch: { flex: 1 },
  roundHero: { flex: 1, borderRadius: 26, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  roundPhotoHeader: { height: 218, padding: 14, justifyContent: 'space-between', alignItems: 'stretch' },
  roundHeroImage: { borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  roundHeroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,30,18,0.34)' },
  roundHeroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  roundCounter: { backgroundColor: 'rgba(7,22,18,0.58)', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
  roundCounterText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  roundPhotoButton: { position: 'absolute', right: 14, bottom: 14, minWidth: 78, minHeight: 31, borderRadius: 16, backgroundColor: 'rgba(7,22,18,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11 },
  roundPhotoButtonText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  roundSummaryBody: { flex: 1, padding: 14, gap: 10, justifyContent: 'space-between' },
  heroCompleteBadge: { backgroundColor: 'rgba(237,248,242,0.9)', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
  heroProgressBadge: { backgroundColor: 'rgba(27,158,94,0.92)', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
  heroStatusText: { color: '#173c2b', fontSize: 12, fontWeight: '800' },
  heroDate: { color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: '800', textAlign: 'left', textShadowColor: 'rgba(0,0,0,0.36)', textShadowRadius: 5 },
  heroCourseBlock: { alignItems: 'flex-start' },
  heroCourseName: { color: '#fff', fontSize: 25, lineHeight: 30, fontWeight: '900', textAlign: 'left', textShadowColor: 'rgba(0,0,0,0.38)', textShadowRadius: 7 },
  heroSummaryPanel: { flexDirection: 'row', backgroundColor: C.greenLight, borderWidth: 1, borderColor: C.border, borderRadius: 17, paddingVertical: 9 },
  summaryCell: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: C.border },
  summaryLabel: { color: C.muted, fontSize: 10, fontWeight: '800' },
  summaryValue: { color: C.text, fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 5 },
  heroInfoPanel: { backgroundColor: '#f8faf8', borderWidth: 1, borderColor: C.border, borderRadius: 17, padding: 9 },
  heroSectionTitle: { color: C.text, fontSize: 14, fontWeight: '900' },
  recordGrid: { flexDirection: 'row', gap: 6, marginTop: 8 },
  recordMiniCard: { flex: 1, minHeight: 58, borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, padding: 7, alignItems: 'center', justifyContent: 'center' },
  recordMiniIcon: { fontSize: 16 },
  recordMiniLabel: { fontSize: 9, color: C.muted, fontWeight: '800', textAlign: 'center', marginTop: 3 },
  recordMiniValue: { fontSize: 10, color: C.text, fontWeight: '900', textAlign: 'center', marginTop: 3 },
  highlightRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  highlightCard: { flex: 1, minHeight: 54, borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', padding: 7 },
  highlightIcon: { fontSize: 15 },
  highlightLabel: { color: C.muted, fontSize: 9, fontWeight: '800', marginTop: 3 },
  highlightValue: { color: C.text, fontSize: 11, fontWeight: '900', textAlign: 'center', marginTop: 3 },
  flipHint: { color: C.muted, textAlign: 'center', fontSize: 10, fontWeight: '800' },
  backCard: { flex: 1, backgroundColor: '#fff', borderRadius: 26, padding: 13, shadowColor: '#163d2b', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 7 },
  backHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  backIconText: { fontSize: 23, color: C.text, fontWeight: '600' },
  backCourseName: { fontSize: 20, fontWeight: '900', color: C.text },
  backDate: { fontSize: 11, color: C.muted, fontWeight: '700', marginTop: 2 },
  detailOpenBtn: { borderRadius: 14, backgroundColor: C.greenLight, paddingHorizontal: 10, paddingVertical: 7 },
  detailOpenText: { fontSize: 11, fontWeight: '900', color: C.green },
  backTabs: { flexDirection: 'row', backgroundColor: '#f3f5f4', borderRadius: 16, padding: 4, marginBottom: 12 },
  backTab: { flex: 1, minHeight: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  backTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 },
  backTabText: { color: C.muted, fontSize: 12, fontWeight: '800' },
  backTabTextActive: { color: C.green, fontWeight: '900' },
  backBody: { flex: 1 },
  detailPanel: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 10 },
  detailPanelTitle: { fontSize: 15, fontWeight: '900', color: C.text, marginBottom: 10 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 58, borderTopWidth: 1, borderTopColor: '#eef1ef' },
  rankNo: { width: 29, height: 29, borderRadius: 15, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  rankNoFirst: { backgroundColor: C.green },
  rankNoText: { fontSize: 12, fontWeight: '900', color: C.green },
  rankName: { fontSize: 13, fontWeight: '900', color: C.text },
  rankSub: { fontSize: 10, color: C.muted, marginTop: 2 },
  rankMain: { fontSize: 16, fontWeight: '900', color: C.green },
  scorePlayerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 45, borderTopWidth: 1, borderTopColor: '#eef1ef' },
  scorePlayerName: { flex: 1, fontSize: 13, fontWeight: '900', color: C.text },
  scorePlayerTotal: { fontSize: 15, fontWeight: '900', color: C.text },
  scorePlayerDiff: { width: 48, textAlign: 'right', fontSize: 12, fontWeight: '900', color: C.green },
  scoreMiniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 12 },
  scoreHoleCell: { width: '10.3%', minHeight: 38, borderRadius: 8, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  scoreHoleNo: { fontSize: 9, fontWeight: '900', color: C.text },
  scoreHolePar: { fontSize: 8, color: C.muted, marginTop: 2 },
  backAwardScroll: { flex: 1 },
  backAwardStack: { gap: 10, paddingBottom: 8 },
  backAwardCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 10 },
  backAwardHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  backAwardHeaderIcon: { fontSize: 16 },
  backAwardTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  backAwardMuted: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: C.muted },
  backMoneySummary: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  awardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderTopWidth: 1, borderTopColor: '#eef1ef' },
  awardIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fffbe8', borderWidth: 1, borderColor: '#f0e0a0', alignItems: 'center', justifyContent: 'center' },
  awardIcon: { fontSize: 19 },
  awardLabel: { width: 64, fontSize: 12, color: C.muted, fontWeight: '800' },
  awardWinner: { flex: 1, fontSize: 14, color: C.text, fontWeight: '900' },
  awardDetailWrap: { borderRadius: 12, backgroundColor: C.greenLight, paddingHorizontal: 9, paddingVertical: 5, maxWidth: 82 },
  awardDetail: { fontSize: 12, color: C.green, fontWeight: '900' },
  lottoAwardGroupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42, borderTopWidth: 1, borderTopColor: '#eef1ef' },
  lottoAwardGroupText: { flex: 1.35, fontSize: 12, lineHeight: 17, fontWeight: '900', color: C.text },
  lottoAwardGroupNames: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '800', color: C.green, textAlign: 'right' },
  moneyPairRow: { flexDirection: 'row', alignItems: 'center', minHeight: 38, borderTopWidth: 1, borderTopColor: '#eef1ef' },
  moneyPairName: { width: 48, fontSize: 13, fontWeight: '900', color: C.text },
  moneyPairArrow: { width: 22, fontSize: 13, color: C.muted, textAlign: 'center' },
  moneyPairAmount: { marginLeft: 'auto', fontSize: 13, fontWeight: '900' },
  flipBackHint: { minHeight: 38, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  flipBackHintText: { fontSize: 11, fontWeight: '800', color: C.muted },
  roundDetailPreview: { flex: 1, gap: 10 },
  previewSection: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 12 },
  previewSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  previewSectionTitle: { fontSize: 14, fontWeight: '900', color: C.text, marginBottom: 8 },
  previewSectionMeta: { fontSize: 11, fontWeight: '800', color: C.green },
  previewMetricRow: { flexDirection: 'row', gap: 8 },
  previewMetricCard: { flex: 1, minHeight: 74, borderRadius: 13, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', padding: 8 },
  previewMetricLabel: { fontSize: 9, color: C.muted, fontWeight: '800' },
  previewMetricValue: { fontSize: 14, color: C.text, fontWeight: '900', marginTop: 4 },
  previewMetricSub: { fontSize: 10, color: C.green, fontWeight: '900', marginTop: 2 },
  previewPlayerRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#edf1ee' },
  previewRankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  previewRankBadgeFirst: { backgroundColor: C.green },
  previewRankText: { fontSize: 11, color: C.green, fontWeight: '900' },
  previewPlayerName: { fontSize: 13, color: C.text, fontWeight: '900' },
  previewPlayerSub: { fontSize: 9, color: C.muted, marginTop: 2 },
  previewPlayerTotal: { fontSize: 14, color: C.text, fontWeight: '900' },
  previewPlayerDiff: { fontSize: 10, color: C.green, fontWeight: '900', marginTop: 2 },
  previewScoreRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#edf1ee' },
  previewScoreLabel: { minHeight: 28, paddingHorizontal: 4, textAlignVertical: 'center', fontSize: 9, color: C.muted, fontWeight: '900' },
  previewScoreCell: { width: 28, minHeight: 28, textAlign: 'center', textAlignVertical: 'center', fontSize: 9, color: C.text },
  detailLoadingText: { fontSize: 11, color: C.muted, textAlign: 'center', marginBottom: 6 },
  shinperioHoleText: { fontSize: 10, color: C.muted, fontWeight: '700', marginBottom: 7 },
  detailTableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: C.border },
  detailTableRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#edf1ee', paddingHorizontal: 4 },
  detailPodiumRow: { backgroundColor: 'rgba(32,160,91,0.06)', borderRadius: 10 },
  detailTh: { fontSize: 10, fontWeight: '800', color: C.muted },
  detailRank: { fontSize: 12, fontWeight: '900', color: C.muted, textAlign: 'center' },
  detailPlayerName: { flex: 1, fontSize: 13, fontWeight: '900', color: C.text },
  detailScoreText: { width: 52, textAlign: 'right', fontSize: 14, fontWeight: '900', color: C.text },
  detailSmallScore: { width: 48, textAlign: 'right', fontSize: 12, fontWeight: '800', color: C.text },
  detailNetText: { width: 52, textAlign: 'right', fontSize: 14, fontWeight: '900', color: C.green },
  scoreSummaryGrid: { gap: 6 },
  scoreSummaryCard: { minHeight: 52, borderRadius: 12, backgroundColor: C.greenLight, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center' },
  scoreSummaryName: { fontSize: 13, fontWeight: '900', color: C.text },
  scoreSummarySub: { fontSize: 9, color: C.muted, marginTop: 2 },
  scoreSummaryTotal: { fontSize: 17, fontWeight: '900', color: C.text },
  scoreSummaryDiff: { fontSize: 10, fontWeight: '900', color: C.green, marginTop: 1 },
  cardBold: { fontSize: 15, fontWeight: '700', color: C.text },
  bold: { fontWeight: '700', color: C.text },
  muted: { fontSize: 13, color: C.muted },
  // 통계 칩
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  statChipText: { fontSize: 12, fontWeight: '500', color: C.text },
  // 신기록 태그
  recordTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fffce8', borderWidth: 1, borderColor: '#f0d060', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  recordTagText: { fontSize: 12, fontWeight: '700', color: '#8a6000' },
  inProgressBadge: { backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  inProgressText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  completeBadge: { backgroundColor: C.border, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  completeText: { fontSize: 11, fontWeight: '600', color: C.muted },

  // 아바타
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: C.green },
  pill: { backgroundColor: C.greenLight, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 4 },
  pillText: { fontSize: 13, fontWeight: '700', color: C.green },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.greenLight, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', color: C.green },
  metricGridCompact: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metricCard: { flexBasis: '47%', flexGrow: 1, backgroundColor: C.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.border },
  metricLabel: { fontSize: 11, fontWeight: '800', color: C.muted },
  metricValue: { fontSize: 18, fontWeight: '900', color: C.text, marginTop: 4 },
  compactMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  compactMetric: {
    flexBasis: '31%', flexGrow: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.greenLight, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  compactMetricLabel: { fontSize: 11, fontWeight: '900', color: C.muted },
  compactMetricValue: { fontSize: 15, fontWeight: '900', color: C.text },
  compactActionButton: {
    minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  compactActionText: { fontSize: 13, fontWeight: '900', color: C.text },
  compactActionArrow: { fontSize: 18, fontWeight: '700', color: C.muted },
  gaugeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  gaugeCard: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.greenLight },
  visualCard: { borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, backgroundColor: C.greenLight, marginBottom: 10 },
  visualHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  visualTitle: { fontSize: 12, fontWeight: '900', color: C.muted },
  visualValue: { fontSize: 12, fontWeight: '900', color: C.text },
  visualEmpty: { minHeight: 42, textAlign: 'center', textAlignVertical: 'center', color: C.muted, fontSize: 12 },
  puttBarRow: { minHeight: 84, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  puttBarItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  puttBarValue: { fontSize: 10, fontWeight: '900', color: C.text, marginBottom: 4 },
  puttBar: { width: '70%', borderRadius: 8, backgroundColor: C.green },
  puttBarDate: { fontSize: 9, color: C.muted, marginTop: 5 },
  obGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  obCell: { flexBasis: '48%', flexGrow: 1, minHeight: 42, borderRadius: 12, backgroundColor: C.card, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  obLabel: { fontSize: 11, fontWeight: '900', color: C.muted },
  obValue: { fontSize: 16, fontWeight: '900', color: C.text },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  donutLegend: { flex: 1, gap: 7 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 12, fontWeight: '800', color: C.muted },
  legendValue: { fontSize: 12, fontWeight: '900', color: C.text },
  stackRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  stackDate: { width: 36, fontSize: 10, fontWeight: '800', color: C.muted },
  stackTrack: { flex: 1, height: 14, borderRadius: 8, overflow: 'hidden', backgroundColor: C.border, flexDirection: 'row' },
  stackSeg: { height: '100%' },
  trendChartGrid: { gap: 8, marginBottom: 12 },
  smallTrendCard: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingTop: 10, paddingHorizontal: 10, backgroundColor: C.greenLight },
  smallTrendHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  smallTrendTitle: { fontSize: 12, fontWeight: '900', color: C.muted },
  smallTrendValue: { fontSize: 13, fontWeight: '900', color: C.text },
  smallTrendEmpty: { minHeight: 48, textAlign: 'center', textAlignVertical: 'center', color: C.muted, fontSize: 12 },
  playerPanelTabs: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  playerPanelTab: { flex: 1, minHeight: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  playerPanelTabActive: { backgroundColor: C.green },
  playerPanelTabText: { fontSize: 13, fontWeight: '800', color: C.muted },
  playerPanelTabTextActive: { color: '#fff' },
  personalReportSection: { marginBottom: 14 },
  personalReportHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 },
  personalReportEyebrow: { fontSize: 10, lineHeight: 13, fontWeight: '900', color: C.green, letterSpacing: 0.4 },
  personalReportTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginTop: 1 },
  personalReportHint: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: C.muted },
  personalReportCarousel: { gap: 10, paddingRight: 2 },
  personalReportCard: {
    minHeight: 132,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    padding: 15,
    shadowColor: '#1a6b44',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  personalReportIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },
  personalReportIcon: { fontSize: 19, lineHeight: 23 },
  personalReportCardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  personalReportCardSubtitle: { minHeight: 35, fontSize: 12, lineHeight: 17, fontWeight: '800', color: C.muted, marginTop: 5 },
  personalReportCardAction: { fontSize: 12, lineHeight: 16, fontWeight: '900', color: C.green, marginTop: 'auto' },
  analysisRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  analysisLabel: { fontSize: 13, fontWeight: '700', color: C.muted },
  analysisValue: { fontSize: 14, fontWeight: '900', color: C.text },
  insightText: { fontSize: 13, color: C.muted, lineHeight: 20, marginBottom: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  bulletDot: { width: 12, fontSize: 13, color: C.muted, lineHeight: 20 },
  bulletText: { flex: 1, fontSize: 13, color: C.muted, lineHeight: 20 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalInput: {
    width: 86, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 18, fontWeight: '900', color: C.text, textAlign: 'center', backgroundColor: '#fff',
  },
  goalUnit: { fontSize: 13, fontWeight: '800', color: C.text },
  miniTrendRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 116, gap: 8 },
  miniTrendItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  miniTrendValue: { fontSize: 11, fontWeight: '800', color: C.text, marginBottom: 5 },
  miniTrendBar: { width: '70%', borderRadius: 8, backgroundColor: C.green },
  miniTrendDate: { fontSize: 10, color: C.muted, marginTop: 6 },
  scoreDistRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  scoreDistItem: { flex: 1, alignItems: 'center', backgroundColor: C.greenLight, borderRadius: 14, paddingVertical: 10 },
  scoreDistValue: { fontSize: 17, fontWeight: '900' },
  scoreDistLabel: { fontSize: 10, fontWeight: '800', color: C.muted, marginTop: 3 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailButton: {
    flexBasis: '48%', flexGrow: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  detailButtonText: { fontSize: 13, fontWeight: '800', color: C.text },
  detailButtonArrow: { fontSize: 18, fontWeight: '700', color: C.muted },
  hallSection: { marginTop: 8 },
  hallSectionTitle: { fontSize: 12, fontWeight: '900', color: C.text, marginBottom: 4 },
  hallRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  hallIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  hallLabel: { flex: 1, fontSize: 13, color: C.muted },
  hallValue: { fontSize: 13, fontWeight: '600', color: C.text, textAlign: 'right', flexShrink: 1 },
  smallBtn: { backgroundColor: C.green, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 10, marginBottom: 4 },
  yearBtn: { backgroundColor: C.green, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 18 },
  yearBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  yearText: { fontWeight: '800', fontSize: 18, color: C.text },
  dropdownTrigger: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: C.green, backgroundColor: C.green },
  dropdownTriggerText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  dropdownMenu: { position: 'absolute', top: 32, right: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 10, zIndex: 100, minWidth: 90 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 16 },
  dropdownItemText: { fontSize: 13, color: C.text },
  dropdownItemActive: { color: C.green, fontWeight: '700' } as const,
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: C.border, paddingBottom: 7, marginBottom: 2 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { fontSize: 11, color: C.muted, fontWeight: '700', letterSpacing: 0.3 },
  td: { fontSize: 13, color: C.text },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, width: '90%', maxHeight: '78%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  closeBtn: { backgroundColor: C.green, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14 },
  closeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})
