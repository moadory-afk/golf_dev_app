import { useEffect, useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { GPButton, GPCard } from '../design'
import { useSkin } from '../skins'
import type { RootStackParamList } from '../navigation/types'
import { PremiumHomeHeroSection } from '../features/home/components'
import type { HomeHeroRound } from '../features/home/types/home'
import { COURSE_HERO_ASSETS, COURSE_HERO_STORAGE_KEY, getCourseHeroAssetByKey, type CourseHeroKey } from '../data/courseHeroImages'

type Nav = NativeStackNavigationProp<RootStackParamList>

function makePreviewRound(key: CourseHeroKey): HomeHeroRound {
  const asset = getCourseHeroAssetByKey(key)
  return {
    id: `hero-lab-${asset.key}`,
    courseId: asset.key,
    layoutId: undefined,
    courseName: asset.courseName,
    layoutName: '대표',
    dday: 'D-7',
    dateLabel: '7.18(토)',
    teeTime: '08:00',
    memberCount: 4,
    groupCount: 1,
    status: 'planned',
    statusLabel: '예정',
    locationLabel: asset.region,
    urgencyTone: 'calm',
    weatherText: '맑음',
    temperature: '27°',
    windText: '2m/s',
    routeTimeText: '45분',
    departureTimeText: '06:50',
  }
}

export default function HeroLabScreen() {
  const { palette } = useSkin()
  const nav = useNavigation<Nav>()
  const [selectedKey, setSelectedKey] = useState<CourseHeroKey>('hillsky')

  useEffect(() => {
    AsyncStorage.getItem(COURSE_HERO_STORAGE_KEY)
      .then((value) => {
        if (value === 'hillsky' || value === 'bomun') setSelectedKey(value)
      })
      .catch(() => {})
  }, [])

  const selectedAsset = getCourseHeroAssetByKey(selectedKey)
  const previewRound = useMemo(() => makePreviewRound(selectedKey), [selectedKey])

  async function applyHero() {
    await AsyncStorage.setItem(COURSE_HERO_STORAGE_KEY, selectedKey)
    Alert.alert('Hero 적용 완료', `${selectedAsset.label} 이미지를 홈 Hero에 적용했습니다.`, [
      { text: '홈에서 확인', onPress: () => nav.navigate('Main', { screen: 'Home' }) },
      { text: '확인' },
    ])
  }

  async function resetHero() {
    await AsyncStorage.removeItem(COURSE_HERO_STORAGE_KEY)
    Alert.alert('초기화 완료', '홈 Hero 이미지 선택값을 초기화했습니다.')
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: palette.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.titleBlock}>
        <Text style={[styles.eyebrow, { color: palette.green }]}>GogoPar Studio</Text>
        <Text style={[styles.title, { color: palette.text }]}>Hero Lab</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>Gemini로 만든 골프장 Hero 이미지를 앱 화면에서 바로 검수하고 적용합니다.</Text>
      </View>

      <GPCard style={styles.card}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>골프장 Hero 선택</Text>
        <View style={styles.selectorGrid}>
          {COURSE_HERO_ASSETS.map((asset) => {
            const active = asset.key === selectedKey
            return (
              <TouchableOpacity
                key={asset.key}
                activeOpacity={0.86}
                onPress={() => setSelectedKey(asset.key)}
                style={[
                  styles.selector,
                  { borderColor: active ? palette.green : palette.border, backgroundColor: active ? palette.greenLight : palette.card },
                ]}
              >
                <Text style={[styles.selectorTitle, { color: palette.text }]}>{asset.label}</Text>
                <Text style={[styles.selectorSub, { color: palette.muted }]}>{asset.imagePath}</Text>
                <Text style={[styles.selectorState, { color: active ? palette.green : palette.muted }]}>{active ? '선택됨' : '미리보기'}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </GPCard>

      <View style={styles.previewWrap}>
        <PremiumHomeHeroSection
          greeting=""
          userName="골퍼"
          clubName="GogoPar Club"
          rounds={[previewRound]}
          fallbackCourseName={selectedAsset.courseName}
          fallbackAddress={selectedAsset.region}
          fallbackWeatherText="맑음"
          fallbackTemperature="27°"
          fallbackDday="D-7"
          fallbackRoundDate="7.18(토)"
          fallbackTeeTime="08:00"
          isAdmin
          onCreateRound={() => {}}
          heroImageSource={selectedAsset.source}
        />
      </View>

      <GPCard style={styles.card}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>검수 포인트</Text>
        <Text style={[styles.checkText, { color: palette.muted }]}>① 좌측 텍스트 영역이 복잡하지 않은가?</Text>
        <Text style={[styles.checkText, { color: palette.muted }]}>② 골프장 특성이 실제 사진과 비슷한가?</Text>
        <Text style={[styles.checkText, { color: palette.muted }]}>③ 16:12 Hero 카드에서 주요 풍경이 잘 보이는가?</Text>
      </GPCard>

      <View style={styles.actions}>
        <GPButton label="Home Hero로 적용" onPress={applyHero} style={styles.actionButton} />
        <GPButton label="선택 초기화" variant="soft" onPress={resetHero} style={styles.actionButton} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  titleBlock: { marginBottom: 18 },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1.2, marginTop: 2 },
  subtitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 8 },
  card: { padding: 16, marginBottom: 18 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', marginBottom: 12 },
  selectorGrid: { gap: 10 },
  selector: { borderWidth: 1.5, borderRadius: 18, padding: 14 },
  selectorTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  selectorSub: { fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 4 },
  selectorState: { fontSize: 12, lineHeight: 16, fontWeight: '900', marginTop: 8 },
  previewWrap: { marginHorizontal: -20, marginBottom: 10, paddingHorizontal: 20 },
  checkText: { fontSize: 13, lineHeight: 20, fontWeight: '700', marginBottom: 5 },
  actions: { gap: 10 },
  actionButton: { width: '100%' },
})
