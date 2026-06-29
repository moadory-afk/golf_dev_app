import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { C, isTurf } from '../theme'
import { Icon, type IconName } from '../components/Icon'
import { ClubProvider } from '../lib/ClubContext'
import HomeScreen from '../screens/HomeScreen'
import ClubScreen from '../screens/ClubScreen'
import HistoryScreen from '../screens/HistoryScreen'
import ProfileScreen from '../screens/ProfileScreen'
import RoundDetailScreen from '../screens/RoundDetailScreen'
import ScoreCaptureScreen from '../screens/ScoreCaptureScreen'
import ScoreReviewScreen from '../screens/ScoreReviewScreen'
import ResultScreen from '../screens/ResultScreen'
import MemberScreen from '../screens/MemberScreen'
import SettingsScreen from '../screens/SettingsScreen'
import FeePrototypeScreen from '../screens/FeePrototypeScreen'
import NoticePrototypeScreen from '../screens/NoticePrototypeScreen'
import RoundSetupScreen from '../screens/RoundSetupScreen'
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
  if (!isTurf) {
    return <Text style={{ fontSize: 22, color }}>{emoji}</Text>
  }

  return (
    <View style={[navStyles.tabIconPill, focused && navStyles.tabIconPillActive]}>
      <Icon name={icon} size={20} color={focused ? C.accentText : C.muted} strokeWidth={focused ? 2.2 : 1.8} />
    </View>
  )
}

function MainTabs() {
  const tabBarIcon = (name: keyof MainTabParamList) =>
    ({ focused, color }: { focused: boolean; color: string }) => (
      <TabIcon focused={focused} color={color} emoji={TAB_META[name].emoji} icon={TAB_META[name].icon} />
    )

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isTurf ? C.text : C.green,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          borderTopColor: C.border,
          backgroundColor: '#fff',
          height: isTurf ? 66 : 58,
          paddingTop: isTurf ? 7 : 0,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: isTurf ? '700' : '600',
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

export default function Navigation() {
  return (
    <ClubProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: C.greenDark },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
            headerBackVisible: false,
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={({ navigation }) => ({ title: '프로필 · 설정', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={({ navigation }) => ({ title: '설정', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="FeePrototype" component={FeePrototypeScreen} options={({ navigation }) => ({ title: '회비 관리', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="NoticePrototype" component={NoticePrototypeScreen} options={({ navigation }) => ({ title: '공지 관리', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="Members" component={MemberScreen} options={({ navigation }) => ({ title: '멤버 관리', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="RoundDetail" component={RoundDetailScreen} options={({ navigation }) => ({ title: '라운드 상세', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.navigate('Main', { screen: 'History' })} /> })} />
          <Stack.Screen name="ScoreCapture" component={ScoreCaptureScreen} options={({ navigation }) => ({ title: '스코어 입력', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="ScoreReview" component={ScoreReviewScreen} options={({ navigation }) => ({ title: '스코어 확인 · 보정', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="Result" component={ResultScreen} options={({ navigation }) => ({ title: '라운드 결과', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="RoundSetup" component={RoundSetupScreen} options={({ navigation }) => ({ title: '코스 · 날짜 선택', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="ScoreEntry" component={ScoreEntryScreen} options={({ navigation }) => ({ title: '스코어 입력', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.navigate('Main', { screen: 'History' })} /> })} />
        </Stack.Navigator>
      </NavigationContainer>
    </ClubProvider>
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
  tabIconPillActive: {
    backgroundColor: C.accent,
  },
})
