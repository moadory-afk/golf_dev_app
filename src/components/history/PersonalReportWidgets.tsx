import { Text, TouchableOpacity, View } from 'react-native'
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg'
import { C } from '../../theme'

type HistoryStyles = Record<string, any>

export function MetricCard({ label, value, tone, styles }: { label: string; value: string; tone?: string; styles: HistoryStyles }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  )
}

export function CompactMetric({ label, value, styles }: { label: string; value: string; styles: HistoryStyles }) {
  return (
    <View style={styles.compactMetric}>
      <Text style={styles.compactMetricLabel}>{label}</Text>
      <Text style={styles.compactMetricValue}>{value}</Text>
    </View>
  )
}

export function CompactActionButton({ label, onPress, styles }: { label: string; onPress: () => void; styles: HistoryStyles }) {
  return (
    <TouchableOpacity style={styles.compactActionButton} activeOpacity={0.82} onPress={onPress}>
      <Text style={styles.compactActionText}>{label}</Text>
      <Text style={styles.compactActionArrow}>›</Text>
    </TouchableOpacity>
  )
}

export function DonutGauge({ label, value, styles }: { label: string; value: number | null; styles: HistoryStyles }) {
  const size = 104
  const radius = 34
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, value ?? 0))
  return (
    <View style={styles.gaugeCard}>
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

export function PuttBars({ data, styles }: { data: { date: string; value: number }[]; styles: HistoryStyles }) {
  const max = Math.max(4, ...data.map((item) => item.value))
  return (
    <View style={styles.visualCard}>
      <View style={styles.visualHeader}><Text style={styles.visualTitle}>퍼팅 추세</Text><Text style={styles.visualValue}>{data.length ? `${data[data.length - 1].value}개` : '-'}</Text></View>
      <View style={styles.puttBarRow}>
        {data.length === 0 ? <Text style={styles.visualEmpty}>추세 데이터가 없습니다.</Text> : data.map((item) => (
          <View key={item.date} style={styles.puttBarItem}>
            <Text style={styles.puttBarValue}>{item.value}</Text>
            <View style={[styles.puttBar, { height: Math.max(12, (item.value / max) * 58) }]} />
            <Text style={styles.puttBarDate}>{item.date.slice(5)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export function ObDistribution({ data, styles }: { data: { label: string; value: number }[]; styles: HistoryStyles }) {
  return (
    <View style={styles.visualCard}>
      <View style={styles.visualHeader}><Text style={styles.visualTitle}>OB/해저드 분포</Text><Text style={styles.visualValue}>{data.reduce((sum, item) => sum + item.value, 0)}회</Text></View>
      <View style={styles.obGrid}>
        {data.map((item) => (
          <View key={item.label} style={styles.obCell}>
            <Text style={styles.obLabel}>{item.label}</Text>
            <Text style={styles.obValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export function RadarChart({ data, styles }: { data: { label: string; value: number }[]; styles: HistoryStyles }) {
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
    <View style={styles.visualCard}>
      <View style={styles.visualHeader}><Text style={styles.visualTitle}>홀 유형 밸런스</Text><Text style={styles.visualValue}>낮을수록 강점</Text></View>
      {data.length < 3 ? <Text style={styles.visualEmpty}>분석 데이터가 부족합니다.</Text> : (
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

export function ScoreDonut({ data, styles }: { data: { label: string; value: number; color: string }[]; styles: HistoryStyles }) {
  const size = 156
  const center = size / 2
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const total = data.reduce((sum, item) => sum + item.value, 0)
  let offset = 0
  return (
    <View style={styles.visualCard}>
      <View style={styles.visualHeader}><Text style={styles.visualTitle}>스코어 구성</Text><Text style={styles.visualValue}>{total}홀</Text></View>
      {total === 0 ? <Text style={styles.visualEmpty}>스코어 데이터가 없습니다.</Text> : (
        <View style={styles.donutRow}>
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
          <View style={styles.donutLegend}>
            {data.map((item) => (
              <View key={item.label} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={styles.legendValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

export function StackedScoreBars({ data, styles }: { data: { date: string; birdie: number; par: number; bogey: number; doublePlus: number }[]; styles: HistoryStyles }) {
  return (
    <View style={styles.visualCard}>
      <View style={styles.visualHeader}><Text style={styles.visualTitle}>최근 라운드 구성</Text><Text style={styles.visualValue}>스택</Text></View>
      {data.length === 0 ? <Text style={styles.visualEmpty}>추세 데이터가 없습니다.</Text> : data.map((item) => {
        const total = Math.max(1, item.birdie + item.par + item.bogey + item.doublePlus)
        return (
          <View key={item.date} style={styles.stackRow}>
            <Text style={styles.stackDate}>{item.date.slice(5)}</Text>
            <View style={styles.stackTrack}>
              <View style={[styles.stackSeg, { flex: item.birdie, backgroundColor: C.info }]} />
              <View style={[styles.stackSeg, { flex: item.par, backgroundColor: C.green }]} />
              <View style={[styles.stackSeg, { flex: item.bogey, backgroundColor: C.warn }]} />
              <View style={[styles.stackSeg, { flex: item.doublePlus, backgroundColor: C.danger }]} />
              {total === 1 && item.birdie + item.par + item.bogey + item.doublePlus === 0 && <View style={[styles.stackSeg, { flex: 1, backgroundColor: C.border }]} />}
            </View>
          </View>
        )
      })}
    </View>
  )
}

export function ScoreDist({ label, value, color, styles }: { label: string; value: number; color: string; styles: HistoryStyles }) {
  return (
    <View style={styles.scoreDistItem}>
      <Text style={[styles.scoreDistValue, { color }]}>{value}</Text>
      <Text style={styles.scoreDistLabel}>{label}</Text>
    </View>
  )
}

export function BulletText({ text, styles }: { text: string; styles: HistoryStyles }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  )
}

export function DetailButton({ label, onPress, styles }: { label: string; onPress: () => void; styles: HistoryStyles }) {
  return (
    <TouchableOpacity style={styles.detailButton} activeOpacity={0.82} onPress={onPress}>
      <Text style={styles.detailButtonText}>{label}</Text>
      <Text style={styles.detailButtonArrow}>›</Text>
    </TouchableOpacity>
  )
}
