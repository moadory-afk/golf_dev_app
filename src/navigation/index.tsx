import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, TouchableOpacity } from 'react-native'
import { C } from '../theme'
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
import RoundSetupScreen from '../screens/RoundSetupScreen'
import ScoreEntryScreen from '../screens/ScoreEntryScreen'
import type { RootStackParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator()

function CloseBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 5,
        marginRight: 8,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>닫기</Text>
    </TouchableOpacity>
  )
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          borderTopColor: C.border,
          backgroundColor: '#fff',
          height: 58,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: '홈', tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text> }}
      />
      <Tab.Screen
        name="Club"
        component={ClubScreen}
        options={{ title: '클럽', tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⛳</Text> }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: '기록', tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📋</Text> }}
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
          <Stack.Screen name="Members" component={MemberScreen} options={({ navigation }) => ({ title: '멤버 관리', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="RoundDetail" component={RoundDetailScreen} options={({ navigation }) => ({ title: '라운드 상세', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.navigate('Main', { screen: 'History' })} /> })} />
          <Stack.Screen name="ScoreCapture" component={ScoreCaptureScreen} options={({ navigation }) => ({ title: '스코어 입력', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="ScoreReview" component={ScoreReviewScreen} options={({ navigation }) => ({ title: '스코어 확인·보정', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="Result" component={ResultScreen} options={({ navigation }) => ({ title: '라운드 결과', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="RoundSetup" component={RoundSetupScreen} options={({ navigation }) => ({ title: '코스 · 날짜 선택', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.goBack()} /> })} />
          <Stack.Screen name="ScoreEntry" component={ScoreEntryScreen} options={({ navigation }) => ({ title: '스코어 입력', headerLeft: () => null, headerRight: () => <CloseBtn onPress={() => navigation.navigate('Main', { screen: 'History' })} /> })} />
        </Stack.Navigator>
      </NavigationContainer>
    </ClubProvider>
  )
}
