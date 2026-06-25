import { View, Text, StyleSheet } from 'react-native'
import { Icon } from '../components/Icon'

const GOLD  = '#c9900a'
const GREEN = '#1a6b44'

export default function SplashScreen() {
  return (
    <View style={s.container}>
      <View style={s.card}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.flag}><Icon name="flag" size={18} color="#fff" strokeWidth={2} /></View>
          <Text style={s.gogopar}>GogoPar</Text>
          <Text style={s.scoreLabel}>S C O R E</Text>
        </View>

        {/* Scorecard grid */}
        <View style={s.body}>
          <View style={s.row}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <View key={n} style={s.cell}>
                <View style={s.holeDot}>
                  <Text style={s.holeNum}>{n}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={s.row}>
            {[4,3,5,4,3,5,4,3,4].map((v, i) => (
              <View key={i} style={s.cell}>
                <Text style={s.parNum}>{v}</Text>
              </View>
            ))}
          </View>

          <View style={s.sep} />

          {/* Check */}
          <View style={s.checkWrap}>
            <View style={s.checkCircle}>
              <Text style={s.checkMark}>✓</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8f5ec',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  card: {
    width: 196,
    transform: [{ scale: 0.5 }],
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1a6b44',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    backgroundColor: GREEN,
    paddingTop: 14,
    paddingBottom: 11,
    alignItems: 'center',
    gap: 2,
  },
  flag: {
    fontSize: 18,
    marginBottom: 2,
  },
  gogopar: {
    fontSize: 20,
    fontWeight: '900',
    color: GOLD,
    letterSpacing: 0.5,
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 5,
    marginTop: 1,
  },
  body: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  holeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#eaf5ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holeNum: {
    fontSize: 7,
    fontWeight: '700',
    color: GREEN,
  },
  parNum: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginTop: 1,
  },
  sep: {
    height: 1,
    backgroundColor: '#e0ede4',
    marginVertical: 8,
  },
  checkWrap: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eaf5ef',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26,107,68,0.15)',
  },
  checkMark: {
    fontSize: 18,
    color: GREEN,
    fontWeight: '900',
  },
})
