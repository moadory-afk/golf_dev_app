import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type { ReactNode } from 'react'
import { C } from '../../theme'
import { fmtKRW } from '../../features/settlement'
import type { RoundAwardMoneySummary, RoundDetailSummary } from '../../features/history/roundSummaries'
import { shortName, type RoundLottoDraw, type RoundLottoEntry, type SavedRound } from '../../lib/store'

type HistoryStyles = Record<string, any>
type Basis = 'score' | 'handicap'
type AwardRowViewModel = RoundAwardMoneySummary['awardRows'][number]
type LottoAwardGroupViewModel = RoundAwardMoneySummary['lottoAwardGroups'][number]
type MoneyPairViewModel = RoundAwardMoneySummary['moneyPairs'][number]
type ActualRegularRankRow = RoundDetailSummary['actualRegularRank'][number]
type HandicapRegularRankRow = RoundDetailSummary['handicapRegularRank'][number]
type ShinScoreRankRow = RoundDetailSummary['shinScoreRank'][number]
type ShinRankRow = RoundDetailSummary['shinRank'][number]
type ScoreSummaryRow = RoundDetailSummary['scoreRows'][number]

function diffText(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function formatWon(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString('ko-KR')}원`
}

export function RegularRankTab({
  basis,
  onBasisChange,
  actualRows,
  handicapRows,
  styles,
}: {
  basis: Basis
  onBasisChange: (basis: Basis) => void
  actualRows: ActualRegularRankRow[]
  handicapRows: HandicapRegularRankRow[]
  styles: HistoryStyles
}) {
  const rows = basis === 'score' ? actualRows : handicapRows
  return (
    <View style={styles.detailPanel}>
      <View style={styles.detailPanelTopRow}>
        <Text style={[styles.detailPanelTitle, styles.detailPanelTitleInline]}>{basis === 'score' ? '정규 순위' : '핸디 기준 순위'}</Text>
        <View style={styles.detailBasisSwitch}>
          <TouchableOpacity style={[styles.detailBasisBtn, basis === 'score' && styles.detailBasisBtnActive]} onPress={() => onBasisChange('score')}><Text style={[styles.detailBasisText, basis === 'score' && styles.detailBasisTextActive]}>스코어</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.detailBasisBtn, basis === 'handicap' && styles.detailBasisBtnActive]} onPress={() => onBasisChange('handicap')}><Text style={[styles.detailBasisText, basis === 'handicap' && styles.detailBasisTextActive]}>핸디</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.detailTableHeader}><Text style={[styles.detailTh, { width: 34 }]}>순위</Text><Text style={[styles.detailTh, { flex: 1 }]}>이름</Text><Text style={[styles.detailTh, { width: 52, textAlign: 'right' }]}>스코어</Text><Text style={[styles.detailTh, { width: 52, textAlign: 'right' }]}>{basis === 'score' ? '파대비' : '핸디Net'}</Text></View>
      <ScrollView style={styles.detailRankScroll} showsVerticalScrollIndicator={false}>
        {rows.map((row, index) => (
          <View key={row.name} style={[styles.detailTableRow, index < 3 && styles.detailPodiumRow]}>
            <Text style={[styles.detailRank, { width: 34 }]}>{index + 1}</Text>
            <Text style={styles.detailPlayerName} numberOfLines={1}>{shortName(row.name)}</Text>
            <Text style={styles.detailScoreText}>{row.total}</Text>
            <Text style={styles.detailNetText}>{diffText(row.diff)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

export function ShinperioRankTab({
  basis,
  onBasisChange,
  hiddenHoles,
  scoreRows,
  handicapRows,
  styles,
}: {
  basis: Basis
  onBasisChange: (basis: Basis) => void
  hiddenHoles: number[]
  scoreRows: ShinScoreRankRow[]
  handicapRows: ShinRankRow[]
  styles: HistoryStyles
}) {
  return (
    <View style={styles.detailPanel}>
      <View style={styles.detailPanelTopRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.detailPanelTitle, styles.detailPanelTitleInline]}>{basis === 'score' ? '신페리오 스코어' : '신페리오 핸디 기준'}</Text>
          <Text style={styles.shinperioHoleText}>숨김홀 {hiddenHoles.join(', ')}</Text>
        </View>
        <View style={styles.detailBasisSwitch}>
          <TouchableOpacity style={[styles.detailBasisBtn, basis === 'score' && styles.detailBasisBtnActive]} onPress={() => onBasisChange('score')}><Text style={[styles.detailBasisText, basis === 'score' && styles.detailBasisTextActive]}>스코어</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.detailBasisBtn, basis === 'handicap' && styles.detailBasisBtnActive]} onPress={() => onBasisChange('handicap')}><Text style={[styles.detailBasisText, basis === 'handicap' && styles.detailBasisTextActive]}>핸디</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.detailTableHeader}><Text style={[styles.detailTh, { width: 34 }]}>순위</Text><Text style={[styles.detailTh, { flex: 1 }]}>이름</Text><Text style={[styles.detailTh, { width: 48, textAlign: 'right' }]}>총타</Text><Text style={[styles.detailTh, { width: 48, textAlign: 'right' }]}>{basis === 'score' ? '파대비' : '핸디'}</Text><Text style={[styles.detailTh, { width: 48, textAlign: 'right' }]}>{basis === 'score' ? '' : 'NET'}</Text></View>
      <ScrollView style={styles.detailRankScroll} showsVerticalScrollIndicator={false}>
        {basis === 'score'
          ? scoreRows.map((row, index) => (
              <View key={row.name} style={[styles.detailTableRow, index < 3 && styles.detailPodiumRow]}>
                <Text style={[styles.detailRank, { width: 34 }]}>{index + 1}</Text>
                <Text style={styles.detailPlayerName} numberOfLines={1}>{shortName(row.name)}</Text>
                <Text style={styles.detailSmallScore}>{row.total}</Text>
                <Text style={styles.detailSmallScore}>{diffText(row.diff)}</Text>
                <Text style={styles.detailNetText}></Text>
              </View>
            ))
          : handicapRows.map((row, index) => (
              <View key={row.name} style={[styles.detailTableRow, index < 3 && styles.detailPodiumRow]}>
                <Text style={[styles.detailRank, { width: 34 }]}>{index + 1}</Text>
                <Text style={styles.detailPlayerName} numberOfLines={1}>{shortName(row.name)}</Text>
                <Text style={styles.detailSmallScore}>{row.total}</Text>
                <Text style={styles.detailSmallScore}>{row.handicap}</Text>
                <Text style={styles.detailNetText}>{row.net}</Text>
              </View>
            ))}
      </ScrollView>
    </View>
  )
}

export function ScoreSummaryTab({ rows, styles }: { rows: ScoreSummaryRow[]; styles: HistoryStyles }) {
  return (
    <View style={styles.detailPanel}>
      <View style={styles.scoreSummaryGrid}>
        {rows.slice(0, 6).map((row) => (
          <View key={row.name} style={styles.scoreSummaryCard}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.scoreSummaryName} numberOfLines={1}>{shortName(row.name)}</Text>
              <Text style={styles.scoreSummarySub}>버디 {row.stats.birdie} · 파 {row.stats.par} · 보기 {row.stats.bogey}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.scoreSummaryTotal}>{row.total}</Text>
              <Text style={styles.scoreSummaryDiff}>{diffText(row.diff)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function AwardCard({ title, icon, children, styles }: { title: string; icon?: string; children: ReactNode; styles: HistoryStyles }) {
  return <View style={styles.backAwardCard}><View style={styles.backAwardHeader}>{icon ? <Text style={styles.backAwardHeaderIcon}>{icon}</Text> : null}<Text style={styles.backAwardTitle}>{title}</Text></View>{children}</View>
}

function AwardRow({
  awardKey,
  icon,
  label,
  winner,
  detail,
  first = false,
  multiSpecialAwardKeys,
  styles,
}: {
  awardKey?: string
  icon: string
  label: string
  winner: string
  detail: string
  first?: boolean
  multiSpecialAwardKeys: ReadonlySet<string>
  styles: HistoryStyles
}) {
  const hideDetail = awardKey ? multiSpecialAwardKeys.has(awardKey) : false
  return <View style={[styles.awardRow, first && { borderTopWidth: 0 }]}><View style={styles.awardIconWrap}><Text style={styles.awardIcon}>{icon}</Text></View><Text style={styles.awardLabel}>{label}</Text><Text style={styles.awardWinner}>{winner}</Text>{hideDetail ? null : <View style={styles.awardDetailWrap}><Text style={styles.awardDetail} numberOfLines={1}>{detail}</Text></View>}</View>
}

export function RoundAwardTab({
  clubName,
  clubRecordRows,
  awardRows,
  round,
  lottoEntries,
  lottoDraw,
  lottoAwardGroups,
  moneyGame,
  moneyPairs,
  multiSpecialAwardKeys,
  styles,
}: {
  clubName?: string
  clubRecordRows: Array<{ icon: string; label: string; value: string }>
  awardRows: AwardRowViewModel[]
  round: SavedRound
  lottoEntries: RoundLottoEntry[]
  lottoDraw: RoundLottoDraw | null
  lottoAwardGroups: LottoAwardGroupViewModel[]
  moneyGame: RoundAwardMoneySummary['moneyGame']
  moneyPairs: MoneyPairViewModel[]
  multiSpecialAwardKeys: ReadonlySet<string>
  styles: HistoryStyles
}) {
  return (
    <ScrollView style={styles.backAwardScroll} contentContainerStyle={styles.backAwardStack} showsVerticalScrollIndicator={false}>
      <AwardCard title={`${clubName ?? '클럽'} 기준 기록`} icon="🏅" styles={styles}>
        {clubRecordRows.length === 0 ? (
          <Text style={styles.backAwardMuted}>이번 라운드 신규 클럽 기록은 없습니다.</Text>
        ) : clubRecordRows.map((record, index) => (
          <AwardRow
            key={`${record.label}-${index}`}
            icon={record.icon}
            label={record.label}
            winner={record.value.split(' ')[0] ?? '-'}
            detail={record.value.replace(/^\S+\s*/, '')}
            first={index === 0}
            multiSpecialAwardKeys={multiSpecialAwardKeys}
            styles={styles}
          />
        ))}
      </AwardCard>
      <AwardCard title="클럽 시상" icon="🏆" styles={styles}>
        {awardRows.length === 0 ? (
          <Text style={styles.backAwardMuted}>설정된 시상 항목이 없습니다.</Text>
        ) : awardRows.map((award, index) => (
          <AwardRow
            key={`${award.label}-${index}`}
            awardKey={award.awardKey}
            icon={award.icon}
            label={award.label}
            winner={award.winner}
            detail={award.detail}
            first={index === 0}
            multiSpecialAwardKeys={multiSpecialAwardKeys}
            styles={styles}
          />
        ))}
      </AwardCard>
      <AwardCard title="Lotto 6/18" icon="🎯" styles={styles}>
        {!round.scheduleId ? (
          <Text style={styles.backAwardMuted}>라운드 일정 연결이 없습니다.</Text>
        ) : lottoEntries.length === 0 ? (
          <Text style={styles.backAwardMuted}>구매 내역이 없습니다.</Text>
        ) : lottoDraw?.drawStatus !== 'COMPLETED' ? (
          <Text style={styles.backAwardMuted}>추첨 완료 후 구매자별 적중 현황을 표시합니다.</Text>
        ) : lottoAwardGroups.length === 0 ? (
          <Text style={styles.backAwardMuted}>시상 대상자가 없습니다.</Text>
        ) : lottoAwardGroups.map((group, index) => (
          <View key={group.hits} style={[styles.lottoAwardGroupRow, index === 0 && { borderTopWidth: 0 }]}>
            <Text style={styles.lottoAwardGroupText}>{group.hits}개 적중 상금 {formatWon(group.prize)}</Text>
            <Text style={styles.lottoAwardGroupNames} numberOfLines={2}>{group.names}</Text>
          </View>
        ))}
      </AwardCard>
      {round.settlement ? (
        <>
          <View style={styles.backMoneySummary}>
            <Text style={styles.backAwardMuted}>타당 {round.settlement.strokeFee.toLocaleString('ko-KR')}원 · 버디 {round.settlement.birdieBonus.toLocaleString('ko-KR')}원 · 참가 {moneyGame?.participants.length ?? 0}명</Text>
          </View>
          <AwardCard title="머니게임" styles={styles}>
            {moneyPairs.length === 0 ? (
              <Text style={styles.backAwardMuted}>참가자 이름과 선수명이 맞지 않습니다.</Text>
            ) : moneyPairs.map((pair, index) => (
              <View key={`${pair.from}-${pair.to}-${index}`} style={[styles.moneyPairRow, index === 0 && { borderTopWidth: 0 }]}>
                <Text style={styles.moneyPairName}>{shortName(pair.from)}</Text>
                <Text style={styles.moneyPairArrow}>→</Text>
                <Text style={styles.moneyPairName}>{shortName(pair.to)}</Text>
                <Text style={[styles.moneyPairAmount, { color: pair.amount === 0 ? C.muted : C.text }]}>{pair.amount === 0 ? '동점' : fmtKRW(pair.amount)}</Text>
              </View>
            ))}
          </AwardCard>
        </>
      ) : (
        <AwardCard title="머니게임" styles={styles}>
          <Text style={styles.backAwardMuted}>이 라운드에는 정산 설정이 없습니다.</Text>
        </AwardCard>
      )}
    </ScrollView>
  )
}
