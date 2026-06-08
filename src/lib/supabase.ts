import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321'
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key'

// 웹(iOS KakaoTalk WKWebView 포함)에서는 localStorage를 직접 사용
// AsyncStorage를 웹에서 쓰면 WKWebView에서 Promise가 hang되는 현상 발생
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
