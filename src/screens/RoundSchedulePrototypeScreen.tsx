import { useEffect, useMemo, useState } from 'react'
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import DateField, { todayLocal } from '../components/DateField'
import { Icon } from '../components/Icon'
import { useClub } from '../lib/ClubContext'
import {
  deleteRoundSchedule,
  getRoundSchedules,
  upsertRoundSchedule,
  type RoundAttendanceMode,
  type RoundScheduleStatus,
  type ScheduledRound,
  type ScheduledRoundGroup,
  type ScheduledRoundGroupMember,
} from '../lib/roundSchedule'
import { getClubMembers, getCourseLayouts, getGolfCourses, type CourseLayout, type GolfCourse } from '../lib/store'
import { C } from '../theme'

type ClubMember = { userId: string; name: string; role: string }

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

const ATTENDANCE_OPTIONS: Array<{ value: RoundAttendanceMode; label: string }> = [
  { value: 'member', label: '회원 직접 선택' },
  { value: 'manager', label: '총무만 입력' },
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

export default function RoundSchedulePrototypeScreen() {
  const { activeClub: club } = useClub()
  const [items, setItems] = useState<ScheduledRound[]>([])
  const [courses, setCourses] = useState<GolfCourse[]>([])
  const [layouts, setLayouts] = useState<CourseLayout[]>([])
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft>(createEmptyDraft())
  const [coursePickerOpen, setCoursePickerOpen] = useState(false)
  const [layoutPickerTarget, setLayoutPickerTarget] = useState<{ groupId: string; side: 'front' | 'back' } | null>(null)

  useEffect(() => {
    getGolfCourses().then(setCourses).catch(() => setCourses([]))
  }, [])

  useEffect(() => {
    if (!club?.id) return
    getRoundSchedules(club.id).then(setItems)
    getClubMembers(club.id).then(setClubMembers).catch(() => setClubMembers([]))
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

  function openCreate() {
    setDraft(createEmptyDraft())
    setLayouts([])
    setEditorOpen(true)
  }

  function openEdit(item: ScheduledRound) {
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
    setEditorOpen(true)
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
              <Icon name="calendar" size={24} color={C.green} />
              <Text style={s.emptyTitle}>등록된 라운드 일정이 없습니다</Text>
              <Text style={s.emptyDesc}>첫 일정을 등록하면 홈 화면의 예정된 라운드 카드와 연결됩니다.</Text>
            </TouchableOpacity>
          ) : (
            sortedItems.map((item) => (
              <TouchableOpacity key={item.id} style={s.scheduleCard} onPress={() => openEdit(item)} activeOpacity={0.86}>
                <View style={s.scheduleIcon}>
                  <Icon name="calendar" size={18} color={C.greenDark} />
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
                <Text style={s.fieldLabel}>진행 상태</Text>
                <View style={s.segmentRow}>
                  {STATUS_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[s.segmentButton, draft.status === option.value && s.segmentButtonActive]}
                      onPress={() => setDraft((current) => ({ ...current, status: option.value }))}
                      activeOpacity={0.86}
                    >
                      <Text style={[s.segmentText, draft.status === option.value && s.segmentTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>참석 입력 방식</Text>
                <View style={s.attendanceColumn}>
                  {ATTENDANCE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[s.radioCard, draft.attendanceMode === option.value && s.radioCardActive]}
                      onPress={() => setDraft((current) => ({ ...current, attendanceMode: option.value }))}
                      activeOpacity={0.86}
                    >
                      <Text style={[s.radioTitle, draft.attendanceMode === option.value && s.radioTitleActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                          {clubMembers.map((member) => {
                            const selected = isMemberSelected(group.id, member.userId)
                            const assignedGroupId = memberAssignedGroup(member.userId)
                            const disabled = !!assignedGroupId && assignedGroupId !== group.id

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
            </View>
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
    maxHeight: '92%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: C.text },
  closeButton: {
    borderRadius: 999,
    backgroundColor: '#eef2ee',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeButtonText: { fontSize: 14, fontWeight: '800', color: C.text },
  formBody: { gap: 18, paddingBottom: 12 },
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
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segmentButton: {
    minWidth: 72,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#fff',
  },
  segmentButtonActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  segmentText: { fontSize: 13, fontWeight: '800', color: C.muted, textAlign: 'center' },
  segmentTextActive: { color: C.accentText },
  attendanceColumn: { gap: 8 },
  radioCard: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  radioCardActive: {
    borderColor: C.green,
    backgroundColor: '#eef9f1',
  },
  radioTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  radioTitleActive: { color: C.greenDark },
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
