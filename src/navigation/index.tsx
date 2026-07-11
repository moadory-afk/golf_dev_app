import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SkinProvider, useSkin } from '../skins'
import { Icon, type IconName } from '../components/Icon'
import { colorLayers, radius, spacing, typography } from '../design/tokens'
import { ClubProvider, useClub } from '../lib/ClubContext'
import { UserProfileProvider } from '../lib/UserProfileContext'
import HomeScreen from '../screens/HomeExperienceScreen'
import ClubScreen from '../screens/ClubScreen'
import HistoryScreen from '../screens/HistoryScreen'
import ProfileScreen from '../screens/ProfileScreen'
import HeroLabScreen from '../screens/HeroLabScreen'
import RoundDetailScreen from '../screens/RoundDetailScreen'
import ScoreCaptureScreen from '../screens/ScoreCaptureScreen'
import ScoreReviewScreen from '../screens/ScoreReviewScreen'
import ResultScreen from '../screens/ResultScreen'
import MemberScreen from '../screens/MemberScreen'
import FeePrototypeScreen from '../screens/FeePrototypeScreen'
import FeeMemberPrototypeScreen from '../screens/FeeMemberPrototypeScreen'
import SignUpScreen from '../screens/SignUpScreen'
import LoginScreen from '../screens/LoginScreen'
import NoticePrototypeScreen from '../screens/NoticePrototypeScreen'
import TreasuryEntryPrototypeScreen from '../screens/TreasuryEntryPrototypeScreen'
import TreasuryLedgerPrototypeScreen from '../screens/TreasuryLedgerPrototypeScreen'
import RoundSetupScreen from '../screens/RoundSetupScreen'
import RoundSchedulePrototypeScreen from '../screens/RoundSchedulePrototypeScreen'
import CaddieBookScreen from '../screens/CaddieBookScreen'
import ScoreEntryScreen from '../screens/ScoreEntryScreen'
import type { MainTabParamList, RootStackParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<MainTabParamList>()

const TAB_META: Record<keyof MainTabParamList, { title: string; emoji: string; icon: IconName }> = {
  Home: { title: '홈', emoji: '🏠', icon: 'home' },
  Club: { title: '클럽', emoji: '⛳', icon: 'flag' },
  History: { title: '기록', emoji: '📋', icon: 'list' },
}

const MAIN_TAB_ORDER: (keyof MainTabParamList)[] = ['Home', 'Club', 'History']
const SWIPE_MIN_DISTANCE = 56
const SWIPE_DIRECTION_LOCK = 1.25
const TAB_SLIDE_DURATION = 220
// 상단 Hero/대문 카드 안의 가로 스와이프는 카드 캐러셀 전용으로 사용한다.
// 메뉴 간 스와이프는 Hero 영역 아래에서 시작한 제스처만 처리한다.

function SwipeableTabScene({
  current,
  navigation,
  children,
}: {
  current: keyof MainTabParamList
  navigation: any
  children: ReactNode
}) {
  const translateX = useRef(new Animated.Value(0)).current
  const [sceneSize, setSceneSize] = useState({ width: 0, height: 0 })
  const sceneWidth = sceneSize.width
  const swipeGuardTop = sceneSize.height > 0
    ? Math.max(0, Math.round(Math.min(sceneSize.height * 0.52, sceneSize.height - 180)))
    : 0

  const moveToTab = (nextTab: keyof MainTabParamList, direction: -1 | 1) => {
    if (sceneWidth <= 0) {
      navigation.navigate(nextTab)
      return
    }

    Animated.timing(translateX, {
      toValue: direction * -sceneWidth,
      duration: TAB_SLIDE_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0)
      navigation.navigate(nextTab)
    })
  }

  const resetPosition = () => {
    Animated.spring(translateX, {
      toValue: 0,
      speed: 18,
      bounciness: 4,
      useNativeDriver: true,
    }).start()
  }

  useEffect(() => {
    translateX.setValue(0)
  }, [current, sceneWidth, translateX])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (swipeGuardTop > 0 && gesture.y0 <= swipeGuardTop) return false

          const absX = Math.abs(gesture.dx)
          const absY = Math.abs(gesture.dy)
          return absX > 14 && absX > absY * SWIPE_DIRECTION_LOCK
        },
        onPanResponderGrant: () => {
          translateX.stopAnimation()
        },
        onPanResponderMove: (_, gesture) => {
          const currentIndex = MAIN_TAB_ORDER.indexOf(current)
          const isFirst = currentIndex === 0
          const isLast = currentIndex === MAIN_TAB_ORDER.length - 1
          const isBlocked = (isFirst && gesture.dx > 0) || (isLast && gesture.dx < 0)
          translateX.setValue(isBlocked ? gesture.dx * 0.22 : gesture.dx)
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gesture) => {
          const absX = Math.abs(gesture.dx)
          const absY = Math.abs(gesture.dy)
          if (absX < SWIPE_MIN_DISTANCE || absX < absY * SWIPE_DIRECTION_LOCK) {
            resetPosition()
            return
          }

          const currentIndex = MAIN_TAB_ORDER.indexOf(current)
          const direction = gesture.dx < 0 ? 1 : -1
          const nextIndex = currentIndex + direction
          const nextTab = MAIN_TAB_ORDER[nextIndex]
          if (!nextTab) {
            resetPosition()
            return
          }

          moveToTab(nextTab, direction)
        },
        onPanResponderTerminate: resetPosition,
      }),
    [current, navigation, sceneWidth, swipeGuardTop, translateX],
  )

  return (
    <View
      style={navStyles.swipeScene}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout
        setSceneSize((prev) => (
          prev.width === width && prev.height === height
            ? prev
            : { width, height }
        ))
      }}
      {...panResponder.panHandlers}
    >
      <Animated.View style={[navStyles.swipeAnimatedScene, { transform: [{ translateX }] }]}>
        {children}
      </Animated.View>
    </View>
  )
}

function CloseBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={navStyles.closeBtn}>
      <Text style={navStyles.closeBtnText}>닫기</Text>
    </TouchableOpacity>
  )
}

function TabIcon({
  focused,
  color,
  emoji,
  icon,
  title,
}: {
  focused: boolean
  color: string
  emoji: string
  icon: IconName
  title: string
}) {
  const { palette, isModern } = useSkin()
  if (!isModern) {
    return <Text style={{ fontSize: 22, color }}>{emoji}</Text>
  }

  return (
    <View
      style={[
        navStyles.tabButtonContent,
        { borderColor: focused ? palette.green : 'transparent' },
        focused && { backgroundColor: palette.tabActiveBg },
      ]}
    >
      <View
        style={[
          navStyles.tabIconBubble,
          { backgroundColor: focused ? palette.green : 'transparent' },
        ]}
      >
        <Icon name={icon} size={focused ? 19 : 18} color={focused ? '#fff' : palette.muted} strokeWidth={focused ? 2.5 : 1.9} />
      </View>
      <Text
        style={[
          navStyles.tabButtonText,
          { color: focused ? palette.text : palette.muted },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </View>
  )
}

function MainTabs() {
  const { palette, isModern } = useSkin()
  const tabBarIcon = (name: keyof MainTabParamList) =>
    ({ focused, color }: { focused: boolean; color: string }) => (
      <TabIcon focused={focused} color={color} emoji={TAB_META[name].emoji} icon={TAB_META[name].icon} title={TAB_META[name].title} />
    )

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'shift' as any,
        tabBarActiveTintColor: isModern ? palette.text : palette.green,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: isModern
          ? {
              position: 'absolute',
              left: spacing.md,
              right: spacing.md,
              bottom: spacing.sm,
              height: 78,
              borderTopWidth: 0,
              borderRadius: radius.xxl,
              borderWidth: 1,
              borderColor: colorLayers.cardHairline,
              backgroundColor: palette.tabBg,
              paddingHorizontal: spacing.sm,
              paddingTop: 7,
              paddingBottom: 7,
              shadowColor: palette.greenDark,
              shadowOpacity: palette.shadowOpacity * 2,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
              elevation: 8,
            }
          : {
              borderTopColor: palette.border,
              backgroundColor: palette.tabBg,
              height: 58,
              paddingBottom: spacing.sm,
            },
        tabBarShowLabel: !isModern,
        tabBarButton: (props: any) => (
          <TouchableOpacity
            {...props}
            activeOpacity={0.78}
            style={[
              props.style,
              isModern && ({ outlineStyle: 'none' } as any),
            ]}
          />
        ),
        tabBarIconStyle: isModern
          ? {
              width: '100%',
              height: 58,
              marginTop: 0,
            }
          : undefined,
        tabBarItemStyle: isModern
          ? {
              height: 64,
              borderRadius: radius.xl,
              paddingVertical: 0,
            }
          : undefined,
        tabBarLabelStyle: {
          ...typography.caption,
          fontWeight: isModern ? '900' : '700',
        },
      }}
    >
      <Tab.Screen name="Home" options={{ title: TAB_META.Home.title, tabBarIcon: tabBarIcon('Home') }}>
        {({ navigation }) => (
          <SwipeableTabScene current="Home" navigation={navigation}>
            <HomeScreen />
          </SwipeableTabScene>
        )}
      </Tab.Screen>
      <Tab.Screen name="Club" options={{ title: TAB_META.Club.title, tabBarIcon: tabBarIcon('Club') }}>
        {({ navigation }) => (
          <SwipeableTabScene current="Club" navigation={navigation}>
            <ClubScreen />
          </SwipeableTabScene>
        )}
      </Tab.Screen>
      <Tab.Screen name="History" options={{ title: TAB_META.History.title, tabBarIcon: tabBarIcon('History') }}>
        {({ navigation }) => (
          <SwipeableTabScene current="History" navigation={navigation}>
            <HistoryScreen />
          </SwipeableTabScene>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  )
}

function closeToManageMenu(navigation: any, returnToManageMenu?: boolean) {
  if (returnToManageMenu) {
    navigation.navigate('Main', { screen: 'Club', params: { openManageMenu: true } })
    return
  }
  navigation.goBack()
}

function clubScreenTitle(clubName: string | undefined, title: string) {
  return clubName ? `${clubName} ${title}` : title
}

function NavigationStack({ session }: { session: import('@supabase/supabase-js').Session | null }) {
  const { palette } = useSkin()
  const { activeClub } = useClub()
  const clubName = activeClub?.name

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={session ? 'Main' : 'Login'}
        screenOptions={{
          headerStyle: { backgroundColor: palette.headerBg },
          headerTintColor: palette.headerText,
          headerTitleStyle: { fontWeight: '700' },
          headerBackVisible: false,
        }}
      >
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: '회원가입' }} />
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} initialParams={undefined} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={({ navigation }) => ({ title: '프로필 · 설정', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="HeroLab" component={HeroLabScreen} options={({ navigation }) => ({ title: 'Hero Lab', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="FeePrototype" component={FeePrototypeScreen} options={({ navigation, route }) => ({ title: clubScreenTitle(clubName, '회비 관리'), headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => closeToManageMenu(navigation, route.params?.returnToManageMenu)} /> })} />
          <Stack.Screen name="RoundSchedulePrototype" component={RoundSchedulePrototypeScreen} options={({ navigation, route }) => {
            const modalOnly = route.params?.modalOnly
            return {
              title: clubScreenTitle(clubName, '라운드 일정'),
              headerShown: !modalOnly,
              presentation: modalOnly ? 'transparentModal' : 'card',
              contentStyle: modalOnly ? { backgroundColor: 'transparent' } : undefined,
              headerLeft: () => null,
              headerRight: () => <CloseBtn onPress={() => closeToManageMenu(navigation, route.params?.returnToManageMenu)} />,
            }
          }} />
          <Stack.Screen name="FeeMemberPrototype" component={FeeMemberPrototypeScreen} options={({ navigation }) => ({ title: '회원 회비 상세', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="TreasuryLedgerPrototype" component={TreasuryLedgerPrototypeScreen} options={({ navigation }) => ({ title: '입금 · 지급 내역', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen
            name="TreasuryEntryPrototype"
            component={TreasuryEntryPrototypeScreen}
            options={({ navigation, route }) => ({
              title: route.params.entry
                ? route.params.kind === 'income'
                  ? '입금 수정'
                  : '지급 수정'
                : route.params.kind === 'income'
                  ? '입금 등록'
                  : '지급 등록',
              headerLeft: () => null,
              headerRight: () => <CloseBtn onPress={() => navigation.goBack()} />,
            })}
          />
          <Stack.Screen name="NoticePrototype" component={NoticePrototypeScreen} options={({ navigation, route }) => ({ title: clubScreenTitle(clubName, '공지사항'), headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => closeToManageMenu(navigation, route.params?.returnToManageMenu)} /> })} />
          <Stack.Screen name="Members" component={MemberScreen} options={({ navigation, route }) => ({ title: clubScreenTitle(clubName, '회원 관리'), headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => closeToManageMenu(navigation, route.params?.returnToManageMenu)} /> })} />
          <Stack.Screen name="RoundDetail" component={RoundDetailScreen} options={({ navigation }) => ({ title: '라운드 상세', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.navigate('Main', { screen: 'History' })} /> })} />
          <Stack.Screen name="ScoreCapture" component={ScoreCaptureScreen} options={({ navigation }) => ({ title: '스코어 입력', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="ScoreReview" component={ScoreReviewScreen} options={({ navigation }) => ({ title: '스코어 확인 · 보정', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="Result" component={ResultScreen} options={({ navigation }) => ({ title: '라운드 결과', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="RoundSetup" component={RoundSetupScreen} options={({ navigation }) => ({ title: '코스 · 날짜 선택', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="CaddieBook" component={CaddieBookScreen} options={({ navigation }) => ({ title: '똥꾸 캐디의 조언', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="ScoreEntry" component={ScoreEntryScreen} options={({ navigation }) => ({ title: '스코어 입력', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.navigate('Main', { screen: 'History' })} /> })} />

      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function Navigation({ session }: { session: import('@supabase/supabase-js').Session | null }) {
  return (
    <SkinProvider>
      <UserProfileProvider>
        <ClubProvider>
          <NavigationStack session={session} />
        </ClubProvider>
      </UserProfileProvider>
    </SkinProvider>
  )
}

const navStyles = StyleSheet.create({
  swipeScene: {
    flex: 1,
    overflow: 'hidden',
  },
  swipeAnimatedScene: {
    flex: 1,
  },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  tabButtonContent: {
    width: '94%',
    height: 58,
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
})
