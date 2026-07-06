import type { ReactNode } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SkinProvider } from '../../skins'

/**
 * AppProviders
 *
 * 앱 전역 Provider의 진입점입니다.
 * 앞으로 인증, 서버 상태, 알림, 분석, Feature Flag 등 전역 Provider는
 * App.tsx가 아니라 이 파일에서 관리합니다.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <SkinProvider>{children}</SkinProvider>
    </SafeAreaProvider>
  )
}
