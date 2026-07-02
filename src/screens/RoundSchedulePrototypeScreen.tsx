import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import DateField, { todayLocal } from '../components/DateField'
import { Icon } from '../components/Icon'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
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
import { completeRound, getClubAwardConfig, getClubMembers, getClubSettlement, getCourseLayouts, getGolfCourses, getRounds, saveClubAwardConfig, saveClubAwardSnapshots, saveClubSettlement, saveRound, totalPar, type CourseLayout, type GolfCourse } from '../lib/store'
import { AWARD_CATEGORIES, fillToCount } from '../lib/awardConfig'
import { computeClubAwardResults } from '../lib/awardResults'
import { recognizeScorecard, mergeScorecards, type RecognizedScorecard } from '../features/ocr'
import { findBestOcrMatch } from '../lib/nameMatch'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>

type ClubMember = { userId: string; name: string; role: string }
type RoundEditorTab = 'basic' | 'score' | 'award' | 'money'

const ROUND_EDITOR_TABS: Array<{ value: RoundEditorTab; label: string }> = [
  { value: 'basic', label: '기본' },
  { value: 'score', label: '스코어' },
  { value: 'award', label: '시상' },
  { value: 'money', label: '머니게임' },
]

type Draft = {
  id: string | null
  date: string
  courseId?: string
  courseName?: string
  status: RoundScheduleStatus
  attendanceMode: RoundAttendanceMode
  note: string
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

export default function RoundSchedulePrototypeScreen() {
  const nav = useNavigation<Nav>()
  const { activeClub: club } = useClub()

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
  const [selectedAwardItems, setSelectedAwardItems] = useState<string[]>(['medal', 'birdieKing', 'last'])
  const [awardSaving, setAwardSaving] = useState(false)
  const [strokeFee, setStrokeFee] = useState('3000')
  const [birdieBonus, setBirdieBonus] = useState<5000 | 10000>(5000)
  const [baepanOn, setBaepanOn] = useState(true)
  const [moneyGroupIds, setMoneyGroupIds] = useState<string[]>([])
  const [moneySaving, setMoneySaving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft>(createEmptyDraft())
  const [coursePickerOpen, setCoursePickerOpen] = useState(false)
  const [layoutPickerTarget, setLayoutPickerTarget] = useState<{ groupId: string; side: 'front' | 'back' } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [attendanceMap, setAttendanceMap] = useState<Record<string, RoundAttendanceLabel>>({})
  const [scoreGroupId, setScoreGroupId] = useState<string | null>(null)
  const [scorePhotoUris, setScorePhotoUris] = useState<string[]>([])
  const [scoreOcrBusy, setScoreOcrBusy] = useState(false)
  const [scoreSaveBusy, setScoreSaveBusy] = useState(false)
  const [scoreOcrResult, setScoreOcrResult] = useState<RecognizedScorecard | null>(null)
  const [scoreOcrError, setScoreOcrError] = useState('')
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  useEffect(() => {
    if (!club?.id) return

    const queueRefresh = () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current)
      realtimeTimer.current = setTimeout(() => {
        setRefreshKey((key) => key + 1)
      }, 500)
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
    () => [...items].sort((a, b) => `${a.date} ${a.time || '99:99'}`.localeCompare(`${b.date} ${b.time || '99:99'}`)),
    [items]
  )
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

  function attendanceColor(status: RoundAttendanceLabel) {
    if (status === '참석') return C.green
    if (status === '불참') return '#d65b4a'
    return C.muted
  }

  function openCreate() {
    setDraft(createEmptyDraft())
    setMoneyGroupIds([])
    setLayouts([])
    setEditorTab('basic')
    setEditorOpen(true)
  }

  function openEdit(item: ScheduledRound) {
    const savedMoneyGroups = item.moneyGroupIds ?? []
    setDraft({
      id: item.id,
      date: item.date,
      courseId: item.courseId,
      courseName: item.courseName,
      status: item.status,
      attendanceMode: item.attendanceMode,
      note: item.note,
      groups: item.groups.length > 0 ? item.groups : [createGroup(1)],
    })
    setMoneyGroupIds(item.groups
      .map((group, index) => {
        const key = moneyGroupKey(index)
        return savedMoneyGroups.includes(key) || savedMoneyGroups.includes(group.id) ? key : null
      })
      .filter((key): key is string => key !== null))
    setEditorTab('basic')
    setEditorOpen(true)
  }

  function toggleAwardItem(id: string) {
    setSelectedAwardItems((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ))
  }

  function randomizeAwardItems() {
    const items = AWARD_CATEGORIES.flatMap((category) => category.items)
    const shuffled = [...items].sort(() => Math.random() - 0.5)
    setSelectedAwardItems(shuffled.slice(0, awardCount).map((item) => item.id))
  }

  async function saveAwardConfig() {
    if (!club?.id) return Alert.alert('확인', '클럽 정보를 불러온 뒤 다시 시도해 주세요.')
    setAwardSaving(true)
    try {
      const items = fillToCount(selectedAwardItems, awardCount)
      await saveClubAwardConfig(club.id, { count: awardCount, items })
      setSelectedAwardItems(items)
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
        const next = await upsertRoundSchedule(club.id, {
          id: draft.id,
          date: draft.date,
          courseId: draft.courseId,
          courseName: draft.courseName?.trim() || undefined,
          status: draft.status,
          attendanceMode: draft.attendanceMode,
          note: draft.note.trim(),
          moneyGroupIds,
          groups: draft.groups.map((group, index) => ({
            ...group,
            name: group.name || `${index + 1}조`,
            time: group.time.trim(),
          })),
        })
        setItems(next)
      }
      await saveClubSettlement(club.id, {
        participants: [],
        strokeFee: parseInt(strokeFee, 10) || 3000,
        birdieBonus,
        baepanConditions: { strokeOverpar: baepanOn, tie: baepanOn, birdie: false },
      })
      Alert.alert('저장 완료', '머니게임 기준을 저장했습니다.')
    } catch (error) {
      Alert.alert('저장 실패', error instanceof Error ? error.message : String(error))
    } finally {
      setMoneySaving(false)
    }
  }

  function openScoreUpload(groupId: string) {
    setScoreGroupId(groupId)
    setScorePhotoUris([])
    setScoreOcrResult(null)
    setScoreOcrError('')
  }

  function closeScoreUpload() {
    setScoreGroupId(null)
    setScorePhotoUris([])
    setScoreOcrResult(null)
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
      setScoreOcrError('')
    }
  }

  async function runScoreOcr() {
    if (scorePhotoUris.length === 0) return
    setScoreOcrBusy(true)
    setScoreOcrResult(null)
    setScoreOcrError('')
    try {
      const cards = await Promise.all(scorePhotoUris.map((uri) => recognizeScorecard(uri)))
      setScoreOcrResult(mergeScorecards(cards, selectedScoreGroup?.frontLayoutName, selectedScoreGroup?.backLayoutName))
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

  function scorePlayersForGroup(group: ScheduledRoundGroup, result: RecognizedScorecard) {
    const pars = scoreParsForGroup(group)
    const ocrNames = result.players.map((player) => player.name)
    const used = new Set<number>()
    return group.members.flatMap((member) => {
      const idx = findBestOcrMatch(member.name, ocrNames, used)
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
        players,
        photoData,
        clubId: club.id,
        settlement,
      })
      await completeRound(saved.id)
      closeScoreUpload()
      setEditorOpen(false)
      nav.navigate('RoundDetail', { id: saved.id })
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
      return
    }

    setDraft((current) => ({
      ...current,
      courseId: course.id,
      courseName: course.name,
      groups: current.groups.map((group) => ({
        ...group,
        frontLayoutId: undefined,
        frontLayoutName: undefined,
        backLayoutId: undefined,
        backLayoutName: undefined,
      })),
    }))
    setCoursePickerOpen(false)
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
      const next = await upsertRoundSchedule(club.id, {
        id: draft.id,
        date: draft.date,
        courseId: draft.courseId,
        courseName: draft.courseName?.trim() || undefined,
        status: draft.status,
        attendanceMode: draft.attendanceMode,
        note: draft.note.trim(),
        moneyGroupIds,
        groups: draft.groups.map((group, index) => ({
          ...group,
          name: `${index + 1}조`,
          time: group.time.trim(),
        })),
      })
      setItems(next)
      setEditorOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!club?.id || !draft.id) {
      setEditorOpen(false)
      return
    }

    setSaving(true)
    try {
      const next = await deleteRoundSchedule(club.id, draft.id)
      setItems(next)
      setEditorOpen(false)
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
        status: 'finished',
        attendanceMode: draft.attendanceMode,
        note: draft.note.trim(),
        moneyGroupIds,
        groups: draft.groups.map((group, index) => ({
          ...group,
          name: group.name || `${index + 1}조`,
          time: group.time.trim(),
        })),
      })
      setItems(next)
      const rounds = await getRounds(club.id)
      const finishedRound = rounds.find((round) =>
        round.date === draft.date && (!draft.courseName || round.courseName === draft.courseName)
      )
      if (finishedRound) {
        const config = await getClubAwardConfig(club.id)
        const itemIds = config
          ? fillToCount(config.items, config.count)
          : fillToCount(selectedAwardItems, awardCount)
        const handicaps = new Map(Object.entries(finishedRound.handicaps ?? {}))
        const awards = computeClubAwardResults(itemIds, finishedRound, handicaps, totalPar(finishedRound.pars))
        await saveClubAwardSnapshots(club.id, finishedRound.id, awards)
      }
      setEditorOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.heroCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroEyebrow}>{club?.name ?? '클럽'}</Text>
            <Text style={s.heroTitle}>라운드 일정 관리</Text>
            <Text style={s.heroDesc}>총무가 날짜, 골프장, 코스, 티오프 시간과 조편성을 등록하는 운영 화면입니다.</Text>
          </View>
          <TouchableOpacity style={s.heroButton} onPress={openCreate} activeOpacity={0.86}>
            <Icon name="plus" size={18} color={C.accentText} />
            <Text style={s.heroButtonText}>일정 추가</Text>
          </TouchableOpacity>
        </View>

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

      <Modal transparent animationType="slide" visible={editorOpen} onRequestClose={() => setEditorOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{draft.id ? '라운드 일정 수정' : '라운드 일정 등록'}</Text>
              <TouchableOpacity style={s.closeButton} onPress={() => setEditorOpen(false)} activeOpacity={0.8}>
                <Text style={s.closeButtonText}>닫기</Text>
              </TouchableOpacity>
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
                        <TouchableOpacity
                          style={[s.selector, s.groupSelector, !draft.courseId && s.selectorDisabled]}
                          onPress={() => draft.courseId && setLayoutPickerTarget({ groupId: group.id, side: 'front' })}
                          activeOpacity={0.84}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={s.groupSelectorLabel}>전반 코스</Text>
                            <Text style={[s.selectorText, !group.frontLayoutName && s.selectorPlaceholder]}>
                              {group.frontLayoutName ?? '선택'}
                            </Text>
                          </View>
                          <Icon name="chevronRight" size={18} color={C.muted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[s.selector, s.groupSelector, !draft.courseId && s.selectorDisabled]}
                          onPress={() => draft.courseId && setLayoutPickerTarget({ groupId: group.id, side: 'back' })}
                          activeOpacity={0.84}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={s.groupSelectorLabel}>후반 코스</Text>
                            <Text style={[s.selectorText, !group.backLayoutName && s.selectorPlaceholder]}>
                              {group.backLayoutName ?? '선택'}
                            </Text>
                          </View>
                          <Icon name="chevronRight" size={18} color={C.muted} />
                        </TouchableOpacity>
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

            <View style={s.footer}>
              {draft.id ? (
                <TouchableOpacity style={s.deleteButton} onPress={handleDelete} disabled={saving} activeOpacity={0.86}>
                  <Text style={s.deleteButtonText}>삭제</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <TouchableOpacity style={s.saveButton} onPress={handleSave} disabled={saving} activeOpacity={0.86}>
                <Text style={s.saveButtonText}>{saving ? '저장 중...' : '저장'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.finishButton} onPress={handleFinishRound} disabled={saving} activeOpacity={0.86}>
                <Text style={s.finishButtonText}>라운드 종료</Text>
              </TouchableOpacity>
            </View>
              </>
            ) : editorTab === 'score' ? (
              <ScrollView contentContainerStyle={s.scoreBody}>
                {draft.groups.some((group) => group.members.length > 0) ? (
                  draft.groups.map((group, index) => {
                    const disabled = group.members.length === 0
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
                          <Text style={s.scoreGroupTitle}>{group.name || `${index + 1}조`}</Text>
                          <Text style={s.scoreGroupMeta}>
                            {group.time?.trim() ? group.time : '티오프 미정'} · {group.frontLayoutName ?? '전반 미정'} / {group.backLayoutName ?? '후반 미정'}
                          </Text>
                          <Text style={s.scoreGroupMembers}>
                            {group.members.length > 0 ? group.members.map((member) => member.name).join(', ') : '배정된 회원 없음'}
                          </Text>
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
            ) : editorTab === 'award' ? (
              <ScrollView contentContainerStyle={s.awardBody}>
                <Text style={s.fieldLabel}>시상 인원</Text>
                <View style={s.awardChipRow}>
                  {[1, 2, 3, 4, 5].map((count) => (
                    <TouchableOpacity
                      key={count}
                      style={[s.awardChip, awardCount === count && s.awardChipActive]}
                      onPress={() => setAwardCount(count)}
                      activeOpacity={0.86}
                    >
                      <Text style={[s.awardChipText, awardCount === count && s.awardChipTextActive]}>{count}명</Text>
                    </TouchableOpacity>
                  ))}
                </View>

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
                        return (
                          <View key={item.id} style={[s.awardOption, selected && s.awardOptionActive]}>
                            <TouchableOpacity style={s.awardOptionMain} onPress={() => toggleAwardItem(item.id)} activeOpacity={0.86}>
                              <Text style={[s.awardChipText, selected && s.awardChipTextActive]}>{item.icon} {item.label}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={s.awardInfoButton}
                              onPress={() => Alert.alert(item.label, item.detail)}
                              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                            >
                              <Text style={[s.awardInfoText, selected && s.awardChipTextActive]}>ⓘ</Text>
                            </TouchableOpacity>
                          </View>
                        )
                      })}
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[s.saveButton, awardSaving && { opacity: 0.6 }]}
                  onPress={saveAwardConfig}
                  disabled={awardSaving}
                  activeOpacity={0.86}
                >
                  {awardSaving ? <ActivityIndicator color={C.accentText} /> : <Text style={s.saveButtonText}>시상룰 저장</Text>}
                </TouchableOpacity>
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

                <TouchableOpacity
                  style={[s.saveButton, moneySaving && { opacity: 0.6 }]}
                  onPress={saveMoneyGameConfig}
                  disabled={moneySaving}
                  activeOpacity={0.86}
                >
                  {moneySaving ? <ActivityIndicator color={C.accentText} /> : <Text style={s.saveButtonText}>머니게임 저장</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
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
                    {selectedScoreGroup.time?.trim() ? selectedScoreGroup.time : '티오프 미정'} · {selectedScoreGroup.frontLayoutName ?? '전반 미정'} / {selectedScoreGroup.backLayoutName ?? '후반 미정'}
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
                  <Text style={s.scoreOcrResultTitle}>인식 결과</Text>
                  {scoreOcrResult.players.map((player, index) => {
                    const total = player.diffs.reduce<number>((sum, diff, holeIndex) => sum + ((scoreOcrResult.pars[holeIndex] ?? 4) + (diff ?? 0)), 0)
                    return (
                      <View key={`${player.name}-${index}`} style={s.scoreOcrRow}>
                        <Text style={s.scoreOcrName}>{player.name || `플레이어 ${index + 1}`}</Text>
                        <Text style={s.scoreOcrTotal}>{total}타</Text>
                      </View>
                    )
                  })}
                  <TouchableOpacity
                    style={[s.scoreSaveButton, scoreSaveBusy && { opacity: 0.6 }]}
                    onPress={saveScoreResult}
                    disabled={scoreSaveBusy}
                    activeOpacity={0.86}
                  >
                    {scoreSaveBusy ? <ActivityIndicator color={C.accentText} /> : <Text style={s.scoreSaveButtonText}>스코어 저장</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={coursePickerOpen} onRequestClose={() => setCoursePickerOpen(false)}>
        <PickerShell title="골프장 선택" onClose={() => setCoursePickerOpen(false)}>
          <TouchableOpacity style={s.pickerRow} onPress={() => selectCourse(null)} activeOpacity={0.84}>
            <Text style={s.pickerRowText}>미정</Text>
          </TouchableOpacity>
          {courses.map((course) => (
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
  scoreGroupTitle: { fontSize: 16, fontWeight: '900', color: C.text },
  scoreGroupMeta: { fontSize: 12, fontWeight: '700', color: C.muted, marginTop: 4 },
  scoreGroupMembers: { fontSize: 13, fontWeight: '800', color: C.text, marginTop: 6, lineHeight: 18 },
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
  scoreOcrRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border },
  scoreOcrName: { fontSize: 14, fontWeight: '800', color: C.text },
  scoreOcrTotal: { fontSize: 14, fontWeight: '900', color: C.green },
  scoreSaveButton: {
    borderRadius: 14,
    backgroundColor: C.accent,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 12,
  },
  scoreSaveButtonText: { fontSize: 14, fontWeight: '900', color: C.accentText },
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
  },
  awardOptionActive: { backgroundColor: C.accent, borderColor: C.accent },
  awardOptionMain: { paddingLeft: 12, paddingRight: 4, paddingVertical: 9 },
  awardInfoButton: { paddingLeft: 2, paddingRight: 10, paddingVertical: 9 },
  awardInfoText: { fontSize: 13, fontWeight: '900', color: C.muted },
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
  footer: { flexDirection: 'row', gap: 12, marginTop: 12 },
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
  pickerRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  pickerRowText: { fontSize: 15, fontWeight: '800', color: C.text },
  pickerRowMeta: { fontSize: 12, color: C.muted, marginTop: 4 },
})
