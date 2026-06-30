import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Modal, Image, Share, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useState, useCallback, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getClubMembers, getRounds, playerTotal, totalPar, computeHandicaps, shortName, type SavedRound } from '../lib/store'
import { useClub } from '../lib/ClubContext'
import { useAsync } from '../lib/useAsync'
import { supabase } from '../lib/supabase'
import { C } from '../theme'
import { AppHeader } from '../components/AppHeader'
import { Icon } from '../components/Icon'
import { EmojiIcon } from '../components/EmojiIcon'
import type { RootStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type RankingType = 'recentMedal' | 'recentWins' | 'wins' | 'streak' | 'lowestHandicap' | 'birdie' | 'singleBirdie'

const CLUB_HERO_IMAGE = 'https://images.unsplash.com/photo-1592919505780-303950717480?auto=format&fit=crop&w=1200&q=80'
const APP_URL = 'https://golf-seven-psi.vercel.app'

const RECENT_NOTICES = [
  { title: '7월 월례회 공지', date: '06.28' },
  { title: '하계 라운드 일정 안내', date: '06.24' },
  { title: '회원 가입 안내문', date: '06.19' },
]

function diffText(d: number) { return d > 0 ? `+${d}` : `${d}` }

// 공동 수상자 포맷: 3명 이하 전원, 4명 이상 "A 외 N명"
function formatWinners(names: string[], value: string): string {
  if (names.length === 0) return '-'
  const label = names.length <= 3
    ? names.map(shortName).join(', ')
    : `${shortName(names[0])} 외 ${names.length - 1}명`
  return `${label} (${value})`
}

function getWinner(r: SavedRound, handicaps: Map<string, number>): string | null {
  const ranked = r.players
    .map((p) => {
      const total = playerTotal(p.strokes)
      return { name: p.name, net: total - (handicaps.get(p.name) ?? 0), total }
    })
    .sort((a, b) => a.net !== b.net ? a.net - b.net : a.total - b.total) // net 동점 → 총타수 낮은 순
  return ranked[0]?.name ?? null
}

export default function ClubScreen() {
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const [refreshKey, setRefreshKey] = useState(0)
  const { activeClub: club } = useClub()
  const { data, loading } = useAsync(
    () => (club ? getRounds(club.id) : Promise.resolve([])),
    [refreshKey, club?.id],
  )
  const { data: clubMembers } = useAsync(
    () => (club ? getClubMembers(club.id) : Promise.resolve([])),
    [refreshKey, club?.id],
  )
  const rounds = data ?? []
  const members = clubMembers ?? []
  const adminMembers = members.filter((member) => member.role === 'admin')
  const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])
  const [rankingType, setRankingType] = useState<RankingType | null>(null)
  const [clubInfoOpen, setClubInfoOpen] = useState(false)
  const [showHallCriteria, setShowHallCriteria] = useState(false)
  const [myName, setMyName] = useState<string | null>(null)

  const [handicapBasis, setHandicapBasis] = useState(5)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', data.user.id).single()
      setMyName(profile?.name ?? data.user?.user_metadata?.name ?? null)
    })
    AsyncStorage.getItem('@gogopar_handicap_basis').then(v => {
      if (v === '3' || v === '5' || v === '10') setHandicapBasis(Number(v))
    })
  }, [])

  async function handleInviteMember() {
    if (!club) return
    const link = `${APP_URL}/?join=${club.inviteCode}`
    const senderName = myName ?? '클럽 회원'
    const message = `[${senderName}]님이 [${club.name}] 골프 클럽에 초대합니다!\n\n${link}`
    try {
      await Share.share({ title: `${club.name} 골프 클럽 초대`, message })
    } catch {
      Alert.alert('초대코드', club.inviteCode)
    }
  }

  const userInitial = (myName ?? '?').slice(0, 1)
  const handicaps = computeHandicaps(rounds, handicapBasis)
  const sortedRounds = [...rounds].sort((a, b) => a.date.localeCompare(b.date))

  // 선수별 평균 타수 (기준 경기 수)
  const avgScoreByPlayer = new Map<string, number>()
  const scoresByPlayer = new Map<string, Array<{ date: string; score: number }>>()
  for (const r of rounds) {
    for (const p of r.players) {
      const arr = scoresByPlayer.get(p.name) ?? []
      arr.push({ date: r.date, score: playerTotal(p.strokes) })
      scoresByPlayer.set(p.name, arr)
    }
  }
  for (const [name, entries] of scoresByPlayer) {
    const lastN = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-handicapBasis)
    avgScoreByPlayer.set(name, Math.round(lastN.reduce((s, e) => s + e.score, 0) / lastN.length))
  }

  // 핸디캡 랭킹 (낮을수록 잘하는 것)
  const handicapRanking = [...handicaps.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name, h]) => ({ name, handicap: h, avgScore: avgScoreByPlayer.get(name) ?? 0 }))

  // 우승 집계
  const winCount = new Map<string, number>()
  for (const r of sortedRounds) {
    const w = getWinner(r, handicaps)
    if (w) winCount.set(w, (winCount.get(w) ?? 0) + 1)
  }
  const winRanking = [...winCount.entries()]
    .map(([name, wins]) => ({ name, wins }))
    .sort((a, b) => b.wins - a.wins)

  // 연속 우승
  let maxStreak = 0, maxStreakPlayer = '', curStreak = 0, curPlayer = ''
  for (const r of sortedRounds) {
    const w = getWinner(r, handicaps)
    if (w && w === curPlayer) { curStreak++ }
    else {
      if (curStreak > maxStreak) { maxStreak = curStreak; maxStreakPlayer = curPlayer }
      curPlayer = w ?? ''; curStreak = w ? 1 : 0
    }
  }
  if (curStreak > maxStreak) { maxStreak = curStreak; maxStreakPlayer = curPlayer }
  const streakRanking = [...winCount.keys()]
    .map((name) => ({ name, streak: 0 }))

  // 버디 집계
  const birdieCount = new Map<string, number>()
  for (const r of rounds)
    for (const p of r.players) {
      let b = 0
      p.strokes.forEach((s, i) => { if (s - r.pars[i] <= -1) b++ })
      birdieCount.set(p.name, (birdieCount.get(p.name) ?? 0) + b)
    }
  const birdieRanking = [...birdieCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // 한경기 최다 버디
  const singleBirdieMap = new Map<string, { count: number; date: string; courseName: string }>()
  for (const r of rounds)
    for (const p of r.players) {
      let b = 0
      p.strokes.forEach((s, i) => { if (s - r.pars[i] <= -1) b++ })
      const prev = singleBirdieMap.get(p.name)
      if (!prev || b > prev.count)
        singleBirdieMap.set(p.name, { count: b, date: r.date, courseName: r.courseName })
    }
  const singleBirdieRanking = [...singleBirdieMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)

  // 최근 5경기 메달리스트 / 우승자 (공동 포함)
  const recentMedalRows = rounds.slice(0, 5).map((r) => {
    const best = Math.min(...r.players.map((p) => playerTotal(p.strokes)))
    const medals = r.players.filter((p) => playerTotal(p.strokes) === best).map((p) => p.name)
    const label = medals.length <= 3 ? medals.map(shortName).join(', ') : `${shortName(medals[0])} 외 ${medals.length - 1}명`
    return { name: label || '-', value: `${best}타`, sub: `${r.date.slice(5)} ${r.courseName}` }
  })
  const recentWinsRows = rounds.slice(0, 5).map((r) => {
    const pts = r.players.map((p) => { const total = playerTotal(p.strokes); return { name: p.name, net: total - (handicaps.get(p.name) ?? 0), total } })
    const minNet = Math.min(...pts.map((p) => p.net))
    const winners = pts.filter((p) => p.net === minNet)
    const topGross = Math.min(...winners.map((w) => w.total))
    const label = winners.length <= 3 ? winners.map((w) => shortName(w.name)).join(', ') : `${shortName(winners[0].name)} 외 ${winners.length - 1}명`
    return { name: label || '-', value: `${topGross}타`, sub: `${r.date.slice(5)} ${r.courseName}` }
  })

  const rankingConfig: Record<RankingType, { title: string; col: string; rows: { name: string; value: string; sub?: string }[] }> = {
    recentMedal: { title: '최근 5경기 메달리스트', col: '최저타', rows: recentMedalRows },
    recentWins: { title: '최근 5경기 우승자', col: '핸디대비', rows: recentWinsRows },
    wins: { title: '최다 우승', col: '우승 횟수', rows: winRanking.map((r) => ({ name: shortName(r.name), value: `${r.wins}회` })) },
    streak: { title: '최다 연속 우승', col: '연속', rows: maxStreak > 0 ? [{ name: shortName(maxStreakPlayer), value: `${maxStreak}연승` }] : [] },
    lowestHandicap: { title: `핸디캡 랭킹 (최근 ${handicapBasis}경기)`, col: '평균타 (핸디)', rows: handicapRanking.map((r) => ({ name: shortName(r.name), value: r.avgScore ? `${r.avgScore} (${diffText(r.handicap)})` : diffText(r.handicap) })) },
    birdie: { title: '버디왕 (전체)', col: '버디 수', rows: birdieRanking.map((r) => ({ name: shortName(r.name), value: `${r.count}개` })) },
    singleBirdie: { title: '버디왕 (1경기)', col: '버디 수', rows: singleBirdieRanking.map((r) => ({ name: shortName(r.name), value: `${r.count}개`, sub: `${r.date.slice(5)} ${r.courseName}` })) },
  }

  // 최근 라운드
  const recent3 = rounds.slice(0, 3)

  const topWinner = winRanking[0]
  const latestRound = rounds[0]
  const lowestHandicapEntry = [...handicaps.entries()].sort((a, b) => a[1] - b[1])[0]
  const topBirdie = birdieRanking[0]
  const topSingleBirdie = singleBirdieRanking[0]

  // 공동 수상 포함 텍스트 계산
  const recentMedalText = (() => {
    if (!latestRound) return '-'
    const best = Math.min(...latestRound.players.map((p) => playerTotal(p.strokes)))
    const names = latestRound.players.filter((p) => playerTotal(p.strokes) === best).map((p) => p.name)
    return formatWinners(names, `${best}타`)
  })()

  const recentWinnerText = (() => {
    if (!latestRound) return '-'
    const pts = latestRound.players.map((p) => { const total = playerTotal(p.strokes); return { name: p.name, net: total - (handicaps.get(p.name) ?? 0), total } })
    const minNet = Math.min(...pts.map((p) => p.net))
    const winners = pts.filter((p) => p.net === minNet)
    const topGross = Math.min(...winners.map((w) => w.total))
    return formatWinners(winners.map((w) => w.name), `${topGross}타`)
  })()

  const mostWinsText = (() => {
    if (!topWinner) return '-'
    const tied = winRanking.filter((r) => r.wins === topWinner.wins)
    return formatWinners(tied.map((r) => r.name), `${topWinner.wins}회`)
  })()

  const lowestHandiText = (() => {
    if (!lowestHandicapEntry) return '-'
    const minH = lowestHandicapEntry[1]
    const tied = [...handicaps.entries()].filter(([, h]) => h === minH).map(([n]) => n)
    return formatWinners(tied, diffText(minH))
  })()

  const topBirdieText = (() => {
    if (!topBirdie || topBirdie.count === 0) return '-'
    const tied = birdieRanking.filter((r) => r.count === topBirdie.count)
    return formatWinners(tied.map((r) => r.name), `${topBirdie.count}개`)
  })()

  const topSingleBirdieText = (() => {
    if (!topSingleBirdie) return '-'
    const tied = singleBirdieRanking.filter((r) => r.count === topSingleBirdie.count)
    return formatWinners(tied.map((r) => r.name), `${topSingleBirdie.count}개`)
  })()

  const highlights = [
    { icon: '🏆', label: '최근 메달리스트', value: recentMedalText,    type: 'recentMedal'     as RankingType },
    { icon: '🥇', label: '최근 우승',       value: recentWinnerText,   type: 'recentWins'      as RankingType },
    { icon: '🏅', label: '최다 우승',       value: mostWinsText,       type: 'wins'            as RankingType },
    { icon: '🔥', label: '최다 연속 우승',  value: maxStreak > 0 ? `${shortName(maxStreakPlayer)} (${maxStreak}연승)` : '-', type: 'streak' as RankingType },
    { icon: '📉', label: '최저 핸디',       value: lowestHandiText,    type: 'lowestHandicap'  as RankingType },
    { icon: '🐦', label: '버디왕 (전체)',   value: topBirdieText,      type: 'birdie'          as RankingType },
    { icon: '⛳', label: '버디왕 (1경기)',  value: topSingleBirdieText, type: 'singleBirdie'   as RankingType },
  ]

  const MEDAL_BG = ['#fffbe8', '#f4f6f8', '#fdf5f0']
  const MEDAL_COLOR = [C.gold, C.silver, C.bronze]
  const isManagerView = club?.role === 'admin'
  const managementMenus = club ? [
    {
      key: 'members',
      title: '회원 관리',
      subtitle: '회원 정보와 권한을 관리합니다',
      icon: 'users' as const,
      onPress: () => nav.navigate('Members', { clubId: club.id }),
    },
    {
      key: 'fee',
      title: '회비 관리',
      subtitle: '회비 정책과 납부 현황을 확인합니다',
      icon: 'money' as const,
      featured: true,
      onPress: () => nav.navigate('FeePrototype'),
    },
    {
      key: 'roundSchedule',
      title: '라운드 일정',
      subtitle: '날짜, 시간, 골프장 정보를 등록하고 예정 라운드를 관리합니다',
      icon: 'flag' as const,
      onPress: () => nav.navigate('RoundSchedulePrototype'),
    },
    {
      key: 'notice',
      title: '공지 관리',
      subtitle: '공지 등록과 게시 상태를 관리합니다',
      icon: 'mail' as const,
      onPress: () => nav.navigate('NoticePrototype'),
    },
    {
      key: 'settings',
      title: '운영 설정',
      subtitle: '클럽 정보와 운영 환경을 설정합니다',
      icon: 'settings' as const,
      onPress: () => nav.navigate('Settings'),
    },
  ] : []

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {rankingType && (
        <RankingModal config={rankingConfig[rankingType]} onClose={() => setRankingType(null)} />
      )}
      {clubInfoOpen && club && (
        <ClubInfoModal
          clubName={club.name}
          subtitle={club.subtitle?.trim() ? club.subtitle : '골프의 모든 경험을 하나로.'}
          role={club.role === 'admin' ? '관리자' : '일반회원'}
          memberCount={members.length}
          admins={adminMembers}
          onClose={() => setClubInfoOpen(false)}
          onMembers={() => {
            setClubInfoOpen(false)
            nav.navigate('Members', { clubId: club.id })
          }}
          onInvite={handleInviteMember}
        />
      )}

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.green} />}
      >
        {/* 헤더 (공용) — 클럽명 오른쪽 멤버 버튼 */}
        <AppHeader myName={myName} />

        <View style={s.content}>
          {club && (
            <>
              <Text style={s.pageSectionTitle}>클럽 관리</Text>

              <View style={s.clubHeroCard}>
                <Image source={{ uri: CLUB_HERO_IMAGE }} style={s.clubHeroImage} resizeMode="cover" />
                <View style={s.clubHeroBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.clubHeroName} numberOfLines={1}>{club.name}</Text>
                    <Text style={s.clubHeroMeta} numberOfLines={2}>
                      {club.subtitle?.trim() ? club.subtitle : '운영 중인 골프 클럽'}
                    </Text>
                  </View>
                  <TouchableOpacity style={s.clubInfoBtn} onPress={() => setClubInfoOpen(true)} activeOpacity={0.84}>
                    <Text style={s.clubInfoBtnText}>클럽 정보</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.card}>
                <View style={s.cardTitleRow}>
                  <Text style={[s.cardTitle, { marginBottom: 0 }]}>공지사항</Text>
                  <TouchableOpacity onPress={() => nav.navigate('NoticePrototype')} activeOpacity={0.82}>
                    <Text style={s.more}>전체보기 ›</Text>
                  </TouchableOpacity>
                </View>
                {RECENT_NOTICES.map((notice) => (
                  <TouchableOpacity key={`${notice.title}-${notice.date}`} style={s.noticeRow} onPress={() => nav.navigate('NoticePrototype')} activeOpacity={0.82}>
                    <View style={s.noticeIcon}>
                      <Icon name="mail" size={15} color={C.green} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.noticeTitle}>{notice.title}</Text>
                      <Text style={s.noticeMeta}>{notice.date}</Text>
                    </View>
                    <Icon name="chevronRight" size={16} color={C.muted} />
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.card}>
                <View style={s.cardTitleRow}>
                  <Text style={[s.cardTitle, { marginBottom: 0 }]}>명예의 전당 선정 기준</Text>
                  <TouchableOpacity style={s.recordToggleBtn} onPress={() => setShowHallCriteria((value) => !value)} activeOpacity={0.82}>
                    <Text style={s.recordToggleText}>{showHallCriteria ? '접기' : '펼치기'}</Text>
                  </TouchableOpacity>
                </View>
                {showHallCriteria ? (
                  <>
                    <View style={s.ruleRow}>
                      <Text style={s.ruleLabel}>우승 기록</Text>
                      <Text style={s.ruleValue}>최다 우승 · 최다 연속 우승</Text>
                    </View>
                    <View style={s.ruleRow}>
                      <Text style={s.ruleLabel}>스코어 기록</Text>
                      <Text style={s.ruleValue}>최저타 · 최고타 · 버디왕 · 파왕</Text>
                    </View>
                    <View style={s.ruleRow}>
                      <Text style={s.ruleLabel}>성장 기록</Text>
                      <Text style={s.ruleValue}>최저 핸디 · 전후반/평균타/핸디 개선</Text>
                    </View>
                    <View style={s.ruleRow}>
                      <Text style={s.ruleLabel}>참가 기록</Text>
                      <Text style={s.ruleValue}>최다 라운드 참가</Text>
                    </View>
                    <View style={s.ruleRow}>
                      <Text style={s.ruleLabel}>핸디 기준</Text>
                      <Text style={s.ruleValue}>최근 {handicapBasis}경기</Text>
                    </View>
                  </>
                ) : (
                  <Text style={s.criteriaCollapsedText}>우승, 스코어, 성장, 참가 기록을 기준으로 선정합니다.</Text>
                )}
              </View>

              {isManagerView && (
                <>
                  <Text style={s.pageSectionTitle}>관리 메뉴</Text>
                  <View style={s.managementGrid}>
                    {managementMenus.map((menu) => (
                      <TouchableOpacity
                        key={menu.key}
                        style={[s.managementCard, menu.featured && s.managementCardFeatured]}
                        onPress={menu.onPress}
                        activeOpacity={0.86}
                      >
                        <View style={[s.managementIcon, menu.featured && s.managementIconFeatured]}>
                          <Icon
                            name={menu.icon}
                            size={22}
                            color={menu.featured ? C.accentText : C.greenDark}
                            strokeWidth={2}
                          />
                        </View>
                        <Text style={s.managementTitle}>{menu.title}</Text>
                        <Text style={s.managementSubtitle}>{menu.subtitle}</Text>
                        <View style={s.managementArrowWrap}>
                          <Icon name="chevronRight" size={16} color={C.muted} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {/* 클럽 없음 */}
          {!club && !loading && (
            <View style={s.emptyCard}>
              <Icon name="flag" size={38} color={C.green} strokeWidth={1.6} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6, marginTop: 12 }}>소속 클럽이 없어요</Text>
              <Text style={{ fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 }}>
                프로필에서 클럽을 만들거나{'\n'}초대 링크로 참여해보세요
              </Text>
              <TouchableOpacity style={s.goProfileBtn} onPress={() => nav.navigate('Profile')}>
                <Text style={s.goProfileBtnText}>프로필 바로가기 →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 기록 없음 */}
          {club && !loading && rounds.length === 0 && (
            <View style={s.emptyCard}>
              <Icon name="flag" size={34} color={C.green} strokeWidth={1.6} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 10 }}>아직 클럽 기록이 없어요</Text>
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  )
}

function ClubInfoModal({
  clubName,
  subtitle,
  role,
  memberCount,
  admins,
  onClose,
  onMembers,
  onInvite,
}: {
  clubName: string
  subtitle: string
  role: string
  memberCount: number
  admins: Array<{ userId: string; name: string; role: string }>
  onClose: () => void
  onMembers: () => void
  onInvite: () => void
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.modalCard} activeOpacity={1} onPress={() => {}}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.clubInfoTitle}>{clubName}</Text>
              <Text style={s.clubInfoSubtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>

          <View style={s.clubInfoStats}>
            <Text style={s.clubInfoStat}>회원 {memberCount}명</Text>
            <Text style={s.clubInfoStat}>운영진 {admins.length}명</Text>
            <Text style={s.clubInfoStat}>내 역할 {role}</Text>
          </View>

          <View style={s.infoSection}>
            <Text style={s.infoSectionTitle}>멤버</Text>
            <View style={s.infoDivider} />
            <Text style={s.infoLabel}>운영진</Text>
            {admins.length > 0 ? admins.map((admin) => (
              <View key={admin.userId} style={s.adminRow}>
                <Text style={s.adminName}>{admin.name}</Text>
                <Text style={s.adminRole}>관리자</Text>
              </View>
            )) : (
              <Text style={s.infoMuted}>등록된 운영진이 없습니다.</Text>
            )}
            <View style={s.infoActionRow}>
              <TouchableOpacity style={s.infoActionBtn} onPress={onMembers} activeOpacity={0.82}>
                <Text style={s.infoActionText}>전체 멤버 보기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.infoActionBtn} onPress={onInvite} activeOpacity={0.82}>
                <Text style={s.infoActionText}>멤버 초대</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.infoSection}>
            <Text style={s.infoSectionTitle}>회칙</Text>
            <View style={s.infoDivider} />
            <Text style={s.ruleDesc}>회원 자격, 회비, 운영진, 탈퇴 기준 등 동호회 운영 기준을 확인합니다.</Text>
            <Text style={s.infoMuted}>최근 수정일: 2026.06.30</Text>
            <TouchableOpacity style={s.infoActionBtn} activeOpacity={0.82}>
              <Text style={s.infoActionText}>회칙 보기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ─── 랭킹 모달 ────────────────────────────────────────────────────────────────

function RankingModal({ config, onClose }: {
  config: { title: string; col: string; rows: { name: string; value: string; sub?: string }[] }
  onClose: () => void
}) {
  const MEDAL_BG = ['#fffbe8', '#f4f6f8', '#fdf5f0']
  const MEDAL_COLOR = [C.gold, C.silver, C.bronze]
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
              <View key={i} style={[s.tableRow, i < 3 && { backgroundColor: MEDAL_BG[i], borderRadius: 8, marginBottom: 2 }]}>
                <View style={{ flex: 0.6, alignItems: 'center' }}>
                  {i < 3 ? <EmojiIcon char={['🥇','🥈','🥉'][i]} size={17} /> : <Text style={[s.td, { fontSize: 13 }]}>{i + 1}</Text>}
                </View>
                <View style={{ flex: 2.5 }}>
                  <Text style={[s.td, { fontWeight: i < 3 ? '700' : '500' }]}>{row.name}</Text>
                  {row.sub && <Text style={{ fontSize: 11, color: C.muted }}>{row.sub}</Text>}
                </View>
                <Text style={[s.td, { flex: 1.5, textAlign: 'right', fontWeight: '700', color: i < 3 ? MEDAL_COLOR[i] : C.text }]}>{row.value}</Text>
              </View>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const s = StyleSheet.create({
  header: {
    backgroundColor: C.greenDark, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 3 },
  profileBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  profileInitial: { color: '#fff', fontSize: 16, fontWeight: '900' },

  clubSelector: { backgroundColor: C.greenDark, paddingBottom: 14 },
  clubPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  clubPillActive: { backgroundColor: '#fff' },
  clubPillText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  clubPillTextActive: { color: C.greenDark },

  content: { padding: 16 },
  pageSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
    marginBottom: 12,
  },
  clubHeroCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#1a6b44',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  clubHeroImage: {
    width: '100%',
    height: 150,
  },
  clubHeroBody: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clubHeroName: { fontSize: 24, fontWeight: '900', color: C.text },
  clubHeroMeta: { fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 19 },
  clubInfoBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#f7faf7',
  },
  clubInfoBtnText: { fontSize: 13, fontWeight: '800', color: C.text },
  managementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  managementCard: {
    width: '47.5%',
    minHeight: 172,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#1a6b44',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  managementCardFeatured: {
    borderColor: '#94bb36',
    backgroundColor: '#f8ffd9',
  },
  managementIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  managementIconFeatured: {
    backgroundColor: C.accent,
  },
  managementTitle: { fontSize: 18, fontWeight: '900', color: C.text },
  managementSubtitle: { fontSize: 13, color: C.muted, lineHeight: 19, marginTop: 10 },
  managementArrowWrap: {
    marginTop: 'auto',
    alignSelf: 'flex-end',
    paddingTop: 16,
  },

  emptyCard: { backgroundColor: C.card, borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 14 },
  goProfileBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: C.green, borderRadius: 20 },
  goProfileBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  card: {
    backgroundColor: C.card, borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#1a6b44', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14 },
  more: { fontSize: 13, color: C.green, fontWeight: '600' },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  noticeIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  noticeMeta: { fontSize: 11, color: C.muted, marginTop: 2 },
  recordToggleBtn: { borderRadius: 999, backgroundColor: C.greenLight, paddingHorizontal: 10, paddingVertical: 5 },
  recordToggleText: { fontSize: 12, fontWeight: '800', color: C.green },
  criteriaCollapsedText: { fontSize: 13, fontWeight: '700', color: C.muted, lineHeight: 20 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.border },
  ruleLabel: { fontSize: 13, fontWeight: '700', color: C.muted },
  ruleValue: { flex: 1, fontSize: 13, fontWeight: '800', color: C.text, textAlign: 'right' },

  // 핸디캡 랭킹
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, marginBottom: 2 },
  rankNum: { width: 32, fontSize: 13, textAlign: 'center', color: C.muted },
  rankName: { flex: 1, fontSize: 14, fontWeight: '500', color: C.text },
  rankValue: { fontSize: 16, fontWeight: '800' },

  // 명예의 전당
  hallRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  hallIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  hallLabel: { flex: 1, fontSize: 13, color: C.muted },
  hallValue: { fontSize: 13, fontWeight: '600', color: C.text, textAlign: 'right', flexShrink: 1 },

  // 최근 라운드
  roundRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  roundLeft: { flex: 1 },
  roundCourse: { fontSize: 14, fontWeight: '700', color: C.text },
  roundMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  roundStat: { fontSize: 12, color: C.muted },

  memberBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  memberBtnText: {
    fontSize: 10, fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  clubDropdownBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6,
    maxWidth: 120,
  },
  clubDropdownText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dropdownOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingRight: 16,
  },
  dropdownCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    minWidth: 200, maxWidth: 260,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
  },
  dropdownTitle: {
    fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  dropdownRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  dropdownRowDivider: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownClubName: { fontSize: 14, fontWeight: '700', color: C.text },
  dropdownClubSub: { fontSize: 11, color: C.muted, marginTop: 1 },

  muted: { fontSize: 13, color: C.muted },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, width: '90%', maxHeight: '78%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  clubInfoTitle: { fontSize: 22, fontWeight: '900', color: C.text },
  clubInfoSubtitle: { fontSize: 13, color: C.muted, marginTop: 5, lineHeight: 18 },
  clubInfoStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  clubInfoStat: { backgroundColor: C.greenLight, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '800', color: C.green },
  infoSection: { paddingTop: 12, marginTop: 4 },
  infoSectionTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  infoDivider: { height: 1, backgroundColor: C.border, marginTop: 10, marginBottom: 10 },
  infoLabel: { fontSize: 12, fontWeight: '800', color: C.muted, marginBottom: 6 },
  adminRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  adminName: { fontSize: 14, fontWeight: '800', color: C.text },
  adminRole: { fontSize: 12, fontWeight: '800', color: C.green },
  infoMuted: { fontSize: 12, color: C.muted, lineHeight: 18 },
  infoActionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  infoActionBtn: { flex: 1, borderRadius: 14, backgroundColor: C.greenLight, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
  infoActionText: { fontSize: 13, fontWeight: '800', color: C.green },
  ruleDesc: { fontSize: 13, color: C.text, lineHeight: 20, marginBottom: 8 },
  closeBtn: { backgroundColor: C.green, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14 },
  closeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: C.border, paddingBottom: 7, marginBottom: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { fontSize: 11, color: C.muted, fontWeight: '700' },
  td: { fontSize: 13, color: C.text },
})
