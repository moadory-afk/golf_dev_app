import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { C } from '../theme'
import { SkinProvider, useSkin } from '../skins'
import { Icon, type IconName } from '../components/Icon'
import { ClubProvider, useClub } from '../lib/ClubContext'
import { UserProfileProvider } from '../lib/UserProfileContext'
import HomeScreen from '../screens/HomeScreen'
import ClubScreen from '../screens/ClubScreen'
import HistoryScreen from '../screens/HistoryScreen'
import ProfileScreen from '../screens/ProfileScreen'
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
import ScoreEntryScreen from '../screens/ScoreEntryScreen'
import type { MainTabParamList, RootStackParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<MainTabParamList>()

const TAB_META: Record<keyof MainTabParamList, { title: string; emoji: string; icon: IconName }> = {
  Home: { title: '홈', emoji: '🏠', icon: 'home' },
  Club: { title: '클럽', emoji: '⛳', icon: 'flag' },
  History: { title: '기록', emoji: '📋', icon: 'list' },
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
}: {
  focused: boolean
  color: string
  emoji: string
  icon: IconName
}) {
  const { palette, isModern } = useSkin()
  if (!isModern) {
    return <Text style={{ fontSize: 22, color }}>{emoji}</Text>
  }

  return (
    <View style={[navStyles.tabIconPill, focused && { backgroundColor: palette.tabActiveBg }]}>
      <Icon name={icon} size={20} color={focused ? palette.accentText : palette.muted} strokeWidth={focused ? 2.2 : 1.8} />
    </View>
  )
}

function MainTabs() {
  const { palette, isModern } = useSkin()
  const tabBarIcon = (name: keyof MainTabParamList) =>
    ({ focused, color }: { focused: boolean; color: string }) => (
      <TabIcon focused={focused} color={color} emoji={TAB_META[name].emoji} icon={TAB_META[name].icon} />
    )

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isModern ? palette.text : palette.green,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          borderTopColor: palette.border,
          backgroundColor: palette.tabBg,
          height: isModern ? 66 : 58,
          paddingTop: isModern ? 7 : 0,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: isModern ? '700' : '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: TAB_META.Home.title, tabBarIcon: tabBarIcon('Home') }}
      />
      <Tab.Screen
        name="Club"
        component={ClubScreen}
        options={{ title: TAB_META.Club.title, tabBarIcon: tabBarIcon('Club') }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: TAB_META.History.title, tabBarIcon: tabBarIcon('History') }}
      />
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
  tabIconPill: {
    minWidth: 46,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconPillActive: {},
})
