import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useState, useRef } from 'react'
import { C } from '../theme'
import AppTabBar from '../components/AppTabBar'
import { shortName } from '../lib/store'
import type { RootStackProps } from '../navigation/types'

const DEFAULT_PARS = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4]
const HOLES = Array.from({ length: 18 }, (_, i) => i + 1)
const CELL_W = 34

export default function ScoreReviewScreen() {
  const route = useRoute<RootStackProps<'ScoreReview'>['route']>()
  const nav = useNavigation<RootStackProps<'ScoreReview'>['navigation']>()
  const { editId, courseName, date, pars: initPars, players: initPlayers, photoUris, settlement, holeLabels } = route.params ?? {}
  const holeLabel = (i: number) => holeLabels?.[i] ?? `${i + 1}홀`

  const pars = initPars ?? DEFAULT_PARS

  const [hole, setHole] = useState(0)
  const [players, setPlayers] = useState(() =>
    initPlayers
      ? initPlayers.map((p) => ({
          name: p.name,
          strokes: p.diffs.map((d, i) => Math.max(1, pars[i] + (d ?? 0))),
        }))
      : [1, 2, 3, 4].map((n) => ({
          name: `플레이어 ${n}`,
          strokes: pars.map((par) => par),
        }))
  )

  const tableRef = useRef<ScrollView>(null)

  function goHole(next: number) {
    setHole(next)
    // 현재 홀 컬럼이 보이도록 스크롤 (2칸 여유)
    const offset = Math.max(0, CELL_W * (next - 2))
    tableRef.current?.scrollTo({ x: offset, animated: true })
  }

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

  function goResult() {
    nav.navigate('Result', {
      editId,
      courseName,
      date,
      pars,
      players: players.map((p) => ({ name: p.name || '플레이어', strokes: p.strokes })),
      photoUris,
      settlement,
    })
  }

  function scoreColor(strokes: number, par: number) {
    const d = strokes - par
    if (d <= -2) return C.eagle ?? '#7b61ff'
    if (d === -1) return C.info
    if (d === 0)  return C.muted
    if (d <= 2)   return C.warn
    return C.danger
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* ── 날짜 / 골프장 정보 ── */}
      {(date || courseName) && (
        <View style={s.infoBar}>
          {date && <Text style={s.infoDate}>{date}</Text>}
          {courseName && <Text style={s.infoCourse}>{courseName}</Text>}
        </View>
      )}

      {/* ── 상단: 홀별 스코어 테이블 ── */}
      <View style={s.tableCard}>
        <View style={s.tableInner}>

          {/* 고정 이름 컬럼 */}
          <View style={s.fixedCol}>
            <View style={s.row}><Text style={s.labelText}>홀</Text></View>
            <View style={s.row}><Text style={[s.labelText, { color: C.muted }]}>파</Text></View>
            {players.map((p, pi) => (
              <View key={pi} style={s.row}>
                <Text style={s.labelText}>{shortName(p.name)}</Text>
              </View>
            ))}
          </View>

          {/* 고정 합계 컬럼 */}
          <View style={s.totalFixedCol}>
            <View style={s.row}><Text style={s.labelText}>합계</Text></View>
            <View style={s.row}>
              <Text style={[s.cellText, { color: C.muted, fontWeight: '700' }]}>
                {pars.reduce((a, b) => a + b, 0)}
              </Text>
            </View>
            {players.map((p, pi) => (
              <View key={pi} style={s.row}>
                <Text style={[s.cellText, { fontWeight: '700', color: C.text }]}>
                  {p.strokes.reduce((a, b) => a + b, 0)}
                </Text>
              </View>
            ))}
          </View>

          {/* 가로 스크롤 셀 */}
          <ScrollView ref={tableRef} horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View>
              {/* 홀 번호 행 */}
              <View style={s.row}>
                {HOLES.map((h, i) => (
                  <TouchableOpacity key={h} style={[s.cell, i === hole && s.cellActive]} onPress={() => goHole(i)}>
                    <Text style={[s.cellText, s.holeNum, i === hole && s.activeText]}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* 파 행 */}
              <View style={s.row}>
                {pars.map((par, i) => (
                  <View key={i} style={[s.cell, i === hole && s.cellActive]}>
                    <Text style={[s.cellText, { color: C.muted }, i === hole && s.activeText]}>{par}</Text>
                  </View>
                ))}
              </View>
              {/* 선수별 행 */}
              {players.map((p, pi) => (
                <View key={pi} style={s.row}>
                  {p.strokes.map((st, i) => (
                    <TouchableOpacity key={i} style={[s.cell, i === hole && s.cellActive]} onPress={() => goHole(i)}>
                      <Text style={[s.cellText, { color: scoreColor(st, pars[i]) }, i === hole && { fontWeight: '800' }]}>
                        {st}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>

        </View>
      </View>

      {/* ── 중단: 현재 홀 수정 ── */}
      <View style={s.editCard}>
        <Text style={s.holeTitle}>{holeLabel(hole)} &nbsp; 파{pars[hole]}</Text>
        {players.map((p, pi) => (
          <View key={pi} style={s.playerRow}>
            <Text style={s.playerName}>{shortName(p.name)}</Text>
            <View style={s.shuttle}>
              <TouchableOpacity style={s.shuttleBtn} onPress={() => changeScore(pi, -1)}>
                <Text style={s.shuttleIcon}>▼</Text>
              </TouchableOpacity>
              <View style={s.scoreBox}>
                <Text style={[s.scoreNum, { color: scoreColor(p.strokes[hole], pars[hole]) }]}>
                  {p.strokes[hole]}
                </Text>
              </View>
              <TouchableOpacity style={s.shuttleBtn} onPress={() => changeScore(pi, 1)}>
                <Text style={s.shuttleIcon}>▲</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* ── 하단: 홀 네비게이션 ── */}
      <View style={s.bottomBar}>
        <View style={s.navRow}>
          <TouchableOpacity
            style={[s.navSide, hole === 0 && s.navDisabled]}
            onPress={() => goHole(Math.max(0, hole - 1))}
            disabled={hole === 0}
          >
            <Text style={[s.navText, hole === 0 && { opacity: 0.3 }]}>← 이전홀</Text>
          </TouchableOpacity>

          <Text style={s.navCenter}>{holeLabel(hole)} / 18</Text>

          <TouchableOpacity
            style={[s.navSide, { alignItems: 'flex-end' }, hole === 17 && s.navDisabled]}
            onPress={() => goHole(Math.min(17, hole + 1))}
            disabled={hole === 17}
          >
            <Text style={[s.navTextRight, hole === 17 && { opacity: 0.3 }]}>다음홀 →</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.doneBtn} onPress={goResult}>
          <Text style={s.doneBtnText}>수정완료</Text>
        </TouchableOpacity>
      </View>

      <AppTabBar />
    </View>
  )
}

const s = StyleSheet.create({
  // 날짜/골프장 정보
  infoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  infoDate: { fontSize: 13, fontWeight: '600', color: C.muted },
  infoCourse: { fontSize: 13, fontWeight: '700', color: C.text },

  // 테이블
  tableCard: {
    backgroundColor: C.card,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  tableInner: { flexDirection: 'row' },
  fixedCol: {
    paddingHorizontal: 10,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  totalFixedCol: {
    paddingHorizontal: 10,
    alignItems: 'center',
    borderRightWidth: 1, borderRightColor: C.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', height: 32 },
  labelText: { fontSize: 14, fontWeight: '700', color: C.text },
  cell: { width: CELL_W, alignItems: 'center', height: 32, justifyContent: 'center' },
  cellActive: { backgroundColor: C.greenLight, borderRadius: 6 },
  cellText: { fontSize: 14, color: C.text, textAlign: 'center' },
  activeText: { fontWeight: '800', color: C.green },
  holeNum: { color: C.muted, fontWeight: '600' },

  // 수정 카드
  editCard: {
    backgroundColor: C.card,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 14,
    padding: 16,
    flex: 1,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  holeTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 14, textAlign: 'center' },
  playerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  playerName: { fontSize: 15, fontWeight: '700', color: C.text, width: 60 },
  shuttle: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  shuttleBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  shuttleIcon: { fontSize: 13, color: C.green, fontWeight: '700' },
  scoreBox: { width: 44, alignItems: 'center' },
  scoreNum: { fontSize: 28, fontWeight: '900', color: C.text },

  // 하단 바
  bottomBar: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    backgroundColor: C.card,
    borderTopWidth: 1, borderTopColor: C.border,
    gap: 10,
  },
  navRow: { flexDirection: 'row', alignItems: 'center' },
  navSide: { flex: 1 },
  navDisabled: { opacity: 0.3 },
  navText: { fontSize: 13, fontWeight: '600', color: C.green },
  navTextRight: { fontSize: 13, fontWeight: '700', color: C.green },
  navCenter: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '800', color: C.text },
  doneBtn: {
    backgroundColor: C.green, borderRadius: 50,
    paddingVertical: 12, alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
