import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import DateField, { todayLocal } from '../components/DateField'
import { Icon } from '../components/Icon'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { useClub } from '../lib/ClubContext'
import {
  deleteRoundSchedule,
  getRoundAttendanceMap,
  getRoundSchedules,
  upsertRoundSchedule,
  type RoundAttendanceLabel,
  type RoundAttendanceMode,
  type RoundScheduleStatus,
  type ScheduledRound,
  type ScheduledRoundGroup,
  type ScheduledRoundGroupMember,
} from '../lib/roundSchedule'
import { completeRound, deleteRoundsBySchedule, getClubAwardConfig, getClubAwardSnapshots, getClubMembers, getClubSettlement, getCourseLayouts, getGolfCourses, getRoundLottoDraw, getRoundSummaries, saveClubAwardConfig, saveClubAwardSnapshots, saveClubSettlement, saveRound, saveRoundLottoDrafter, totalPar, type CourseLayout, type GolfCourse } from '../lib/store'
import { AWARD_CATEGORIES, fillToCount } from '../lib/awardConfig'
import { notifyHomeDashboardChanged } from '../lib/homeDashboardEvents'
import { notifyHomeRecordsChanged } from '../lib/homeRecordEvents'
import { computeClubAwardResults } from '../lib/awardResults'
import { recognizeScorecard, mergeScorecards, type RecognizedScorecard } from '../features/ocr'
import { findBestOcrMatch } from '../lib/nameMatch'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'RoundSchedulePrototype'>

type ClubMember = { userId: string; name: string; role: string }
type RoundEditorTab = 'basic' | 'score' | 'award' | 'money'

const ROUND_EDITOR_TABS: Array<{ value: RoundEditorTab; label: string }> = [
  { value: 'basic', label: '기본' },
  { value: 'score', label: '스코어' },
  { value: 'award', label: '시상' },
  { value: 'money', label: '게임/로또' },
]

type Draft = {
  id: string | null
  date: string
  courseId?: string
  courseName?: string
  layoutId?: string
  layoutName?: string
  status: RoundScheduleStatus
  attendanceMode: RoundAttendanceMode
  note: string
  moneyConfig?: ScheduledRound['moneyConfig']
  awardConfig?: ScheduledRound['awardConfig']
  isPublished?: boolean
  groups: ScheduledRoundGroup[]
}

const STATUS_OPTIONS: Array<{ value: RoundScheduleStatus; label: string }> = [
  { value: 'planned', label: '예정' },
  { value: 'recruiting', label: '모집중' },
  { value: 'closed', label: '마감' },
  { value: 'finished', label: '종료' },
]

function createGroup(order: number): ScheduledRoundGroup {
  return {
    id: `group-${Date.now()}-${order}`,
    name: `${order}조`,
    time: '',
    frontLayoutId: undefined,
    frontLayoutName: undefined,
    backLayoutId: undefined,
    backLayoutName: undefined,
    members: [],
  }
}

function createEmptyDraft(): Draft {
  return {
    id: null,
    date: todayLocal(),
    status: 'planned',
    attendanceMode: 'member',
    note: '',
    moneyConfig: null,
    awardConfig: null,
    isPublished: true,
    groups: [createGroup(1)],
  }
}

function courseSummary(item: ScheduledRound) {
  return item.courseName ?? '미정'
}

function groupSummary(groups: ScheduledRoundGroup[]) {
  if (groups.length === 0) return '조 없음'
  const times = groups.map((group) => group.time || '미정').join(' / ')
  return `${groups.length}개 조 · ${times}`
}

function statusLabel(status: RoundScheduleStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? '예정'
}

function memberSummary(groups: ScheduledRoundGroup[]) {
  const count = groups.reduce((sum, group) => sum + group.members.length, 0)
  return count > 0 ? `조편성 ${count}명` : '조편성 전'
}

function normalizeTimeInput(value: string) {
  const only = value.replace(/[^0-9:]/g, '').slice(0, 5)
  if (only.length === 2 && !only.includes(':')) return `${only}:`
  return only
}

function moneyGroupKey(index: number) {
  return `group-${index + 1}`
}

type ScoreGroupSummary = {
  players: Array<{ name: string; total: number }>
  average: number
}

type AwardResultRow = {
  awardKey: string
  icon: string
  label: string
  winner: string
  detail: string
}

type AwardWinnerPickerState = {
  awardKey: string
  multiple: boolean
} | null

export default function RoundSchedulePrototypeScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { activeClub: club } = useClub()
  const modalOnly = route.params?.modalOnly === true

  useLayoutEffect(() => {
    nav.setOptions({ title: `${club?.name ?? '클럽'} 라운드 일정` })
  }, [nav, club?.name])
  const [items, setItems] = useState<ScheduledRound[]>([])
  const [courses, setCourses] = useState<GolfCourse[]>([])
  const [layouts, setLayouts] = useState<CourseLayout[]>([])
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorTab, setEditorTab] = useState<RoundEditorTab>('basic')
  const [awardCount, setAwardCount] = useState(2)
  const [awardCountPickerOpen, setAwardCountPickerOpen] = useState(false)
  const [selectedAwardItems, setSelectedAwardItems] = useState<string[]>(['medal', 'birdieKing', 'last'])
  const [awardWinnerCounts, setAwardWinnerCounts] = useState<Record<string, number>>({})
  const [awardResultRows, setAwardResultRows] = useState<AwardResultRow[]>([])
  const [awardResultRoundId, setAwardResultRoundId] = useState<string | null>(null)
  const [awardResultLoading, setAwardResultLoading] = useState(false)
  const [awardWinnerPicker, setAwardWinnerPicker] = useState<AwardWinnerPickerState>(null)
  const [awardSaving, setAwardSaving] = useState(false)
  const [strokeFee, setStrokeFee] = useState('3000')
  const [birdieBonus, setBirdieBonus] = useState<5000 | 10000>(5000)
  const [baepanOn, setBaepanOn] = useState(true)
  const [moneyGroupIds, setMoneyGroupIds] = useState<string[]>([])
  const [moneySaving, setMoneySaving] = useState(false)
  const [lottoDrafterUserId, setLottoDrafterUserId] = useState<string | null>(null)
  const [lottoDrafterSaving, setLottoDrafterSaving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft>(createEmptyDraft())
  const [coursePickerOpen, setCoursePickerOpen] = useState(false)
  const [courseSearch, setCourseSearch] = useState('')
  const [layoutPickerTarget, setLayoutPickerTarget] = useState<{ groupId: string; side: 'front' | 'back' } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [attendanceMap, setAttendanceMap] = useState<Record<string, RoundAttendanceLabel>>({})
  const [scoreGroupId, setScoreGroupId] = useState<string | null>(null)
  const [scorePhotoUris, setScorePhotoUris] = useState<string[]>([])
  const [scoreOcrBusy, setScoreOcrBusy] = useState(false)
  const [scoreSaveBusy, setScoreSaveBusy] = useState(false)
  const [scoreOcrResult, setScoreOcrResult] = useState<RecognizedScorecard | null>(null)
  const [scoreOcrMemberMap, setScoreOcrMemberMap] = useState<Record<number, string>>({})
  const [scoreOcrError, setScoreOcrError] = useState('')
  const [savedScoreGroupIds, setSavedScoreGroupIds] = useState<string[]>([])
  const [scoreGroupSummaries, setScoreGroupSummaries] = useState<Record<string, ScoreGroupSummary>>({})
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scoreSummaryLoadSeq = useRef(0)
  const realtimeKey = useRef(`schedule-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    getGolfCourses().then(setCourses).catch(() => setCourses([]))
  }, [])

  useEffect(() => {
    if (!club?.id) return
    getRoundSchedules(club.id).then(setItems)
    getClubMembers(club.id).then(setClubMembers).catch(() => setClubMembers([]))
  }, [club?.id, refreshKey])

  useEffect(() => {
    if (!club?.id) return
    getClubAwardConfig(club.id).then((config) => {
      if (!config) return
      if (typeof config.count === 'number') setAwardCount(config.count)
      if (Array.isArray(config.items)) setSelectedAwardItems(config.items)
      setAwardWinnerCounts(config.winnerCounts ?? {})
    }).catch(() => {})
  }, [club?.id])

  useEffect(() => {
    if (!club?.id) return
    getClubSettlement(club.id).then((config) => {
      if (!config) return
      setStrokeFee(String(config.strokeFee))
      setBirdieBonus(config.birdieBonus)
      if (config.baepanConditions) setBaepanOn(config.baepanConditions.strokeOverpar)
    }).catch(() => {})
  }, [club?.id])

  useEffect(() => {
    if (!club?.id || !draft.id || !editorOpen) {
      setAttendanceMap({})
      return
    }
    getRoundAttendanceMap(club.id, draft.id)
      .then(setAttendanceMap)
      .catch(() => setAttendanceMap({}))
  }, [club?.id, draft.id, editorOpen, refreshKey])

  const groupedParticipantCount = useMemo(() => {
    const groupedMembers = draft.groups.flatMap((group) => group.members)
    const uniqueMemberKeys = new Set(
      groupedMembers.map((member, index) => {
        const userId = member.userId?.trim()
        if (userId) return `user:${userId}`
        const name = member.name?.trim()
        return name ? `name:${name}` : `member:${index}`
      }),
    )
    return uniqueMemberKeys.size
  }, [draft.groups])

  const awardCountOptions = useMemo(
    () => Array.from({ length: groupedParticipantCount }, (_, index) => index + 1),
    [groupedParticipantCount],
  )

  useEffect(() => {
    if (groupedParticipantCount <= 0 || awardCount <= groupedParticipantCount) return
    setAwardCount(groupedParticipantCount)
    const normalized = normalizeAwardSelection(selectedAwardItems, awardWinnerCounts, groupedParticipantCount)
    setSelectedAwardItems(normalized.items)
    setAwardWinnerCounts(normalized.counts)
  }, [awardCount, groupedParticipantCount])


  useEffect(() => {
    if (!club?.id || !draft.id || !editorOpen) {
      setSavedScoreGroupIds([])
      setScoreGroupSummaries({})
      return
    }

    let cancelled = false
    const loadSeq = ++scoreSummaryLoadSeq.current
    const isStale = () => cancelled || loadSeq !== scoreSummaryLoadSeq.current
    const normalizePlayerName = (value: unknown) => String(value ?? '').replace(/\s+/g, '').toLowerCase()
    const playerTotal = (player: any, round: any) => {
      const strokeValues = [player?.strokes, player?.scores, player?.holeScores]
        .find((value) => Array.isArray(value))
      if (Array.isArray(strokeValues)) {
        const total = strokeValues.reduce((sum: number, stroke: unknown) => sum + (Number(stroke) || 0), 0)
        if (total > 0) return total
      }

      if (Array.isArray(player?.diffs)) {
        const pars = Array.isArray(round?.pars) ? round.pars : []
        const total = player.diffs.reduce((sum: number, diff: unknown, index: number) => {
          return sum + (Number(pars[index]) || 4) + (Number(diff) || 0)
        }, 0)
        if (total > 0) return total
      }

      const directTotal = [player?.total, player?.grossScore, player?.gross, player?.score]
        .map((value) => Number(value))
        .find((value) => Number.isFinite(value) && value > 0)
      return directTotal ?? 0
    }

    getRoundSummaries(club.id)
      .then((rounds) => {
        if (isStale()) return
        const memberNames = new Set(
          draft.groups.flatMap((group) => group.members.map((member) => normalizePlayerName(member.name))),
        )
        const scheduleRounds = rounds.filter((round: any) => {
          if (round.scheduleId === draft.id) return true
          const sameDate = round.date === draft.date
          const sameCourse = !draft.courseName || !round.courseName || round.courseName === draft.courseName
          const hasScheduledMember = Array.isArray(round.players) && round.players.some((player: any) =>
            memberNames.has(normalizePlayerName(player?.name)),
          )
          return sameDate && sameCourse && hasScheduledMember
        })

        // 저장된 라운드는 같은 날짜/코스의 여러 조 스코어가 한 round.players 배열로
        // 병합될 수 있다. 이름의 공백·유니코드·OCR 표기 차이 때문에 2조 이후 결과가
        // 누락되지 않도록 정확 일치 후 유사 이름 매칭까지 적용한다.
        const persistedPlayers: Array<{ name: string; total: number }> = []
        scheduleRounds.forEach((round: any) => {
          if (!Array.isArray(round.players)) return
          round.players.forEach((player: any) => {
            const name = String(player?.name ?? '').trim()
            const total = playerTotal(player, round)
            if (name && total > 0) persistedPlayers.push({ name, total })
          })
        })

        const savedNames = persistedPlayers.map((player) => player.name)
        const savedTotalsByNormalizedName = new Map<string, number>()
        persistedPlayers.forEach((player) => {
          const key = normalizePlayerName(player.name.normalize('NFC'))
          if (key) savedTotalsByNormalizedName.set(key, player.total)
        })

        const usedPersistedIndexes = new Set<number>()
        const findPersistedTotal = (memberName: string) => {
          const normalizedMemberName = normalizePlayerName(memberName.normalize('NFC'))
          const exactTotal = savedTotalsByNormalizedName.get(normalizedMemberName)
          if (exactTotal && exactTotal > 0) {
            const exactIndex = persistedPlayers.findIndex((player, index) =>
              !usedPersistedIndexes.has(index)
              && normalizePlayerName(player.name.normalize('NFC')) === normalizedMemberName,
            )
            if (exactIndex >= 0) usedPersistedIndexes.add(exactIndex)
            return exactTotal
          }

          const fuzzyIndex = findBestOcrMatch(memberName, savedNames, usedPersistedIndexes)
          if (fuzzyIndex < 0) return 0
          usedPersistedIndexes.add(fuzzyIndex)
          return persistedPlayers[fuzzyIndex]?.total ?? 0
        }

        const nextSummaries: Record<string, ScoreGroupSummary> = {}
        const completedIds: string[] = []
        draft.groups.forEach((group) => {
          if (group.members.length === 0) return
          const players = group.members
            .map((member) => ({
              name: member.name,
              total: findPersistedTotal(member.name),
            }))
            .filter((player) => player.total > 0)
            .sort((a, b) => a.total - b.total)

          if (players.length === group.members.length) completedIds.push(group.id)
          if (players.length > 0) {
            nextSummaries[group.id] = {
              players,
              average: players.reduce((sum, player) => sum + player.total, 0) / players.length,
            }
          }
        })

        const visibleGroupIds = new Set(draft.groups.map((group) => group.id))
        setScoreGroupSummaries((current) => {
          const merged: Record<string, ScoreGroupSummary> = {}
          draft.groups.forEach((group) => {
            const summary = nextSummaries[group.id] ?? current[group.id]
            if (summary) merged[group.id] = summary
          })
          return merged
        })
        setSavedScoreGroupIds((current) => {
          const ids = new Set(completedIds)
          current.forEach((id) => {
            if (visibleGroupIds.has(id)) ids.add(id)
          })
          return Array.from(ids)
        })
      })
      .catch(() => {
        if (isStale()) return
        const visibleGroupIds = new Set(draft.groups.map((group) => group.id))
        setSavedScoreGroupIds((current) => current.filter((id) => visibleGroupIds.has(id)))
        setScoreGroupSummaries((current) => {
          const visibleSummaries: Record<string, ScoreGroupSummary> = {}
          draft.groups.forEach((group) => {
            if (current[group.id]) visibleSummaries[group.id] = current[group.id]
          })
          return visibleSummaries
        })
      })

    return () => {
      cancelled = true
    }
  }, [club?.id, draft.id, draft.date, draft.courseName, draft.groups, editorOpen, refreshKey])

  useEffect(() => {
    if (!club?.id) return

    const queueRefresh = () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current)
      realtimeTimer.current = setTimeout(() => {
        realtimeTimer.current = null
        setRefreshKey((key) => key + 1)
      }, 700)
    }

    const channel = supabase
      .channel(`round-schedule-screen:${club.id}:${realtimeKey.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_round_schedules', filter: `club_id=eq.${club.id}` }, queueRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_round_attendances', filter: `club_id=eq.${club.id}` }, queueRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_round_groups', filter: `club_id=eq.${club.id}` }, queueRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_round_group_members', filter: `club_id=eq.${club.id}` }, queueRefresh)
      .subscribe()

    return () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current)
      supabase.removeChannel(channel)
    }
  }, [club?.id])

  useEffect(() => {
    if (!draft.courseId) {
      setLayouts([])
      return
    }
    getCourseLayouts(draft.courseId).then(setLayouts).catch(() => setLayouts([]))
  }, [draft.courseId])

  const sortedItems = useMemo(
    () => items
      .sort((a, b) => `${a.date} ${a.time || '99:99'}`.localeCompare(`${b.date} ${b.time || '99:99'}`)),
    [items]
  )
  const filteredCourses = useMemo(() => {
    const keyword = courseSearch.trim().toLowerCase()
    if (!keyword) return courses
    return courses.filter((course) =>
      `${course.name} ${course.region}`.toLowerCase().includes(keyword)
    )
  }, [courses, courseSearch])
  const courseLayoutOptions = useMemo(() => {
    const map = new Map<string, CourseLayout>()
    layouts.forEach((layout) => map.set(layout.id, layout))
    draft.groups.forEach((group) => {
      ;[
        { id: group.frontLayoutId, name: group.frontLayoutName },
        { id: group.backLayoutId, name: group.backLayoutName },
        { id: draft.layoutId, name: draft.layoutName },
      ].forEach((layout) => {
        if (!layout.id || !layout.name || map.has(layout.id)) return
        map.set(layout.id, {
          id: layout.id,
          golfCourseId: draft.courseId ?? 'custom',
          name: layout.name,
          holes: 9,
          pars: [],
        })
      })
    })
    return [...map.values()]
  }, [layouts, draft.groups, draft.courseId, draft.layoutId, draft.layoutName])
  const sortedClubMembers = useMemo(() => {
    const order: Record<RoundAttendanceLabel, number> = { 참석: 0, 미정: 1, 불참: 2 }
    return [...clubMembers].sort((a, b) => {
      const left = order[attendanceMap[a.userId] ?? '미정']
      const right = order[attendanceMap[b.userId] ?? '미정']
      return left - right || a.name.localeCompare(b.name, 'ko-KR')
    })
  }, [clubMembers, attendanceMap])
  const selectedScoreGroup = useMemo(
    () => draft.groups.find((group) => group.id === scoreGroupId) ?? null,
    [draft.groups, scoreGroupId],
  )
  const groupingComplete = draft.status === 'closed' || draft.status === 'finished'
  const scoreComplete = draft.status === 'finished'

  function attendanceColor(status: RoundAttendanceLabel) {
    if (status === '참석') return C.green
    if (status === '불참') return '#d65b4a'
    return C.muted
  }

  function openCreate() {
    setDraft(createEmptyDraft())
    setAwardResultRows([])
    setAwardResultRoundId(null)
    setAwardResultLoading(false)
    setAwardWinnerPicker(null)
    setMoneyGroupIds([])
    setAwardCount(2)
    setSelectedAwardItems(['medal', 'birdieKing', 'last'])
    setAwardWinnerCounts({})
    setStrokeFee('3000')
    setBirdieBonus(5000)
    setBaepanOn(true)
    setLottoDrafterUserId(null)
    setLayouts([])
    setEditorTab('basic')
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    if (modalOnly) nav.goBack()
  }

  useEffect(() => {
    if (!route.params?.openCreate) return
    openCreate()
    nav.setParams({ openCreate: false })
  }, [nav, route.params?.openCreate])

  function openEdit(item: ScheduledRound) {
    const savedMoneyGroups = item.moneyGroupIds ?? []
    if (item.moneyConfig) {
      setStrokeFee(String(item.moneyConfig.strokeFee))
      setBirdieBonus(item.moneyConfig.birdieBonus)
      if (item.moneyConfig.baepanConditions) setBaepanOn(item.moneyConfig.baepanConditions.strokeOverpar)
    } else {
      setStrokeFee('3000')
      setBirdieBonus(5000)
      setBaepanOn(true)
    }
    if (item.awardConfig) {
      setAwardCount(item.awardConfig.count)
      setSelectedAwardItems(item.awardConfig.items)
      setAwardWinnerCounts(item.awardConfig.winnerCounts ?? {})
    } else {
      setAwardCount(2)
      setSelectedAwardItems(['medal', 'birdieKing', 'last'])
      setAwardWinnerCounts({})
    }
    setDraft({
      id: item.id,
      date: item.date,
      courseId: item.courseId,
      courseName: item.courseName,
      layoutId: item.layoutId,
      layoutName: item.layoutName,
      status: item.status,
      attendanceMode: item.attendanceMode,
      note: item.note,
      moneyConfig: item.moneyConfig ?? null,
      awardConfig: item.awardConfig ?? null,
      isPublished: item.isPublished ?? true,
      groups: item.groups.length > 0 ? item.groups : [createGroup(1)],
    })
    setMoneyGroupIds(item.groups
      .map((group, index) => {
        const key = moneyGroupKey(index)
        return savedMoneyGroups.includes(key) || savedMoneyGroups.includes(group.id) ? key : null
      })
      .filter((key): key is string => key !== null))
    setLottoDrafterUserId(null)
    getRoundLottoDraw(item.id)
      .then((draw) => setLottoDrafterUserId(draw?.drafterUserId ?? null))
      .catch(() => setLottoDrafterUserId(null))
    loadAwardResults(item.id, item.awardConfig?.items ?? selectedAwardItems, item.awardConfig?.count ?? awardCount, item.awardConfig?.manualWinners)
    setEditorTab('basic')
    setEditorOpen(true)
  }

  useEffect(() => {
    const editScheduleId = route.params?.editScheduleId
    if (!editScheduleId || items.length === 0) return
    const item = items.find((round) => round.id === editScheduleId)
    if (!item) return
    openEdit(item)
    nav.setParams({ editScheduleId: undefined })
  }, [items, nav, route.params?.editScheduleId])

  function toggleAwardItem(id: string) {
    setSelectedAwardItems((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      return normalizeAwardSelection([...current, id], awardWinnerCounts, awardCount, id).items
    })
  }

  function selectSpecialAwardItem(id: string) {
    if (selectedAwardItems.includes(id)) {
      removeSpecialAwardItem(id)
      return
    }
    const nextCounts = { ...awardWinnerCounts, [id]: Math.max(1, awardWinnerCounts[id] ?? 1) }
    const normalized = normalizeAwardSelection(selectedAwardItems.includes(id) ? selectedAwardItems : [...selectedAwardItems, id], nextCounts, awardCount, id)
    setAwardWinnerCounts(normalized.counts)
    setSelectedAwardItems(normalized.items)
    setAwardResultRows((current) => current.filter((row) => normalized.items.includes(row.awardKey)))
  }

  function removeSpecialAwardItem(id: string) {
    setSelectedAwardItems((current) => current.filter((item) => item !== id))
    setAwardWinnerCounts((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  async function setSpecialAwardWinnerCount(id: string, count: number) {
    const nextCount = Math.max(1, Math.min(count, Math.max(1, awardCount), Math.max(1, groupedParticipantCount || awardCount)))
    const nextCounts = { ...awardWinnerCounts, [id]: nextCount }
    const normalized = normalizeAwardSelection(
      selectedAwardItems.includes(id) ? selectedAwardItems : [...selectedAwardItems, id],
      nextCounts,
      awardCount,
      id,
    )
    setSelectedAwardItems(normalized.items)
    setAwardWinnerCounts(normalized.counts)
    if (awardResultRows.some((row) => row.awardKey === id)) {
      const nextRows = awardResultRows.filter((row) => normalized.items.includes(row.awardKey)).map((row) => {
        if (row.awardKey !== id) return row
        const names = awardWinnerNames(row.winner).slice(0, nextCount)
        return { ...row, winner: names.length > 0 ? names.join(', ') : '미입력' }
      })
      await saveAwardResultRows(nextRows)
    } else {
      setAwardResultRows((current) => current.filter((row) => normalized.items.includes(row.awardKey)))
    }
  }

  function randomizeAwardItems() {
    const items = AWARD_CATEGORIES.flatMap((category) => category.items)
    const shuffled = [...items].sort(() => Math.random() - 0.5)
    setSelectedAwardItems(shuffled.slice(0, awardCount).map((item) => item.id))
  }

  function buildAwardConfig(items = selectedAwardItems, count = awardCount) {
    const normalized = normalizeAwardSelection(items, awardWinnerCounts, count)
    const awardItems = normalized.items
    const winnerCounts = Object.fromEntries(
      Object.entries(normalized.counts)
        .filter(([key, value]) => awardItems.includes(key) && multiWinnerSpecialAwardKeys.has(key) && value > 1)
        .map(([key, value]) => [key, value])
    )
    const visibleManualWinners = manualWinnersFromRows(awardResultRows)
    const manualWinners = Object.fromEntries(
      Object.entries({ ...(draft.awardConfig?.manualWinners ?? {}), ...visibleManualWinners })
        .filter(([key, names]) => awardItems.includes(key) && key !== 'last' && names.length > 0)
        .map(([key, names]) => [key, names])
    )
    return {
      count,
      items: awardItems,
      ...(Object.keys(winnerCounts).length > 0 ? { winnerCounts } : {}),
      ...(Object.keys(manualWinners).length > 0 ? { manualWinners } : {}),
    }
  }

  function toAwardResultRows(rows: Array<{ awardKey: string; icon: string; label: string; winner: string; detail: string }>): AwardResultRow[] {
    return rows.map((row) => ({
      awardKey: row.awardKey,
      icon: row.icon,
      label: row.label,
      winner: row.winner,
      detail: row.detail,
    }))
  }

  const specialAwardKeys = useMemo(() => new Set(
    AWARD_CATEGORIES.find((category) => category.label === '특별상')?.items.map((item) => item.id) ?? []
  ), [])
  const multiWinnerSpecialAwardKeys = useMemo(() => new Set(
    (AWARD_CATEGORIES.find((category) => category.label === '특별상')?.items ?? [])
      .filter((item) => item.id !== 'last')
      .map((item) => item.id)
  ), [])

  function isEditableAwardResult(row: AwardResultRow) {
    if (row.awardKey === 'last') return false
    return row.winner === '미입력' || row.detail === '추첨' || specialAwardKeys.has(row.awardKey)
  }

  function awardWinnerLimit(awardKey: string) {
    if (awardKey === 'last') return 1
    return Math.max(1, awardWinnerCounts[awardKey] ?? 1)
  }

  function awardWinnerSlotCount(id: string, counts = awardWinnerCounts) {
    return multiWinnerSpecialAwardKeys.has(id) ? Math.max(1, counts[id] ?? 1) : 1
  }

  function awardWinnerSlotTotal(items: string[], counts = awardWinnerCounts) {
    return items.reduce((sum, id) => sum + awardWinnerSlotCount(id, counts), 0)
  }

  function normalizeAwardSelection(items: string[], counts: Record<string, number>, limit = awardCount, keepId?: string) {
    const uniqueItems = Array.from(new Set(items))
    const nextCounts = { ...counts }
    let nextItems = uniqueItems

    while (awardWinnerSlotTotal(nextItems, nextCounts) > Math.max(1, limit) && nextItems.length > 0) {
      const removeIndex = nextItems.findIndex((item) => item !== keepId)
      const index = removeIndex >= 0 ? removeIndex : 0
      const [removed] = nextItems.splice(index, 1)
      delete nextCounts[removed]
    }

    return { items: nextItems, counts: nextCounts }
  }

  function awardWinnerNames(value: string) {
    return value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .filter((name) => name !== '미입력')
  }

  function awardTakenNames(targetAwardKey: string) {
    return new Set(
      awardResultRows
        .filter((row) => row.awardKey !== targetAwardKey)
        .flatMap((row) => awardWinnerNames(row.winner))
    )
  }

  function awardCandidates(targetAwardKey: string) {
    const taken = awardTakenNames(targetAwardKey)
    const selected = new Set(awardWinnerNames(awardResultRows.find((row) => row.awardKey === targetAwardKey)?.winner ?? ''))
    return draft.groups
      .flatMap((group) => group.members)
      .filter((member, index, members) => {
        const key = member.userId || member.name
        return members.findIndex((item) => (item.userId || item.name) === key) === index
      })
      .filter((member) => selected.has(member.name) || !taken.has(member.name))
  }

  function manualWinnersFromRows(rows: AwardResultRow[]) {
    return Object.fromEntries(
      rows
        .filter((row) => row.awardKey !== 'last')
        .map((row) => [row.awardKey, awardWinnerNames(row.winner)])
        .filter(([, names]) => names.length > 0)
    )
  }

  function applyManualWinners(rows: AwardResultRow[], manualWinners?: Record<string, string[]>) {
    if (!manualWinners) return rows
    return rows.map((row) => {
      const names = manualWinners[row.awardKey]
      if (!names?.length) return row
      return {
        ...row,
        winner: names.join(', '),
        detail: row.detail === '추첨' || row.detail === '현장 확인' ? '관리자 지정' : row.detail,
      }
    })
  }

  async function saveAwardManualWinners(nextRows: AwardResultRow[]) {
    if (!club?.id || !draft.id) return
    const baseConfig = draft.awardConfig ?? buildAwardConfig()
    const nextConfig = {
      ...baseConfig,
      manualWinners: manualWinnersFromRows(nextRows),
    }
    setDraft((current) => ({ ...current, awardConfig: nextConfig }))
    setItems((current) => current.map((item) => item.id === draft.id ? { ...item, awardConfig: nextConfig } : item))
    const currentSchedule = items.find((item) => item.id === draft.id)
    const next = await upsertRoundSchedule(club.id, {
      id: draft.id,
      date: draft.date,
      courseId: draft.courseId,
      courseName: draft.courseName?.trim() || undefined,
      layoutId: draft.layoutId,
      layoutName: draft.layoutName,
      status: draft.status,
      attendanceMode: draft.attendanceMode,
      note: draft.note.trim(),
      moneyGroupIds,
      moneyConfig: draft.moneyConfig ?? currentSchedule?.moneyConfig ?? null,
      awardConfig: nextConfig,
      isPublished: draft.isPublished ?? currentSchedule?.isPublished ?? true,
      groups: draft.groups.map((group, index) => ({
        ...group,
        name: group.name || `${index + 1}조`,
        time: group.time.trim(),
      })),
    })
    setItems(next)
  }

  async function saveAwardResultRows(nextRows: AwardResultRow[]) {
    setAwardResultRows(nextRows)
    if (!club?.id || !awardResultRoundId) return
    try {
      await saveAwardManualWinners(nextRows)
      await saveClubAwardSnapshots(club.id, awardResultRoundId, nextRows)
      notifyHomeRecordsChanged(club.id)
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : String(error))
    }
  }

  async function toggleAwardResultWinner(awardKey: string, member: ScheduledRoundGroupMember, multiple: boolean) {
    const target = awardResultRows.find((row) => row.awardKey === awardKey)
    if (!target) return
    const currentNames = awardWinnerNames(target.winner)
    if (multiple && !currentNames.includes(member.name) && currentNames.length >= awardWinnerLimit(awardKey)) {
      Alert.alert('확인', `${awardWinnerLimit(awardKey)}명까지 지정할 수 있습니다.`)
      return
    }
    const nextNames = multiple
      ? currentNames.includes(member.name)
        ? currentNames.filter((name) => name !== member.name)
        : [...currentNames, member.name]
      : [member.name]
    const nextRows = awardResultRows.map((row) => row.awardKey === awardKey
      ? {
          ...row,
          winner: nextNames.length > 0 ? nextNames.join(', ') : '미입력',
          detail: row.detail === '추첨' || row.detail === '현장 확인' ? '관리자 지정' : row.detail,
        }
      : row
    )
    await saveAwardResultRows(nextRows)
    if (!multiple) setAwardWinnerPicker(null)
  }

  async function loadAwardResults(scheduleId?: string | null, awardItems = selectedAwardItems, count = awardCount, manualWinners = draft.awardConfig?.manualWinners) {
    if (!club?.id || !scheduleId) {
      setAwardResultRows([])
      setAwardResultRoundId(null)
      return
    }
    setAwardResultLoading(true)
    try {
      const rounds = await getRoundSummaries(club.id)
      const round = rounds.find((item) => item.scheduleId === scheduleId)
      if (!round) {
        setAwardResultRows([])
        setAwardResultRoundId(null)
        return
      }
      setAwardResultRoundId(round.id)
      const snapshots = await getClubAwardSnapshots(round.id).catch(() => [])
      if (snapshots.length > 0) {
        setAwardResultRows(applyManualWinners(toAwardResultRows(snapshots), manualWinners))
        return
      }
      const itemIds = fillToCount(awardItems, count)
      const handicaps = new Map(Object.entries(round.handicaps ?? {}))
      setAwardResultRows(applyManualWinners(toAwardResultRows(computeClubAwardResults(itemIds, round, handicaps, totalPar(round.pars))), manualWinners))
    } catch {
      setAwardResultRows([])
    } finally {
      setAwardResultLoading(false)
    }
  }

  async function saveAwardConfig() {
    if (!club?.id) return Alert.alert('확인', '클럽 정보를 불러온 뒤 다시 시도해 주세요.')
    setAwardSaving(true)
    try {
      const awardConfig = buildAwardConfig()
      const awardItems = awardConfig.items
      if (draft.id) {
        const currentSchedule = items.find((item) => item.id === draft.id)
        const next = await upsertRoundSchedule(club.id, {
          id: draft.id,
          date: draft.date,
          courseId: draft.courseId,
          courseName: draft.courseName?.trim() || undefined,
          layoutId: draft.layoutId,
          layoutName: draft.layoutName,
          status: draft.status,
          attendanceMode: draft.attendanceMode,
          note: draft.note.trim(),
          moneyGroupIds,
          moneyConfig: draft.moneyConfig ?? currentSchedule?.moneyConfig ?? null,
          awardConfig,
          isPublished: draft.isPublished ?? currentSchedule?.isPublished ?? true,
          groups: draft.groups.map((group, index) => ({
            ...group,
            name: group.name || `${index + 1}조`,
            time: group.time.trim(),
          })),
        })
        setItems(next)
        notifyHomeDashboardChanged(club.id)
        setDraft((current) => ({ ...current, awardConfig }))
      } else {
        await saveClubAwardConfig(club.id, awardConfig)
      }
      setSelectedAwardItems(awardItems)
      await loadAwardResults(draft.id, awardItems, awardCount)
      Alert.alert('저장 완료', '시상룰을 저장했습니다.')
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : String(error))
    } finally {
      setAwardSaving(false)
    }
  }

  async function saveMoneyGameConfig() {
    if (!club?.id) return
    setMoneySaving(true)
    try {
      if (draft.id) {
        const moneyConfig = {
          strokeFee: parseInt(strokeFee, 10) || 3000,
          birdieBonus,
          baepanConditions: { strokeOverpar: baepanOn, tie: baepanOn, birdie: false },
        }
        const currentSchedule = items.find((item) => item.id === draft.id)
        setDraft((current) => ({ ...current, moneyConfig }))
        const next = await upsertRoundSchedule(club.id, {
          id: draft.id,
          date: draft.date,
          courseId: draft.courseId,
          courseName: draft.courseName?.trim() || undefined,
          layoutId: draft.layoutId,
          layoutName: draft.layoutName,
          status: draft.status,
          attendanceMode: draft.attendanceMode,
          note: draft.note.trim(),
          moneyGroupIds,
          moneyConfig,
          awardConfig: draft.awardConfig ?? currentSchedule?.awardConfig ?? null,
          isPublished: draft.isPublished ?? currentSchedule?.isPublished ?? true,
          groups: draft.groups.map((group, index) => ({
            ...group,
            name: group.name || `${index + 1}조`,
            time: group.time.trim(),
          })),
        })
        setItems(next)
        notifyHomeDashboardChanged(club.id)
      }
      if (!draft.id) {
        await saveClubSettlement(club.id, {
          participants: [],
          strokeFee: parseInt(strokeFee, 10) || 3000,
          birdieBonus,
          baepanConditions: { strokeOverpar: baepanOn, tie: baepanOn, birdie: false },
        })
      }
      Alert.alert('저장 완료', '머니게임 기준을 저장했습니다.')
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : String(error))
    } finally {
      setMoneySaving(false)
    }
  }

  async function saveLottoDrafter() {
    if (!club?.id || !draft.id) return
    setLottoDrafterSaving(true)
    try {
      await saveRoundLottoDrafter(club.id, draft.id, lottoDrafterUserId)
      Alert.alert('저장 완료', '로또 추첨자를 저장했습니다.')
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : String(error))
    } finally {
      setLottoDrafterSaving(false)
    }
  }

  function openScoreUpload(groupId: string) {
    setScoreGroupId(groupId)
    setScorePhotoUris([])
    setScoreOcrResult(null)
    setScoreOcrMemberMap({})
    setScoreOcrError('')
  }

  function closeScoreUpload() {
    setScoreGroupId(null)
    setScorePhotoUris([])
    setScoreOcrResult(null)
    setScoreOcrMemberMap({})
    setScoreOcrError('')
  }

  function toggleMoneyGroup(groupId: string) {
    setMoneyGroupIds((current) => (
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    ))
  }

  async function takeScorePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 })
    if (!result.canceled && result.assets.length > 0) {
      setScorePhotoUris((current) => [...current, ...result.assets.map((asset) => asset.uri)])
      setScoreOcrResult(null)
      setScoreOcrMemberMap({})
      setScoreOcrError('')
    }
  }

  async function pickScorePhotos() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsMultipleSelection: true,
    })
    if (!result.canceled && result.assets.length > 0) {
      setScorePhotoUris((current) => [...current, ...result.assets.map((asset) => asset.uri)])
      setScoreOcrResult(null)
      setScoreOcrMemberMap({})
      setScoreOcrError('')
    }
  }

  async function runScoreOcr() {
    if (scorePhotoUris.length === 0) return
    setScoreOcrBusy(true)
    setScoreOcrResult(null)
    setScoreOcrMemberMap({})
    setScoreOcrError('')
    try {
      const cards = await Promise.all(scorePhotoUris.map((uri) => recognizeScorecard(uri)))
      const merged = mergeScorecards(cards, selectedScoreGroup?.frontLayoutName, selectedScoreGroup?.backLayoutName)
      if (selectedScoreGroup) {
        const normalized = applyScoreGroupCourseBasis(selectedScoreGroup, merged)
        const completed = completeScoreOcrResultForGroup(selectedScoreGroup, normalized)
        setScoreOcrResult(completed.result)
        setScoreOcrMemberMap(completed.memberMap)
      } else {
        setScoreOcrResult(merged)
      }
    } catch (error) {
      setScoreOcrError(`인식 오류: ${String(error)}`)
    } finally {
      setScoreOcrBusy(false)
    }
  }

  function scoreParsForGroup(group: ScheduledRoundGroup) {
    const front = layouts.find((layout) => layout.id === group.frontLayoutId)?.pars ?? []
    const back = layouts.find((layout) => layout.id === group.backLayoutId)?.pars ?? []
    const pars = [...front, ...back].slice(0, 18)
    return pars.length === 18 ? pars : Array.from({ length: 18 }, () => 4)
  }

  function applyScoreGroupCourseBasis(group: ScheduledRoundGroup, result: RecognizedScorecard): RecognizedScorecard {
    return {
      ...result,
      pars: scoreParsForGroup(group),
      recognizedCourseName: [group.frontLayoutName, group.backLayoutName].filter(Boolean).join(' / ') || result.recognizedCourseName,
    }
  }

  function scoreHoleLabelsForGroup(group: ScheduledRoundGroup) {
    const front = layouts.find((layout) => layout.id === group.frontLayoutId)
    const back = layouts.find((layout) => layout.id === group.backLayoutId)
    const labels = [front, back].filter((layout): layout is CourseLayout => !!layout).flatMap((layout) =>
      Array.from({ length: layout.holes }, (_, index) => `${layout.name}${index + 1}`)
    )
    return labels.length === 18 ? labels : undefined
  }

  function buildAutoScoreOcrMemberMap(group: ScheduledRoundGroup, result: RecognizedScorecard) {
    const ocrNames = result.players.map((player) => player.name)
    const used = new Set<number>()
    const next: Record<number, string> = {}
    group.members.forEach((member) => {
      const idx = findBestOcrMatch(member.name, ocrNames, used)
      if (idx < 0) return
      used.add(idx)
      next[idx] = member.userId
    })
    return next
  }

  function completeScoreOcrResultForGroup(group: ScheduledRoundGroup, result: RecognizedScorecard) {
    const pars = scoreParsForGroup(group)
    const players = result.players.map((player) => ({ ...player }))
    const memberMap = buildAutoScoreOcrMemberMap(group, result)
    const matchedUserIds = new Set(Object.values(memberMap))
    group.members.forEach((member) => {
      if (matchedUserIds.has(member.userId)) return
      const index = players.length
      players.push({
        name: `${member.name} (미인식)`,
        diffs: Array.from({ length: pars.length || 18 }, () => 0),
      })
      memberMap[index] = member.userId
      matchedUserIds.add(member.userId)
    })
    return {
      result: {
        ...result,
        pars,
        players,
      },
      memberMap,
    }
  }

  function toggleScoreOcrMember(ocrIndex: number, member: ScheduledRoundGroupMember) {
    setScoreOcrMemberMap((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([index, userId]) => Number(index) !== ocrIndex && userId !== member.userId)
      ) as Record<number, string>
      if (current[ocrIndex] === member.userId) return next
      next[ocrIndex] = member.userId
      return next
    })
  }

  function scorePlayersForGroup(group: ScheduledRoundGroup, result: RecognizedScorecard) {
    const pars = scoreParsForGroup(group)
    const ocrNames = result.players.map((player) => player.name)
    const manualByUser = new Map<string, number>()
    Object.entries(scoreOcrMemberMap).forEach(([index, userId]) => {
      manualByUser.set(userId, Number(index))
    })
    const manualIndices = new Set(manualByUser.values())
    const used = new Set<number>()
    return group.members.flatMap((member) => {
      const mappedIdx = manualByUser.get(member.userId) ?? -1
      const autoUsed = new Set([...used, ...[...manualIndices].filter((index) => index !== mappedIdx)])
      const idx = mappedIdx >= 0 && result.players[mappedIdx] && !used.has(mappedIdx)
        ? mappedIdx
        : findBestOcrMatch(member.name, ocrNames, autoUsed)
      if (idx < 0) return []
      used.add(idx)
      return [{
        name: member.name,
        strokes: result.players[idx].diffs.map((diff, holeIndex) => Math.max(1, pars[holeIndex] + (diff ?? 0))),
      }]
    })
  }

  async function saveScoreResult() {
    if (!club?.id || !selectedScoreGroup || !scoreOcrResult) return
    const savedGroupId = selectedScoreGroup.id
    setScoreSaveBusy(true)
    try {
      const photoData: string[] = []
      if (Platform.OS !== 'web') {
        for (const uri of scorePhotoUris) {
          try {
            const result = await manipulateAsync(uri, [{ resize: { width: 800 } }], {
              compress: 0.6,
              format: SaveFormat.JPEG,
              base64: true,
            })
            if (result.base64) photoData.push(`data:image/jpeg;base64,${result.base64}`)
          } catch {}
        }
      }
      const players = scorePlayersForGroup(selectedScoreGroup, scoreOcrResult)
      if (players.length === 0) {
        Alert.alert('저장 불가', '조 멤버와 매칭된 OCR 결과가 없습니다.')
        return
      }
      const savedPlayers = players
        .map((player) => ({
          name: player.name,
          total: player.strokes.reduce((sum, stroke) => sum + (Number(stroke) || 0), 0),
        }))
        .filter((player) => player.total > 0)
        .sort((a, b) => a.total - b.total)
      const selectedGroupIndex = draft.groups.findIndex((group) => group.id === selectedScoreGroup.id)
      const settlement = selectedGroupIndex >= 0 && moneyGroupIds.includes(moneyGroupKey(selectedGroupIndex))
        ? {
            participants: players.map((player) => player.name),
            strokeFee: parseInt(strokeFee, 10) || 3000,
            birdieBonus,
            baepanConditions: { strokeOverpar: baepanOn, tie: baepanOn, birdie: false },
          }
        : undefined
      const saved = await saveRound({
        date: draft.date,
        courseName: draft.courseName ?? selectedScoreGroup.frontLayoutName ?? '이름 없는 코스',
        golfCourseId: draft.courseId,
        pars: scoreParsForGroup(selectedScoreGroup),
        holeLabels: scoreHoleLabelsForGroup(selectedScoreGroup),
        players,
        photoData,
        clubId: club.id,
        settlement,
        scheduleId: draft.id ?? undefined,
      })
      scoreSummaryLoadSeq.current += 1
      setEditorTab('score')
      setSavedScoreGroupIds((current) => current.includes(savedGroupId) ? current : [...current, savedGroupId])
      setScoreGroupSummaries((current) => ({
        ...current,
        [savedGroupId]: {
          players: savedPlayers,
          average: savedPlayers.length > 0
            ? savedPlayers.reduce((sum, player) => sum + player.total, 0) / savedPlayers.length
            : 0,
        },
      }))
      closeScoreUpload()
      await completeRound(saved.id)
      const itemIds = fillToCount(selectedAwardItems, awardCount)
      const handicaps = new Map(Object.entries(saved.handicaps ?? {}))
      const awards = computeClubAwardResults(itemIds, saved, handicaps, totalPar(saved.pars))
      await saveClubAwardSnapshots(club.id, saved.id, awards)
      setAwardResultRows(toAwardResultRows(awards))
      setLastSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
      // 조별 저장 직후 최신 DB 결과를 다시 읽어 스코어 탭에 즉시 반영한다.
      // 진행 중이던 이전 조회는 scoreSummaryLoadSeq로 무시되어 방금 저장한 요약을 덮어쓰지 못한다.
      setRefreshKey((current) => current + 1)
      notifyHomeRecordsChanged(club.id)
      Alert.alert('스코어 저장 완료', `${selectedScoreGroup.name ?? '선택한 조'}의 스코어를 정상적으로 저장했습니다.`)
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : String(error))
    } finally {
      setScoreSaveBusy(false)
    }
  }

  function updateGroup(groupId: string, patch: Partial<ScheduledRoundGroup>) {
    setDraft((current) => ({
      ...current,
      groups: current.groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
    }))
  }

  function addGroup() {
    setDraft((current) => ({
      ...current,
      groups: [...current.groups, createGroup(current.groups.length + 1)],
    }))
  }

  function removeGroup(groupId: string) {
    setDraft((current) => {
      const next = current.groups.filter((group) => group.id !== groupId)
      const renamed = next.length > 0
        ? next.map((group, index) => ({ ...group, name: `${index + 1}조` }))
        : [createGroup(1)]
      return { ...current, groups: renamed }
    })
  }

  function selectCourse(course: GolfCourse | null) {
    if (!course) {
      setDraft((current) => ({
        ...current,
        courseId: undefined,
        courseName: undefined,
        layoutId: undefined,
        layoutName: undefined,
        groups: current.groups.map((group) => ({
          ...group,
          frontLayoutId: undefined,
          frontLayoutName: undefined,
          backLayoutId: undefined,
          backLayoutName: undefined,
        })),
      }))
      setLayouts([])
      setCoursePickerOpen(false)
      setCourseSearch('')
      return
    }

    setDraft((current) => ({
      ...current,
      courseId: course.id,
      courseName: course.name,
      layoutId: undefined,
      layoutName: undefined,
      groups: current.groups.map((group) => ({
        ...group,
        frontLayoutId: undefined,
        frontLayoutName: undefined,
        backLayoutId: undefined,
        backLayoutName: undefined,
      })),
    }))
    setCoursePickerOpen(false)
    setCourseSearch('')
  }

  function selectLayout(layout: CourseLayout | null) {
    if (!layoutPickerTarget) return
    const { groupId, side } = layoutPickerTarget
    updateGroup(groupId, side === 'front'
      ? {
          frontLayoutId: layout?.id,
          frontLayoutName: layout?.name,
        }
      : {
          backLayoutId: layout?.id,
          backLayoutName: layout?.name,
        })
    setLayoutPickerTarget(null)
  }

  function toggleLayoutTag(groupId: string, side: 'front' | 'back' | 'extra', layout: CourseLayout | null) {
    if (side === 'extra') {
      setDraft((current) => {
        const active = current.layoutId === layout?.id
        return {
          ...current,
          layoutId: active ? undefined : layout?.id,
          layoutName: active ? undefined : layout?.name,
        }
      })
      return
    }

    const group = draft.groups.find((item) => item.id === groupId)
    const currentId = side === 'front' ? group?.frontLayoutId : group?.backLayoutId
    const nextLayout = currentId === layout?.id ? null : layout
    updateGroup(groupId, side === 'front'
      ? {
          frontLayoutId: nextLayout?.id,
          frontLayoutName: nextLayout?.name,
        }
      : {
          backLayoutId: nextLayout?.id,
          backLayoutName: nextLayout?.name,
        })
  }

  function toggleGroupMember(groupId: string, member: ClubMember) {
    setDraft((current) => {
      const allOtherGroups = current.groups.filter((group) => group.id !== groupId)
      const memberInTarget = current.groups
        .find((group) => group.id === groupId)
        ?.members.some((item) => item.userId === member.userId)

      return {
        ...current,
        groups: current.groups.map((group) => {
          const cleanedMembers = group.members.filter((item) => item.userId !== member.userId)
          if (group.id !== groupId) {
            return { ...group, members: cleanedMembers }
          }
          if (memberInTarget) {
            return { ...group, members: cleanedMembers }
          }
          const nextMember: ScheduledRoundGroupMember = { userId: member.userId, name: member.name }
          return { ...group, members: [...cleanedMembers, nextMember] }
        }),
      }
    })
  }

  function isMemberSelected(groupId: string, userId: string) {
    return draft.groups
      .find((group) => group.id === groupId)
      ?.members.some((member) => member.userId === userId) ?? false
  }

  function memberAssignedGroup(userId: string) {
    return draft.groups.find((group) => group.members.some((member) => member.userId === userId))?.id
  }

  async function handleSave() {
    if (!club?.id) return
    if (!draft.date.trim()) return Alert.alert('확인', '라운드 날짜를 입력해 주세요.')

    setSaving(true)
    try {
      const awardConfig = buildAwardConfig()
      const awardItems = awardConfig.items
      const moneyConfig = {
        strokeFee: parseInt(strokeFee, 10) || 3000,
        birdieBonus,
        baepanConditions: { strokeOverpar: baepanOn, tie: baepanOn, birdie: false },
      }
      const next = await upsertRoundSchedule(club.id, {
        id: draft.id,
        date: draft.date,
        courseId: draft.courseId,
        courseName: draft.courseName?.trim() || undefined,
        layoutId: draft.layoutId,
        layoutName: draft.layoutName,
        status: draft.status,
        attendanceMode: draft.attendanceMode,
        note: draft.note.trim(),
        moneyGroupIds,
        moneyConfig,
        awardConfig,
        isPublished: draft.isPublished ?? true,
        groups: draft.groups.map((group, index) => ({
          ...group,
          name: `${index + 1}조`,
          time: group.time.trim(),
        })),
      })
      setItems(next)
      setSelectedAwardItems(awardItems)
      const savedSchedule = next.find((item) => item.id === draft.id) ?? next.find((item) =>
        item.date === draft.date &&
        (item.courseId ?? '') === (draft.courseId ?? '') &&
        item.groups[0]?.time === draft.groups[0]?.time.trim()
      )
      if (savedSchedule) {
        setDraft({
          id: savedSchedule.id,
          date: savedSchedule.date,
          courseId: savedSchedule.courseId,
          courseName: savedSchedule.courseName,
          layoutId: savedSchedule.layoutId,
          layoutName: savedSchedule.layoutName,
          status: savedSchedule.status,
          attendanceMode: savedSchedule.attendanceMode,
          note: savedSchedule.note,
          moneyConfig,
          awardConfig,
          isPublished: savedSchedule.isPublished ?? draft.isPublished ?? true,
          groups: savedSchedule.groups,
        })
        await saveRoundLottoDrafter(club.id, savedSchedule.id, lottoDrafterUserId)
      }
      notifyHomeDashboardChanged(club.id)
      notifyHomeRecordsChanged(club.id)
      const savedAt = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      setLastSavedAt(savedAt)
      closeEditor()
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  async function saveDraftStatus(nextStatus: RoundScheduleStatus) {
    if (!club?.id) return
    if (!draft.date.trim()) return Alert.alert('확인', '라운드 날짜를 입력해 주세요.')

    setSaving(true)
    try {
      const next = await upsertRoundSchedule(club.id, {
        id: draft.id,
        date: draft.date,
        courseId: draft.courseId,
        courseName: draft.courseName?.trim() || undefined,
        layoutId: draft.layoutId,
        layoutName: draft.layoutName,
        status: nextStatus,
        attendanceMode: draft.attendanceMode,
        note: draft.note.trim(),
        moneyGroupIds,
        moneyConfig: {
          strokeFee: parseInt(strokeFee, 10) || 3000,
          birdieBonus,
          baepanConditions: { strokeOverpar: baepanOn, tie: baepanOn, birdie: false },
        },
        awardConfig: buildAwardConfig(),
        isPublished: draft.isPublished ?? true,
        groups: draft.groups.map((group, index) => ({
          ...group,
          name: group.name || `${index + 1}조`,
          time: group.time.trim(),
        })),
      })
      const savedDraft = draft.id
        ? next.find((item) => item.id === draft.id)
        : [...next]
            .filter((item) => item.date === draft.date && item.status === nextStatus)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      if (savedDraft) {
        setDraft((current) => ({
          ...current,
          id: savedDraft.id,
          status: savedDraft.status,
          isPublished: savedDraft.isPublished ?? current.isPublished ?? true,
          groups: savedDraft.groups.length > 0 ? savedDraft.groups : current.groups,
        }))
      } else {
        setDraft((current) => ({ ...current, status: nextStatus }))
      }
      setItems(next)
      notifyHomeDashboardChanged(club.id)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleGroupingComplete() {
    await saveDraftStatus(groupingComplete ? 'planned' : 'closed')
  }

  function handleTogglePublished() {
    setDraft((current) => ({ ...current, isPublished: !(current.isPublished ?? true) }))
  }

  async function handleToggleScoreComplete() {
    if (scoreComplete) {
      await saveDraftStatus(groupingComplete ? 'closed' : 'planned')
      return
    }
    await handleFinishRound()
  }

  async function handleDelete() {
    if (!club?.id || !draft.id) {
      closeEditor()
      return
    }

    setSaving(true)
    try {
      await deleteRoundsBySchedule(draft.id)
      const next = await deleteRoundSchedule(club.id, draft.id)
      setItems(next)
      notifyHomeDashboardChanged(club.id)
      closeEditor()
    } finally {
      setSaving(false)
    }
  }

  async function handleFinishRound() {
    if (!club?.id) return
    if (!draft.date.trim()) return Alert.alert('확인', '라운드 날짜를 입력해 주세요')

    setSaving(true)
    try {
      const next = await upsertRoundSchedule(club.id, {
        id: draft.id,
        date: draft.date,
        courseId: draft.courseId,
        courseName: draft.courseName?.trim() || undefined,
        layoutId: draft.layoutId,
        layoutName: draft.layoutName,
        status: 'finished',
        attendanceMode: draft.attendanceMode,
        note: draft.note.trim(),
        moneyGroupIds,
        moneyConfig: {
          strokeFee: parseInt(strokeFee, 10) || 3000,
          birdieBonus,
          baepanConditions: { strokeOverpar: baepanOn, tie: baepanOn, birdie: false },
        },
        awardConfig: buildAwardConfig(),
        isPublished: draft.isPublished ?? true,
        groups: draft.groups.map((group, index) => ({
          ...group,
          name: group.name || `${index + 1}조`,
          time: group.time.trim(),
        })),
      })
      setItems(next)
      notifyHomeDashboardChanged(club.id)
      const rounds = await getRoundSummaries(club.id)
      const finishedRound = rounds.find((round) => draft.id && round.scheduleId === draft.id) ?? rounds.find((round) =>
        round.date === draft.date && (!draft.courseName || round.courseName === draft.courseName)
      )
      if (finishedRound) {
        await completeRound(finishedRound.id)
        const itemIds = fillToCount(selectedAwardItems, awardCount)
        const handicaps = new Map(Object.entries(finishedRound.handicaps ?? {}))
        const awards = computeClubAwardResults(itemIds, finishedRound, handicaps, totalPar(finishedRound.pars))
        await saveClubAwardSnapshots(club.id, finishedRound.id, awards)
        setAwardResultRows(toAwardResultRows(awards))
        notifyHomeRecordsChanged(club.id)
      } else {
        const members = draft.groups.flatMap((group) => group.members)
        const uniqueMembers = Array.from(new Map(members.map((member) => [member.userId || member.name, member])).values())
        if (uniqueMembers.length === 0) {
          Alert.alert('확인', '조편성된 회원이 없어 파 기록을 만들 수 없습니다.')
          return
        }
        const baseGroup = draft.groups.find((group) => group.members.length > 0) ?? draft.groups[0]
        const pars = baseGroup ? scoreParsForGroup(baseGroup) : Array.from({ length: 18 }, () => 4)
        const moneyParticipants = draft.groups
          .filter((_, index) => moneyGroupIds.includes(moneyGroupKey(index)))
          .flatMap((group) => group.members.map((member) => member.name))
        const settlement = moneyParticipants.length > 0
          ? {
              participants: Array.from(new Set(moneyParticipants)),
              strokeFee: parseInt(strokeFee, 10) || 3000,
              birdieBonus,
              baepanConditions: { strokeOverpar: baepanOn, tie: baepanOn, birdie: false },
            }
          : undefined
        const saved = await saveRound({
          date: draft.date,
          courseName: draft.courseName ?? baseGroup?.frontLayoutName ?? '이름 없는 코스',
          golfCourseId: draft.courseId,
          pars,
          holeLabels: baseGroup ? scoreHoleLabelsForGroup(baseGroup) : undefined,
          players: uniqueMembers.map((member) => ({ name: member.name, strokes: [...pars] })),
          clubId: club.id,
          settlement,
          scheduleId: draft.id ?? undefined,
        })
        await completeRound(saved.id)
        const itemIds = fillToCount(selectedAwardItems, awardCount)
        const handicaps = new Map(Object.entries(saved.handicaps ?? {}))
        const awards = computeClubAwardResults(itemIds, saved, handicaps, totalPar(saved.pars))
        await saveClubAwardSnapshots(club.id, saved.id, awards)
        setAwardResultRows(toAwardResultRows(awards))
        notifyHomeRecordsChanged(club.id)
        Alert.alert('완료', '저장된 스코어가 없어 전체 파 기록으로 종료했습니다.')
      }
      closeEditor()
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={[s.screen, modalOnly && s.modalOnlyScreen]}>
      {!modalOnly ? (
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.listCard}>
          <View style={s.listHeader}>
            <Text style={s.listTitle}>등록된 일정</Text>
            <Text style={s.listMeta}>{sortedItems.length}건</Text>
          </View>

          {sortedItems.length === 0 ? (
            <TouchableOpacity style={s.emptyCard} onPress={openCreate} activeOpacity={0.86}>
              <Icon name="flag" size={24} color={C.green} />
              <Text style={s.emptyTitle}>등록된 라운드 일정이 없습니다</Text>
              <Text style={s.emptyDesc}>첫 일정을 등록하면 홈 화면의 예정된 라운드 카드와 연결됩니다.</Text>
            </TouchableOpacity>
          ) : (
            sortedItems.map((item) => (
              <TouchableOpacity key={item.id} style={s.scheduleCard} onPress={() => openEdit(item)} activeOpacity={0.86}>
                <View style={s.scheduleIcon}>
                  <Icon name="flag" size={18} color={C.greenDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.scheduleDate}>{item.date}</Text>
                  <Text style={s.scheduleCourse}>{courseSummary(item)}</Text>
                  <Text style={s.scheduleMeta}>{groupSummary(item.groups)}</Text>
                  <Text style={s.scheduleNote}>{memberSummary(item.groups)} · {statusLabel(item.status)}</Text>
                </View>
                <Icon name="chevronRight" size={18} color={C.muted} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
      ) : null}

      <Modal transparent animationType="slide" visible={editorOpen} onRequestClose={closeEditor}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>라운드 수정</Text>
                {lastSavedAt ? <Text style={s.headerSavedText}>✓ 마지막 저장 {lastSavedAt}</Text> : null}
              </View>
              <View style={s.modalHeaderActions}>
                {draft.id ? (
                  <TouchableOpacity style={[s.headerActionButton, s.headerDeleteButton]} onPress={handleDelete} disabled={saving} activeOpacity={0.8}>
                    <Text style={s.headerDeleteText}>삭제</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[s.headerActionButton, draft.isPublished === false ? s.headerPrivateButton : s.headerPublishButton]}
                  onPress={handleTogglePublished}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <Text style={[s.headerPublishText, draft.isPublished === false && s.headerPrivateText]}>
                    {draft.isPublished === false ? '비공개' : '공개'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.headerActionButton, s.headerSaveButton]} onPress={handleSave} disabled={saving || scoreSaveBusy} activeOpacity={0.8}>
                  <Text style={s.headerSaveText}>{saving ? '저장 중' : '저장'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.headerActionButton, s.headerCloseButton]}
                  onPress={closeEditor}
                  disabled={saving || scoreSaveBusy}
                  activeOpacity={0.8}
                >
                  <Text style={s.headerCloseText}>닫기</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.editorTabRow}>
              {ROUND_EDITOR_TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.value}
                  style={[s.editorTabButton, editorTab === tab.value && s.editorTabButtonActive]}
                  onPress={() => setEditorTab(tab.value)}
                  activeOpacity={0.86}
                >
                  <Text style={[s.editorTabText, editorTab === tab.value && s.editorTabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {editorTab === 'basic' ? (
              <>
            <ScrollView contentContainerStyle={s.formBody}>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>라운드 날짜</Text>
                <DateField value={draft.date} onChange={(value) => setDraft((current) => ({ ...current, date: value }))} />
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>골프장</Text>
                <TouchableOpacity style={s.selector} onPress={() => setCoursePickerOpen(true)} activeOpacity={0.84}>
                  <Text style={[s.selectorText, !draft.courseName && s.selectorPlaceholder]}>{draft.courseName ?? '골프장 선택'}</Text>
                  <Icon name="chevronRight" size={18} color={C.muted} />
                </TouchableOpacity>
              </View>

              <View style={s.fieldGroup}>
                <View style={s.inlineHeader}>
                  <Text style={s.fieldLabel}>조편성 관리</Text>
                  <TouchableOpacity style={s.addGroupButton} onPress={addGroup} activeOpacity={0.86}>
                    <Icon name="plus" size={14} color={C.accentText} />
                    <Text style={s.addGroupText}>조 추가</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.groupList}>
                  {draft.groups.map((group, index) => (
                    <View key={group.id} style={s.groupCard}>
                      <View style={s.groupHeader}>
                        <Text style={s.groupTitle}>{index + 1}조</Text>
                        {draft.groups.length > 1 && (
                          <TouchableOpacity onPress={() => removeGroup(group.id)} activeOpacity={0.8}>
                            <Text style={s.groupRemove}>삭제</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={s.timeInputWrap}>
                        <Text style={s.timeInputLabel}>티오프 시간</Text>
                        <TextInput
                          value={group.time}
                          onChangeText={(value) => updateGroup(group.id, { time: normalizeTimeInput(value) })}
                          placeholder="예: 06:32"
                          placeholderTextColor={C.muted}
                          style={s.timeInput}
                        />
                      </View>

                      <View style={s.coursePairRow}>
                        <View style={s.courseTagBlock}>
                          <Text style={s.groupSelectorLabel}>전반 코스</Text>
                          <View style={s.courseTagRow}>
                            {courseLayoutOptions.length === 0 ? (
                              <Text style={s.emptyMemberText}>{draft.courseId ? '등록된 코스가 없습니다' : '골프장을 먼저 선택하세요'}</Text>
                            ) : courseLayoutOptions.map((layout) => {
                              const active = group.frontLayoutId === layout.id
                              return (
                                <TouchableOpacity
                                  key={`front-${group.id}-${layout.id}`}
                                  style={[s.courseTag, active && s.courseTagActive]}
                                  onPress={() => toggleLayoutTag(group.id, 'front', layout)}
                                  activeOpacity={0.84}
                                >
                                  <Text style={[s.courseTagText, active && s.courseTagTextActive]}>{layout.name}</Text>
                                </TouchableOpacity>
                              )
                            })}
                          </View>
                        </View>

                        <View style={s.courseTagBlock}>
                          <Text style={s.groupSelectorLabel}>후반 코스</Text>
                          <View style={s.courseTagRow}>
                            {courseLayoutOptions.length === 0 ? (
                              <Text style={s.emptyMemberText}>{draft.courseId ? '등록된 코스가 없습니다' : '골프장을 먼저 선택하세요'}</Text>
                            ) : courseLayoutOptions.map((layout) => {
                              const active = group.backLayoutId === layout.id
                              return (
                                <TouchableOpacity
                                  key={`back-${group.id}-${layout.id}`}
                                  style={[s.courseTag, active && s.courseTagActive]}
                                  onPress={() => toggleLayoutTag(group.id, 'back', layout)}
                                  activeOpacity={0.84}
                                >
                                  <Text style={[s.courseTagText, active && s.courseTagTextActive]}>{layout.name}</Text>
                                </TouchableOpacity>
                              )
                            })}
                          </View>
                        </View>

                        <View style={s.courseTagBlock}>
                          <Text style={s.groupSelectorLabel}>추가 코스</Text>
                          <View style={s.courseTagRow}>
                            {courseLayoutOptions.length === 0 ? (
                              <Text style={s.emptyMemberText}>{draft.courseId ? '등록된 코스가 없습니다' : '골프장을 먼저 선택하세요'}</Text>
                            ) : courseLayoutOptions.map((layout) => {
                              const active = draft.layoutId === layout.id
                              return (
                                <TouchableOpacity
                                  key={`extra-${group.id}-${layout.id}`}
                                  style={[s.courseTag, active && s.courseTagActive]}
                                  onPress={() => toggleLayoutTag(group.id, 'extra', layout)}
                                  activeOpacity={0.84}
                                >
                                  <Text style={[s.courseTagText, active && s.courseTagTextActive]}>{layout.name}</Text>
                                </TouchableOpacity>
                              )
                            })}
                          </View>
                        </View>
                      </View>

                      <View style={s.memberSection}>
                        <Text style={s.memberSectionLabel}>배정된 회원</Text>
                        <View style={s.selectedMemberWrap}>
                          {group.members.length === 0 ? (
                            <Text style={s.emptyMemberText}>아직 배정된 회원이 없습니다</Text>
                          ) : (
                            group.members.map((member) => (
                              <View key={member.userId} style={s.selectedMemberChip}>
                                <Text style={s.selectedMemberText}>{member.name}</Text>
                              </View>
                            ))
                          )}
                        </View>
                      </View>

                      <View style={s.memberSection}>
                        <Text style={s.memberSectionLabel}>회원 배정</Text>
                        <View style={s.memberChipWrap}>
                          {sortedClubMembers.map((member) => {
                            const selected = isMemberSelected(group.id, member.userId)
                            const assignedGroupId = memberAssignedGroup(member.userId)
                            const disabled = !!assignedGroupId && assignedGroupId !== group.id
                            const attendance = attendanceMap[member.userId] ?? '미정'

                            return (
                              <TouchableOpacity
                                key={member.userId}
                                style={[
                                  s.memberChip,
                                  selected && s.memberChipActive,
                                  disabled && s.memberChipDisabled,
                                ]}
                                onPress={() => !disabled && toggleGroupMember(group.id, member)}
                                activeOpacity={0.84}
                              >
                                <Text
                                  style={[
                                    s.memberChipText,
                                    selected && s.memberChipTextActive,
                                    disabled && s.memberChipTextDisabled,
                                    !selected && !disabled && { color: attendanceColor(attendance) },
                                  ]}
                                >
                                  {member.name}
                                </Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={s.statusFooter}>
              <View style={{ flex: 1 }}>
                <Text style={s.statusToggleTitle}>조편성 {groupingComplete ? '완료' : '미완료'}</Text>
                <Text style={s.statusToggleDesc}>홈 캐디카드의 조편성 안내에 반영됩니다.</Text>
              </View>
              <TouchableOpacity
                style={[s.statusToggleButton, groupingComplete && s.statusToggleButtonActive]}
                onPress={handleToggleGroupingComplete}
                disabled={saving}
                activeOpacity={0.86}
              >
                <Text style={[s.statusToggleText, groupingComplete && s.statusToggleTextActive]}>
                  {groupingComplete ? '완료' : '미완료'}
                </Text>
              </TouchableOpacity>
            </View>
              </>
            ) : editorTab === 'score' ? (
              <>
                <ScrollView contentContainerStyle={s.scoreBody}>
                  {(() => {
                    const scoreGroups = draft.groups.filter((group) => group.members.length > 0)
                    const completed = scoreGroups.filter((group) => savedScoreGroupIds.includes(group.id)).length
                    return (
                      <View style={s.scoreStatusCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.scoreStatusTitle}>스코어 입력 현황</Text>
                          <Text style={s.scoreStatusMeta}>{completed} / {scoreGroups.length}개 조 입력 완료</Text>
                        </View>
                        <Text style={[s.scoreStatusBadge, completed === scoreGroups.length && scoreGroups.length > 0 && s.scoreStatusBadgeComplete]}>
                          {scoreGroups.length === 0 ? '조편성 전' : completed === scoreGroups.length ? '입력 완료' : `${scoreGroups.length - completed}개 조 미입력`}
                        </Text>
                      </View>
                    )
                  })()}
                  {draft.groups.some((group) => group.members.length > 0) ? (
                    draft.groups.map((group, index) => {
                      const disabled = group.members.length === 0
                      const summary = scoreGroupSummaries[group.id]
                      const isComplete = savedScoreGroupIds.includes(group.id)
                      return (
                        <TouchableOpacity
                          key={group.id}
                          style={[s.scoreGroupCard, disabled && s.scoreGroupCardDisabled]}
                          onPress={() => {
                            if (disabled) return
                            openScoreUpload(group.id)
                          }}
                          disabled={disabled}
                          activeOpacity={0.86}
                        >
                          <View style={s.scoreGroupIcon}>
                            <Icon name="camera" size={18} color={C.green} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={s.scoreGroupHeaderRow}>
                              <Text style={s.scoreGroupTitle}>{group.name || `${index + 1}조`}</Text>
                              {!disabled ? (
                                <Text style={[s.scoreGroupSaveState, isComplete && s.scoreGroupSaveStateDone]}>
                                  {isComplete ? '● 완료' : summary ? '일부 입력' : '미입력'}
                                </Text>
                              ) : null}
                            </View>
                            <Text style={s.scoreGroupMeta}>
                              {group.time?.trim() ? `${group.time} Tee Off` : '티오프 미정'}
                            </Text>
                            {summary?.players?.length ? (
                              <View style={s.scoreSummaryList}>
                                {summary.players.map((player, playerIndex) => (
                                  <View key={`${group.id}-${player.name}`} style={s.scoreSummaryRow}>
                                    <Text style={s.scoreSummaryRank}>
                                      {playerIndex === 0 ? '🥇' : playerIndex === 1 ? '🥈' : playerIndex === 2 ? '🥉' : `${playerIndex + 1}.`}
                                    </Text>
                                    <Text style={s.scoreSummaryName} numberOfLines={1}>{player.name}</Text>
                                    <Text style={s.scoreSummaryTotal}>{player.total}타</Text>
                                  </View>
                                ))}
                                <Text style={s.scoreSummaryAverage}>평균 {summary.average.toFixed(1)}타</Text>
                              </View>
                            ) : (
                              <Text style={s.scoreGroupMembers}>
                                {group.members.length > 0 ? group.members.map((member) => member.name).join(', ') : '배정된 회원 없음'}
                              </Text>
                            )}
                          </View>
                          <Icon name="chevronRight" size={16} color={disabled ? C.border : C.muted} />
                        </TouchableOpacity>
                      )
                    })
                  ) : (
                    <View style={s.editorPlaceholder}>
                      <Icon name="camera" size={28} color={C.green} />
                      <Text style={s.editorPlaceholderTitle}>조편성 후 입력</Text>
                      <Text style={s.editorPlaceholderDesc}>조별 멤버를 배정하면 조별 스코어카드 사진 업로드를 시작할 수 있습니다.</Text>
                    </View>
                  )}
                </ScrollView>
              </>
            ) : editorTab === 'award' ? (
              <ScrollView contentContainerStyle={s.awardBody}>
                <Text style={s.fieldLabel}>시상 대상 인원</Text>
                <TouchableOpacity
                  style={[s.awardCountSelect, groupedParticipantCount <= 0 && s.awardCountSelectDisabled]}
                  onPress={() => groupedParticipantCount > 0 && setAwardCountPickerOpen(true)}
                  disabled={groupedParticipantCount <= 0}
                  activeOpacity={0.86}
                >
                  <View>
                    <Text style={s.awardCountSelectValue}>
                      {groupedParticipantCount > 0 ? `${Math.min(awardCount, groupedParticipantCount)}명` : '조편성 인원 없음'}
                    </Text>
                    <Text style={s.awardCountSelectHint}>최대 {groupedParticipantCount}명 · 조편성 포함 인원 기준</Text>
                  </View>
                  <Text style={s.awardCountSelectArrow}>⌄</Text>
                </TouchableOpacity>

                <View style={s.inlineHeader}>
                  <Text style={s.fieldLabel}>시상 항목</Text>
                  <TouchableOpacity style={s.addGroupButton} onPress={randomizeAwardItems} activeOpacity={0.86}>
                    <Text style={s.addGroupText}>랜덤</Text>
                  </TouchableOpacity>
                </View>

                {AWARD_CATEGORIES.map((category) => (
                  <View key={category.label} style={s.awardCategory}>
                    <Text style={s.awardCategoryTitle}>{category.label}</Text>
                    <View style={s.awardChipRow}>
                      {category.items.map((item) => {
                        const selected = selectedAwardItems.includes(item.id)
                        const special = specialAwardKeys.has(item.id)
                        const multiWinnerSpecial = multiWinnerSpecialAwardKeys.has(item.id)
                        const winnerCount = awardWinnerLimit(item.id)
                        const maxWinnerCount = Math.max(1, Math.min(awardCount, groupedParticipantCount || awardCount))
                        return (
                          <View key={item.id} style={[s.awardOption, special && selected && s.awardOptionSpecialActive, selected && !special && s.awardOptionActive]}>
                            <TouchableOpacity
                              style={[s.awardOptionMain, special && selected && s.awardOptionMainSpecial]}
                              onPress={() => {
                                if (special) {
                                  selectSpecialAwardItem(item.id)
                                  return
                                }
                                toggleAwardItem(item.id)
                              }}
                              activeOpacity={0.86}
                            >
                              <Text style={[s.awardChipText, selected && s.awardChipTextActive]}>
                                {item.icon} {item.label}
                              </Text>
                              {special && selected ? <Text style={s.awardInfoInline}>i</Text> : null}
                            </TouchableOpacity>
                            {multiWinnerSpecial && selected ? (
                              <View style={s.specialAwardStepperInline}>
                                <TouchableOpacity
                                  style={[s.specialAwardStepperButton, winnerCount <= 1 && s.specialAwardStepperButtonDisabled]}
                                  onPress={() => winnerCount > 1 && setSpecialAwardWinnerCount(item.id, winnerCount - 1)}
                                  disabled={winnerCount <= 1}
                                  activeOpacity={0.84}
                                >
                                  <Text style={[s.specialAwardStepperButtonText, winnerCount <= 1 && s.specialAwardStepperButtonTextDisabled]}>-</Text>
                                </TouchableOpacity>
                                <Text style={s.specialAwardStepperValue}>{winnerCount}명</Text>
                                <TouchableOpacity
                                  style={[s.specialAwardStepperButton, winnerCount >= maxWinnerCount && s.specialAwardStepperButtonDisabled]}
                                  onPress={() => winnerCount < maxWinnerCount && setSpecialAwardWinnerCount(item.id, winnerCount + 1)}
                                  disabled={winnerCount >= maxWinnerCount}
                                  activeOpacity={0.84}
                                >
                                  <Text style={[s.specialAwardStepperButtonText, winnerCount >= maxWinnerCount && s.specialAwardStepperButtonTextDisabled]}>+</Text>
                                </TouchableOpacity>
                              </View>
                            ) : null}
                          </View>
                        )
                      })}
                    </View>
                  </View>
                ))}
                <Text style={s.awardHelpText}>특별상은 시상 결과에서 2명 이상 수상자로 지정할 수 있습니다.</Text>

                <View style={s.awardResultCard}>
                  <View style={s.awardResultHeader}>
                    <Text style={s.awardResultTitle}>시상 결과</Text>
                    <TouchableOpacity
                      style={s.awardResultRefresh}
                      onPress={() => loadAwardResults(draft.id)}
                      disabled={!draft.id || awardResultLoading}
                      activeOpacity={0.84}
                    >
                      <Text style={s.awardResultRefreshText}>{awardResultLoading ? '확인중' : '새로고침'}</Text>
                    </TouchableOpacity>
                  </View>
                  {awardResultLoading ? (
                    <View style={s.awardResultEmpty}>
                      <ActivityIndicator color={C.green} />
                      <Text style={s.awardResultEmptyText}>시상 결과를 불러오고 있습니다.</Text>
                    </View>
                  ) : awardResultRows.length > 0 ? (
                    <View style={s.awardResultList}>
                      {awardResultRows.map((award, index) => {
                        const editable = isEditableAwardResult(award)
                        const multiple = specialAwardKeys.has(award.awardKey)
                        const selectedWinnerCount = awardWinnerNames(award.winner).length
                        const winnerLimit = awardWinnerLimit(award.awardKey)
                        return (
                          <View key={`${award.awardKey}-${index}`} style={s.awardResultRow}>
                            <View style={s.awardResultIcon}>
                              <Text style={s.awardResultIconText}>{award.icon}</Text>
                            </View>
                            <Text style={s.awardResultLabel} numberOfLines={1}>{award.label}</Text>
                            <TouchableOpacity
                              style={[s.awardResultWinnerBox, editable && s.awardResultWinnerButton]}
                              onPress={() => editable && setAwardWinnerPicker({ awardKey: award.awardKey, multiple })}
                              disabled={!editable}
                              activeOpacity={0.84}
                            >
                              <Text style={s.awardResultWinner} numberOfLines={1}>{award.winner || '미지정'}</Text>
                              <Text style={s.awardResultDetail} numberOfLines={1}>
                                {editable ? (multiple ? `수상자 선택 ${selectedWinnerCount}/${winnerLimit}` : '수상자 선택') : (award.detail || '자동 선정')}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )
                      })}
                    </View>
                  ) : (
                    <View style={s.awardResultEmpty}>
                      <Text style={s.awardResultEmptyTitle}>아직 시상 결과가 없습니다.</Text>
                      <Text style={s.awardResultEmptyText}>스코어 저장 후 자동 시상 결과가 표시됩니다.</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            ) : (
              <ScrollView contentContainerStyle={s.awardBody}>
                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>타당 금액</Text>
                  <View style={s.moneyInputRow}>
                    <TextInput
                      value={strokeFee}
                      onChangeText={(value) => setStrokeFee(value.replace(/[^0-9]/g, '').slice(0, 6))}
                      keyboardType="numeric"
                      style={s.moneyInput}
                      placeholder="3000"
                      placeholderTextColor={C.muted}
                    />
                    <Text style={s.moneyUnit}>원</Text>
                  </View>
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>버디 보너스</Text>
                  <View style={s.awardChipRow}>
                    {([5000, 10000] as const).map((value) => (
                      <TouchableOpacity
                        key={value}
                        style={[s.awardChip, birdieBonus === value && s.awardChipActive]}
                        onPress={() => setBirdieBonus(value)}
                        activeOpacity={0.86}
                      >
                        <Text style={[s.awardChipText, birdieBonus === value && s.awardChipTextActive]}>
                          {value.toLocaleString('ko-KR')}원
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={s.moneySwitchRow}>
                  <View>
                    <Text style={s.fieldLabel}>배판 조건</Text>
                    <Text style={s.moneyHelpText}>
                      적용 시 아래 조건에서 배판으로 계산합니다.{'\n'}파3: 더블 이상{'\n'}파4/파5: 트리플 이상{'\n'}동타: 2명 이상
                    </Text>
                  </View>
                  <Switch
                    value={baepanOn}
                    onValueChange={setBaepanOn}
                    trackColor={{ false: C.border, true: C.green }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>적용 조 선택</Text>
                  {draft.groups.map((group, index) => {
                    const groupKey = moneyGroupKey(index)
                    const active = moneyGroupIds.includes(groupKey)
                    return (
                      <TouchableOpacity
                        key={group.id}
                        style={[s.moneyGroupCard, active && s.moneyGroupCardActive]}
                        onPress={() => toggleMoneyGroup(groupKey)}
                        activeOpacity={0.86}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.moneyGroupTitle}>{group.name || `${index + 1}조`}</Text>
                          <Text style={s.moneyGroupMeta}>
                            {group.time?.trim() ? group.time : '티오프 미정'} · {group.members.length > 0 ? group.members.map((member) => member.name).join(', ') : '배정 회원 없음'}
                          </Text>
                        </View>
                        <View style={[s.moneyGroupBadge, active && s.moneyGroupBadgeActive]}>
                          <Text style={[s.moneyGroupBadgeText, active && s.moneyGroupBadgeTextActive]}>
                            {active ? '적용' : '미적용'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>로또 추첨자</Text>
                  {!draft.id ? (
                    <Text style={s.moneyHelpText}>일정을 먼저 저장한 뒤 추첨자를 지정할 수 있습니다.</Text>
                  ) : (
                    <>
                      <View style={s.lottoDrafterGrid}>
                        <TouchableOpacity
                          style={[s.lottoDrafterChip, !lottoDrafterUserId && s.lottoDrafterChipActive]}
                          onPress={() => setLottoDrafterUserId(null)}
                          activeOpacity={0.86}
                        >
                          <Text style={[s.lottoDrafterText, !lottoDrafterUserId && s.lottoDrafterTextActive]}>미지정</Text>
                        </TouchableOpacity>
                        {clubMembers.map((member) => {
                          const active = lottoDrafterUserId === member.userId
                          return (
                            <TouchableOpacity
                              key={member.userId}
                              style={[s.lottoDrafterChip, active && s.lottoDrafterChipActive]}
                              onPress={() => setLottoDrafterUserId(member.userId)}
                              activeOpacity={0.86}
                            >
                              <Text style={[s.lottoDrafterText, active && s.lottoDrafterTextActive]}>{member.name}</Text>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={awardCountPickerOpen} onRequestClose={() => setAwardCountPickerOpen(false)}>
        <PickerShell title="시상 대상 인원 선택" onClose={() => setAwardCountPickerOpen(false)}>
          {awardCountOptions.length > 0 ? awardCountOptions.map((count) => (
            <TouchableOpacity
              key={count}
              style={[s.pickerRow, count === awardCount && s.awardCountPickerRowActive]}
              onPress={() => {
                const normalized = normalizeAwardSelection(selectedAwardItems, awardWinnerCounts, count)
                setAwardCount(count)
                setSelectedAwardItems(normalized.items)
                setAwardWinnerCounts(normalized.counts)
                setAwardCountPickerOpen(false)
              }}
              activeOpacity={0.84}
            >
              <Text style={[s.pickerRowText, count === awardCount && s.awardCountPickerTextActive]}>{count}명</Text>
              {count === awardCount ? <Text style={s.awardCountPickerCheck}>✓</Text> : null}
            </TouchableOpacity>
          )) : (
            <Text style={s.pickerEmptyText}>참석으로 등록된 라운드 참가자가 없습니다.</Text>
          )}
        </PickerShell>
      </Modal>

      <Modal transparent animationType="fade" visible={!!awardWinnerPicker} onRequestClose={() => setAwardWinnerPicker(null)}>
        <PickerShell
          title={awardWinnerPicker?.multiple ? '수상자 선택' : '수상자 지정'}
          onClose={() => setAwardWinnerPicker(null)}
        >
          {awardWinnerPicker ? (() => {
            const row = awardResultRows.find((item) => item.awardKey === awardWinnerPicker.awardKey)
            const selectedNames = new Set(row ? awardWinnerNames(row.winner) : [])
            const candidates = awardCandidates(awardWinnerPicker.awardKey)
            const winnerLimit = awardWinnerLimit(awardWinnerPicker.awardKey)
            return candidates.length > 0 ? candidates.map((member) => {
              const selected = selectedNames.has(member.name)
              const disabledByLimit = awardWinnerPicker.multiple && !selected && selectedNames.size >= winnerLimit
              return (
                <TouchableOpacity
                  key={`${awardWinnerPicker.awardKey}-${member.userId || member.name}`}
                  style={[s.pickerRow, selected && s.awardCountPickerRowActive, disabledByLimit && s.pickerRowDisabled]}
                  onPress={() => toggleAwardResultWinner(awardWinnerPicker.awardKey, member, awardWinnerPicker.multiple)}
                  activeOpacity={0.84}
                >
                  <Text style={[s.pickerRowText, selected && s.awardCountPickerTextActive, disabledByLimit && s.pickerRowDisabledText]}>{member.name}</Text>
                  {selected ? <Text style={s.awardCountPickerCheck}>✓</Text> : null}
                </TouchableOpacity>
              )
            }) : (
              <Text style={s.pickerEmptyText}>선택 가능한 미수상자가 없습니다.</Text>
            )
          })() : null}
        </PickerShell>
      </Modal>

      <Modal transparent animationType="fade" visible={!!scoreGroupId} onRequestClose={closeScoreUpload}>
        <View style={s.pickerBackdrop}>
          <View style={s.pickerCard}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>{selectedScoreGroup?.name ?? '조'} 스코어</Text>
              <TouchableOpacity onPress={closeScoreUpload} activeOpacity={0.84}>
                <Text style={s.pickerClose}>닫기</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.scoreUploadBody}>
              {selectedScoreGroup && (
                <View style={s.scoreUploadGroupBox}>
                  <Text style={s.scoreUploadGroupTitle}>{selectedScoreGroup.members.map((member) => member.name).join(', ')}</Text>
                  <Text style={s.scoreGroupMeta}>
                    {selectedScoreGroup.time?.trim() ? selectedScoreGroup.time : '티오프 미정'} · {[selectedScoreGroup.frontLayoutName ?? '전반 미정', selectedScoreGroup.backLayoutName ?? '후반 미정', draft.layoutName].filter(Boolean).join(' / ')}
                  </Text>
                </View>
              )}

              <View style={s.scoreUploadActions}>
                <TouchableOpacity style={s.scoreUploadButton} onPress={takeScorePhoto} disabled={scoreOcrBusy} activeOpacity={0.86}>
                  <Text style={s.scoreUploadButtonText}>사진 찍기</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.scoreUploadButton} onPress={pickScorePhotos} disabled={scoreOcrBusy} activeOpacity={0.86}>
                  <Text style={s.scoreUploadButtonText}>갤러리</Text>
                </TouchableOpacity>
              </View>

              {scorePhotoUris.length > 0 && (
                <View style={s.scorePhotoSection}>
                  <Text style={s.scorePhotoCount}>선택된 사진 {scorePhotoUris.length}장</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {scorePhotoUris.map((uri, index) => (
                      <TouchableOpacity
                        key={`${uri}-${index}`}
                        onPress={() => {
                          setScorePhotoUris((current) => current.filter((_, photoIndex) => photoIndex !== index))
                          setScoreOcrResult(null)
                          setScoreOcrMemberMap({})
                          setScoreOcrError('')
                        }}
                        activeOpacity={0.84}
                      >
                        <Image source={{ uri }} style={s.scorePhotoThumb} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {scorePhotoUris.length > 0 && !scoreOcrResult && (
                <TouchableOpacity style={[s.scoreOcrButton, scoreOcrBusy && { opacity: 0.6 }]} onPress={runScoreOcr} disabled={scoreOcrBusy} activeOpacity={0.86}>
                  {scoreOcrBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.scoreOcrButtonText}>{scorePhotoUris.length}장 인식 시작</Text>}
                </TouchableOpacity>
              )}

              {scoreOcrError !== '' && <Text style={s.scoreOcrError}>{scoreOcrError}</Text>}

              {scoreOcrResult && (
                <View style={s.scoreOcrResult}>
                  <Text style={s.scoreOcrResultTitle}>인식 결과 · 저장 전</Text>
                  <Text style={s.scoreOcrMatchHelp}>OCR 이름이 실제 조 멤버와 다르면 아래에서 실제 회원을 선택해 주세요.</Text>
                  {scoreOcrResult.players.some((player) => player.name.includes('(미인식)')) ? (
                    <Text style={s.scoreOcrWarning}>OCR이 놓친 멤버는 미인식 행으로 추가했습니다. 저장 후 스코어 탭에서 해당 점수를 확인해 주세요.</Text>
                  ) : null}
                  {scoreOcrResult.players.map((player, index) => {
                    const total = player.diffs.reduce<number>((sum, diff, holeIndex) => sum + ((scoreOcrResult.pars[holeIndex] ?? 4) + (diff ?? 0)), 0)
                    const selectedUserId = scoreOcrMemberMap[index]
                    return (
                      <View key={`${player.name}-${index}`} style={s.scoreOcrRow}>
                        <View style={s.scoreOcrInfo}>
                          <View style={s.scoreOcrNameRow}>
                            <Text style={s.scoreOcrName}>OCR: {player.name || `플레이어 ${index + 1}`}</Text>
                            <Text style={s.scoreOcrTotal}>{total}타</Text>
                          </View>
                          {selectedScoreGroup ? (
                            <View style={s.scoreOcrMemberRow}>
                              {selectedScoreGroup.members.map((member) => {
                                const selected = selectedUserId === member.userId
                                return (
                                  <TouchableOpacity
                                    key={`${index}-${member.userId}`}
                                    style={[s.scoreOcrMemberChip, selected && s.scoreOcrMemberChipActive]}
                                    onPress={() => toggleScoreOcrMember(index, member)}
                                    activeOpacity={0.84}
                                  >
                                    <Text style={[s.scoreOcrMemberChipText, selected && s.scoreOcrMemberChipTextActive]}>
                                      {member.name}
                                    </Text>
                                  </TouchableOpacity>
                                )
                              })}
                            </View>
                          ) : null}
                        </View>
                      </View>
                    )
                  })}
                  {selectedScoreGroup ? (
                    <Text style={s.scoreOcrMatchStatus}>
                      매칭 {Object.values(scoreOcrMemberMap).filter((userId) => selectedScoreGroup.members.some((member) => member.userId === userId)).length} / {selectedScoreGroup.members.length}명
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    style={[s.scoreSaveButton, scoreSaveBusy && { opacity: 0.6 }]}
                    onPress={saveScoreResult}
                    disabled={scoreSaveBusy}
                    activeOpacity={0.86}
                  >
                    {scoreSaveBusy ? <ActivityIndicator color={C.accentText} /> : <Text style={s.scoreSaveButtonText}>이 조 스코어 저장</Text>}
                  </TouchableOpacity>
                  <Text style={s.scoreSaveHelp}>저장 완료 후 스코어 탭의 입력 현황에 즉시 반영됩니다.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={coursePickerOpen} onRequestClose={() => { setCoursePickerOpen(false); setCourseSearch('') }}>
        <PickerShell title="골프장 선택" onClose={() => { setCoursePickerOpen(false); setCourseSearch('') }}>
          <TextInput
            style={s.pickerSearchInput}
            value={courseSearch}
            onChangeText={setCourseSearch}
            placeholder="골프장명 또는 지역 검색"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
          />
          <TouchableOpacity style={s.pickerRow} onPress={() => selectCourse(null)} activeOpacity={0.84}>
            <Text style={s.pickerRowText}>미정</Text>
          </TouchableOpacity>
          {filteredCourses.length === 0 ? (
            <Text style={s.pickerEmptyText}>검색 결과가 없습니다</Text>
          ) : filteredCourses.map((course) => (
            <TouchableOpacity key={course.id} style={s.pickerRow} onPress={() => selectCourse(course)} activeOpacity={0.84}>
              <Text style={s.pickerRowText}>{course.name}</Text>
              <Text style={s.pickerRowMeta}>{course.region}</Text>
            </TouchableOpacity>
          ))}
        </PickerShell>
      </Modal>

      <Modal transparent animationType="fade" visible={!!layoutPickerTarget} onRequestClose={() => setLayoutPickerTarget(null)}>
        <PickerShell title={layoutPickerTarget?.side === 'front' ? '전반 코스 선택' : '후반 코스 선택'} onClose={() => setLayoutPickerTarget(null)}>
          <TouchableOpacity style={s.pickerRow} onPress={() => selectLayout(null)} activeOpacity={0.84}>
            <Text style={s.pickerRowText}>미정</Text>
          </TouchableOpacity>
          {layouts.map((layout) => (
            <TouchableOpacity key={layout.id} style={s.pickerRow} onPress={() => selectLayout(layout)} activeOpacity={0.84}>
              <Text style={s.pickerRowText}>{layout.name}</Text>
              <Text style={s.pickerRowMeta}>{layout.holes}홀</Text>
            </TouchableOpacity>
          ))}
        </PickerShell>
      </Modal>
    </View>
  )
}

function PickerShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <View style={s.pickerBackdrop}>
      <View style={s.pickerCard}>
        <View style={s.pickerHeader}>
          <Text style={s.pickerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
            <Text style={s.pickerClose}>닫기</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.pickerBody}>{children}</ScrollView>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  modalOnlyScreen: { backgroundColor: 'transparent' },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  heroCard: {
    borderRadius: 28,
    backgroundColor: '#142218',
    padding: 24,
    gap: 18,
  },
  heroEyebrow: { fontSize: 14, fontWeight: '700', color: '#b9d1c0', marginBottom: 8 },
  heroTitle: { fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 10 },
  heroDesc: { fontSize: 15, lineHeight: 23, color: '#d8e5dc' },
  heroButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: C.accent,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  heroButtonText: { fontSize: 15, fontWeight: '900', color: C.accentText },
  listCard: {
    borderRadius: 26,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 14,
  },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listTitle: { fontSize: 23, fontWeight: '900', color: C.text },
  listMeta: { fontSize: 13, fontWeight: '800', color: C.green },
  emptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#f8fbf8',
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  emptyDesc: { fontSize: 13, lineHeight: 20, color: C.muted, textAlign: 'center' },
  scheduleCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scheduleIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e7f3eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleDate: { fontSize: 14, fontWeight: '800', color: C.green },
  scheduleCourse: { fontSize: 20, fontWeight: '900', color: C.text, marginTop: 4 },
  scheduleMeta: { fontSize: 13, fontWeight: '800', color: C.text, marginTop: 8 },
  scheduleNote: { fontSize: 13, lineHeight: 19, color: C.muted, marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 18, 0.24)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '92%',
    maxHeight: '92%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: C.text },
  headerSavedText: { marginTop: 3, fontSize: 11, fontWeight: '800', color: C.green },
  modalHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerActionButton: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDeleteButton: { backgroundColor: '#f8e9e6' },
  headerPublishButton: { backgroundColor: '#e8f6ee', borderWidth: 1, borderColor: C.green },
  headerPrivateButton: { backgroundColor: '#f2f3f2', borderWidth: 1, borderColor: C.border },
  headerSaveButton: { backgroundColor: C.accent },
  headerCloseButton: { backgroundColor: '#eef2ee' },
  headerDeleteText: { fontSize: 13, fontWeight: '900', color: '#d65b4a' },
  headerPublishText: { fontSize: 13, fontWeight: '900', color: C.green },
  headerPrivateText: { color: C.muted },
  headerSaveText: { fontSize: 13, fontWeight: '900', color: C.accentText },
  headerCloseText: { fontSize: 13, fontWeight: '900', color: C.text },
  editorTabRow: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 999,
    backgroundColor: '#eef2ee',
    padding: 4,
    marginBottom: 14,
  },
  editorTabButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 10,
  },
  editorTabButtonActive: { backgroundColor: C.accent },
  editorTabText: { fontSize: 13, fontWeight: '900', color: C.muted },
  editorTabTextActive: { color: C.accentText },
  editorPlaceholder: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#f8fbf8',
    padding: 24,
  },
  editorPlaceholderTitle: { fontSize: 18, fontWeight: '900', color: C.text },
  editorPlaceholderDesc: { fontSize: 13, lineHeight: 20, color: C.muted, textAlign: 'center' },
  scoreStatusCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: '#F8FAF9', marginBottom: 2 },
  scoreStatusTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  scoreStatusMeta: { marginTop: 3, fontSize: 12, fontWeight: '700', color: C.muted },
  scoreStatusBadge: { fontSize: 11, fontWeight: '900', color: '#B66A18', backgroundColor: '#FFF3E8', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  scoreStatusBadgeComplete: { color: C.greenDark, backgroundColor: '#E9F6EE' },
  scoreGroupSaveState: { fontSize: 11, fontWeight: '900', color: '#B66A18', marginRight: 4 },
  scoreGroupSaveStateDone: { color: C.green },
  scoreSaveHelp: { marginTop: 8, textAlign: 'center', fontSize: 11, fontWeight: '700', color: C.muted },
  scoreBody: { flexGrow: 1, gap: 10, paddingBottom: 20 },
  scoreGroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    padding: 14,
  },
  scoreGroupCardDisabled: { opacity: 0.55 },
  scoreGroupIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.greenLight,
  },
  scoreGroupHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  scoreGroupTitle: { fontSize: 16, fontWeight: '900', color: C.text },
  scoreGroupMeta: { fontSize: 12, fontWeight: '700', color: C.muted, marginTop: 4 },
  scoreGroupMembers: { fontSize: 13, fontWeight: '800', color: C.text, marginTop: 6, lineHeight: 18 },
  scoreSummaryList: { marginTop: 8, gap: 4 },
  scoreSummaryRow: { flexDirection: 'row', alignItems: 'center', minHeight: 22 },
  scoreSummaryRank: { width: 28, fontSize: 14 },
  scoreSummaryName: { flex: 1, fontSize: 13, fontWeight: '800', color: C.text },
  scoreSummaryTotal: { fontSize: 13, fontWeight: '900', color: C.green },
  scoreSummaryAverage: { marginTop: 4, fontSize: 12, fontWeight: '800', color: C.muted },
  scoreUploadBody: { gap: 12, paddingBottom: 4 },
  scoreUploadGroupBox: {
    borderRadius: 16,
    backgroundColor: '#f8fbf8',
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  scoreUploadGroupTitle: { fontSize: 14, fontWeight: '900', color: C.text, lineHeight: 20 },
  scoreUploadActions: { flexDirection: 'row', gap: 10 },
  scoreUploadButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: C.greenLight,
    alignItems: 'center',
    paddingVertical: 13,
  },
  scoreUploadButtonText: { fontSize: 14, fontWeight: '900', color: C.green },
  scorePhotoSection: { gap: 8 },
  scorePhotoCount: { fontSize: 12, fontWeight: '800', color: C.muted },
  scorePhotoThumb: { width: 94, height: 72, borderRadius: 12, marginRight: 8, backgroundColor: C.border },
  scoreOcrButton: {
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: 'center',
    paddingVertical: 14,
  },
  scoreOcrButtonText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  scoreOcrError: { fontSize: 13, fontWeight: '700', color: '#d65b4a', lineHeight: 19 },
  scoreOcrResult: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.greenLight,
    backgroundColor: '#f8fff8',
    padding: 14,
  },
  scoreOcrResultTitle: { fontSize: 13, fontWeight: '900', color: C.muted, marginBottom: 8 },
  scoreOcrMatchHelp: { fontSize: 12, fontWeight: '700', color: C.muted, lineHeight: 18, marginBottom: 8 },
  scoreOcrWarning: { fontSize: 12, fontWeight: '800', color: '#B66A18', backgroundColor: '#FFF3E8', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, lineHeight: 18, marginBottom: 8 },
  scoreOcrRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  scoreOcrInfo: { gap: 8 },
  scoreOcrNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  scoreOcrName: { fontSize: 14, fontWeight: '800', color: C.text },
  scoreOcrTotal: { fontSize: 14, fontWeight: '900', color: C.green },
  scoreOcrMemberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scoreOcrMemberChip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  scoreOcrMemberChipActive: { backgroundColor: C.green, borderColor: C.green },
  scoreOcrMemberChipText: { fontSize: 12, fontWeight: '900', color: C.text },
  scoreOcrMemberChipTextActive: { color: '#fff' },
  scoreOcrMatchStatus: { marginTop: 8, fontSize: 12, fontWeight: '900', color: C.green },
  scoreSaveButton: {
    borderRadius: 14,
    backgroundColor: C.accent,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 12,
  },
  scoreSaveButtonText: { fontSize: 14, fontWeight: '900', color: C.accentText },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#f8fbf8',
    padding: 14,
  },
  statusToggleTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  statusToggleDesc: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: C.muted, marginTop: 3 },
  statusToggleButton: {
    minWidth: 82,
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  statusToggleButtonActive: { backgroundColor: C.green, borderColor: C.green },
  statusToggleText: { fontSize: 13, fontWeight: '900', color: C.muted },
  statusToggleTextActive: { color: '#fff' },
  awardBody: { flexGrow: 1, gap: 14, paddingBottom: 20 },
  awardChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  awardChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  awardChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  awardChipText: { fontSize: 13, fontWeight: '800', color: C.text },
  awardChipTextActive: { color: C.accentText },
  awardCategory: { gap: 8 },
  awardCategoryTitle: { fontSize: 13, fontWeight: '800', color: C.muted },
  awardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  awardOptionActive: { backgroundColor: C.accent, borderColor: C.accent },
  awardOptionSpecialActive: { backgroundColor: C.accent, borderColor: C.accent, paddingRight: 5 },
  awardOptionMain: { paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  awardOptionMainSpecial: { paddingRight: 4 },
  awardInfoInline: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: C.accentText,
    textAlign: 'center',
    lineHeight: 12,
    fontSize: 9,
    fontWeight: '900',
    color: C.accentText,
  },
  specialAwardStepperInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  specialAwardStepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dfffa3',
  },
  specialAwardStepperButtonDisabled: { opacity: 0.45 },
  specialAwardStepperButtonText: { fontSize: 20, lineHeight: 22, fontWeight: '900', color: C.text },
  specialAwardStepperButtonTextDisabled: { color: C.muted },
  specialAwardStepperValue: { minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: '900', color: C.accentText },
  awardResultCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    padding: 14,
    gap: 12,
  },
  awardResultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  awardResultTitle: { fontSize: 16, fontWeight: '900', color: C.text },
  awardResultRefresh: {
    borderRadius: 999,
    backgroundColor: C.greenLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  awardResultRefreshText: { fontSize: 12, fontWeight: '900', color: C.green },
  awardResultList: { gap: 2 },
  awardResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingVertical: 8,
  },
  awardResultIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.greenLight,
  },
  awardResultIconText: { fontSize: 17 },
  awardResultLabel: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '900', color: C.text },
  awardResultWinnerBox: { width: 112, minWidth: 0, alignItems: 'flex-end' },
  awardResultWinnerButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.greenLight,
    backgroundColor: '#f8fff8',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  awardResultWinner: { maxWidth: '100%', fontSize: 14, fontWeight: '900', color: C.green },
  awardResultDetail: { maxWidth: '100%', marginTop: 2, fontSize: 11, fontWeight: '700', color: C.muted },
  awardResultEmpty: {
    minHeight: 80,
    borderRadius: 14,
    backgroundColor: '#f8fbf8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
  },
  awardResultEmptyTitle: { fontSize: 14, fontWeight: '900', color: C.text },
  awardResultEmptyText: { fontSize: 12, fontWeight: '700', color: C.muted, textAlign: 'center', lineHeight: 18 },
  moneyInputRow: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  moneyInput: { flex: 1, fontSize: 18, fontWeight: '900', color: C.text, paddingVertical: 12 },
  moneyUnit: { fontSize: 14, fontWeight: '800', color: C.muted },
  moneySwitchRow: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  moneyHelpText: { fontSize: 12, fontWeight: '700', color: C.muted, marginTop: 4 },
  moneyGroupCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moneyGroupCardActive: { borderColor: C.green, backgroundColor: '#f5fff7' },
  moneyGroupTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  moneyGroupMeta: { fontSize: 12, fontWeight: '700', color: C.muted, marginTop: 5, lineHeight: 18 },
  moneyGroupBadge: {
    borderRadius: 999,
    backgroundColor: '#eef2ee',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  moneyGroupBadgeActive: { backgroundColor: C.accent },
  moneyGroupBadgeText: { fontSize: 12, fontWeight: '900', color: C.muted },
  moneyGroupBadgeTextActive: { color: C.accentText },
  lottoDrafterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lottoDrafterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f5f3',
    borderWidth: 1,
    borderColor: C.border,
  },
  lottoDrafterChipActive: { backgroundColor: C.greenLight, borderColor: C.green },
  lottoDrafterText: { fontSize: 12, fontWeight: '900', color: C.muted },
  lottoDrafterTextActive: { color: C.green },
  lottoDrafterSaveBtn: {
    marginTop: 12,
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButton: {
    borderRadius: 999,
    backgroundColor: '#eef2ee',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeButtonText: { fontSize: 14, fontWeight: '800', color: C.text },
  formBody: { flexGrow: 1, gap: 18, paddingBottom: 12 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '800', color: C.text },
  selector: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorDisabled: { opacity: 0.45 },
  selectorText: { fontSize: 16, color: C.text, fontWeight: '700', flex: 1 },
  selectorPlaceholder: { color: C.muted, fontWeight: '600' },
  inlineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: C.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addGroupText: { fontSize: 12, fontWeight: '900', color: C.accentText },
  groupList: { gap: 10 },
  groupCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 14,
    gap: 14,
  },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  groupRemove: { fontSize: 13, fontWeight: '800', color: '#d65b4a' },
  timeInputWrap: { gap: 8 },
  timeInputLabel: { fontSize: 13, fontWeight: '700', color: C.muted },
  coursePairRow: { gap: 10 },
  courseTagBlock: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#f8fbf8',
  },
  courseTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  courseTag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  courseTagActive: { backgroundColor: C.accent, borderColor: C.accent },
  courseTagText: { fontSize: 12, fontWeight: '800', color: C.muted },
  courseTagTextActive: { color: C.accentText },
  groupSelector: { minHeight: 70 },
  groupSelectorLabel: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 },
  timeInput: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
    backgroundColor: '#fff',
  },
  memberSection: { gap: 8 },
  memberSectionLabel: { fontSize: 13, fontWeight: '800', color: C.text },
  selectedMemberWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectedMemberChip: {
    borderRadius: 999,
    backgroundColor: '#e7f3eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedMemberText: { fontSize: 13, fontWeight: '800', color: C.greenDark },
  emptyMemberText: { fontSize: 13, color: C.muted },
  memberChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  memberChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  memberChipDisabled: {
    backgroundColor: '#f2f3f2',
    borderColor: '#e0e2e0',
  },
  memberChipText: { fontSize: 13, fontWeight: '800', color: C.text },
  memberChipTextActive: { color: C.accentText },
  memberChipTextDisabled: { color: '#9aa09c' },
  footer: { flexDirection: 'row', gap: 8, marginTop: 12 },
  deleteButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#f8e9e6',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: { fontSize: 16, fontWeight: '900', color: '#d65b4a' },
  saveButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: C.accent,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { fontSize: 16, fontWeight: '900', color: C.accentText },
  finishButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: C.greenDark,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  confirmButton: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#edf5ee',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: { fontSize: 16, fontWeight: '900', color: C.greenDark },
  awardCountSelect: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  awardCountSelectDisabled: { opacity: 0.55 },
  awardCountSelectValue: { fontSize: 16, fontWeight: '900', color: C.text },
  awardCountSelectHint: { marginTop: 3, fontSize: 12, fontWeight: '700', color: C.muted },
  awardCountSelectArrow: { fontSize: 22, fontWeight: '900', color: C.green },
  awardCountPickerRowActive: { backgroundColor: '#e7f6ed' },
  awardCountPickerTextActive: { color: C.green },
  awardCountPickerCheck: { fontSize: 18, fontWeight: '900', color: C.green },
  awardHelpText: { fontSize: 12, lineHeight: 18, color: C.muted, fontWeight: '700' },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 18, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '80%',
    borderRadius: 24,
    backgroundColor: '#fff',
    padding: 20,
  },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pickerTitle: { fontSize: 22, fontWeight: '900', color: C.text },
  pickerClose: { fontSize: 14, fontWeight: '800', color: C.green },
  pickerBody: { gap: 10, paddingBottom: 4 },
  pickerSearchInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    backgroundColor: '#f8fbf8',
  },
  pickerEmptyText: { textAlign: 'center', color: C.muted, fontSize: 13, fontWeight: '700', paddingVertical: 16 },
  pickerRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  pickerRowDisabled: { opacity: 0.45 },
  pickerRowText: { fontSize: 15, fontWeight: '800', color: C.text },
  pickerRowDisabledText: { color: C.muted },
  pickerRowMeta: { fontSize: 12, color: C.muted, marginTop: 4 },
})
