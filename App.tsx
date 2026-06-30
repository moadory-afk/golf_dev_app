import { useEffect, useState, Component } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from './src/lib/supabase'
import { ensureProfile } from './src/lib/store'
import Navigation from './src/navigation'
import LoginScreen from './src/screens/LoginScreen'
import InviteScreen from './src/screens/InviteScreen'
import PromoScreen from './src/screens/PromoScreen'
import SplashScreen from './src/screens/SplashScreen'
import AdScreen from './src/screens/AdScreen'
import { Platform, View, ActivityIndicator, Text, ScrollView, StyleSheet } from 'react-native'
import { C } from './src/theme'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 }}>
          <Text style={{ color: 'red', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>앱 오류</Text>
          <Text style={{ color: '#333', fontSize: 13 }}>{err.message}</Text>
          <Text style={{ color: '#888', fontSize: 11, marginTop: 8 }}>{err.stack}</Text>
        </ScrollView>
      )
    }
    return this.props.children
  }
}

function WebFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>
  return (
    <View style={{ flex: 1, backgroundColor: '#c8d8c8', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 390, height: '100%', maxHeight: 844,
        overflow: 'hidden', borderRadius: 12,
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
      } as any}>
        {children}
      </View>
    </View>
  )
}

// URL에서 ?join= 파라미터 추출
function getJoinCode(): string | null {
  if (Platform.OS !== 'web') return null
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('join')
  } catch { return null }
}

function getPromo(): boolean {
  if (Platform.OS !== 'web') return false
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('promo') === '1'
  } catch { return false }
}

// URL 파라미터 제거 (참여 후 클린업)
function clearJoinParam() {
  if (Platform.OS === 'web') {
    try { window.history.replaceState({}, '', '/') } catch { /* ignore */ }
  }
}

export default function App() {
  const [stage, setStage] = useState<'splash' | 'ad' | 'ready'>('splash')
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [joinCode] = useState<string | null>(() => getJoinCode())
  const [joinDone, setJoinDone] = useState(false)
  const [showPromo, setShowPromo] = useState(() => getPromo())

  // 카카오톡 인앱 브라우저면 외부 브라우저(사파리/크롬)로 강제 전환.
  // 인앱 브라우저에선 ?join= 딥링크가 불안정해 초대화면이 안 뜨므로,
  // 현재 URL(초대코드 포함)을 그대로 외부 브라우저로 넘긴다.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
    if (/KAKAOTALK/i.test(ua)) {
      window.location.href =
        'kakaotalk://web/openExternalBrowser?url=' + encodeURIComponent(window.location.href)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setStage('ad'), 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const fallback = setTimeout(() => setLoading(false), 8000)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      clearTimeout(fallback)
      setLoading(false)
    }).catch(() => {
      clearTimeout(fallback)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      const name = session?.user?.user_metadata?.name
      if (session?.user && name) {
        ensureProfile(session.user.id, name).catch(() => {})
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  function handleJoined() {
    clearJoinParam()
    setJoinDone(true)
  }

  function handleDismiss() {
    clearJoinParam()
    setJoinDone(true)
  }

  const showInvite = !!joinCode && !joinDone

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <WebFrame>
          {stage === 'splash' ? (
            <SplashScreen />
          ) : stage === 'ad' ? (
            <AdScreen onDone={() => setStage('ready')} />
          ) : loading ? (
            <View style={js.center}>
              <ActivityIndicator color={C.green} size="large" />
            </View>
          ) : showPromo && !session ? (
            <PromoScreen onDismiss={() => { clearJoinParam(); setShowPromo(false) }} />
          ) : showInvite ? (
            <InviteScreen
              joinCode={joinCode!}
              onJoined={handleJoined}
              onDismiss={handleDismiss}
            />
          ) : session ? (
            <Navigation />
          ) : (
            <LoginScreen />
          )}
        </WebFrame>
      </SafeAreaProvider>
    </ErrorBoundary>
  )
}

const js = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  joinText: { marginTop: 12, color: C.muted, fontSize: 14 },
})
