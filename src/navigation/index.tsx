import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
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
import type { RootStackParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator()

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
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: '프로필 · 설정' }} />
          <Stack.Screen name="Members" component={MemberScreen} options={{ title: '멤버 관리' }} />
          <Stack.Screen name="RoundDetail" component={RoundDetailScreen} options={{ title: '라운드 상세' }} />
          <Stack.Screen name="ScoreCapture" component={ScoreCaptureScreen} options={{ title: '스코어 입력' }} />
          <Stack.Screen name="ScoreReview" component={ScoreReviewScreen} options={{ title: '스코어 확인·보정' }} />
          <Stack.Screen name="Result" component={ResultScreen} options={{ title: '라운드 결과' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </ClubProvider>
  )
}
