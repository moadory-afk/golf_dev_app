import { useLayoutEffect } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Icon } from '../components/Icon'
import { useClub } from '../lib/ClubContext'
import { C } from '../theme'

const notices = [
  { title: '7월 월례회 공지', state: '게시 중', date: '06.28' },
  { title: '하계 라운드 일정 안내', state: '초안', date: '06.24' },
  { title: '회원 가입 안내문', state: '게시 중', date: '06.19' },
]

export default function NoticePrototypeScreen() {
  const nav = useNavigation()
  const { activeClub } = useClub()

  useLayoutEffect(() => {
    nav.setOptions({ title: `${activeClub?.name ?? '클럽'} 공지사항` })
  }, [nav, activeClub?.name])

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Text style={s.heroEyebrow}>{activeClub?.name ?? '클럽'}</Text>
        <Text style={s.heroTitle}>공지사항</Text>
        <Text style={s.heroSub}>공지 등록과 게시 상태를 관리하는 화면입니다.</Text>
      </View>

      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>공지 목록</Text>
          <Text style={s.sectionAction}>준비 중</Text>
        </View>
        {notices.map((notice) => (
          <View key={`${notice.title}-${notice.date}`} style={s.noticeRow}>
            <View style={s.noticeIcon}>
              <Icon name="mail" size={16} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.noticeTitle}>{notice.title}</Text>
              <Text style={s.noticeMeta}>{notice.date}</Text>
            </View>
            <View style={[s.stateBadge, notice.state === '게시 중' ? s.activeBadge : s.draftBadge]}>
              <Text style={[s.stateText, notice.state === '게시 중' ? { color: C.green } : { color: C.warn }]}>{notice.state}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>다음 구현 범위</Text>
        <Text style={s.body}>공지 등록, 수정, 게시 전환, 중요 공지 표시 기능을 순서대로 붙일 예정입니다.</Text>
        <TouchableOpacity style={s.primaryBtn} activeOpacity={0.82}>
          <Text style={s.primaryBtnText}>공지 작성 화면 준비</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  hero: {
    backgroundColor: C.greenDark,
    borderRadius: 20,
    padding: 18,
  },
  heroEyebrow: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 8, lineHeight: 18 },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  sectionAction: { fontSize: 12, fontWeight: '800', color: C.green },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
  noticeIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  noticeTitle: { fontSize: 13, fontWeight: '800', color: C.text },
  noticeMeta: { fontSize: 11, color: C.muted, marginTop: 3 },
  stateBadge: { borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 },
  activeBadge: { backgroundColor: `${C.green}18` },
  draftBadge: { backgroundColor: `${C.warn}18` },
  stateText: { fontSize: 11, fontWeight: '900' },
  body: { fontSize: 13, color: C.muted, lineHeight: 20, marginTop: 8 },
  primaryBtn: { marginTop: 14, borderRadius: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: C.accent },
  primaryBtnText: { color: C.accentText, fontSize: 13, fontWeight: '900' },
})
