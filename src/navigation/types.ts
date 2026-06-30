import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { NavigatorScreenParams } from '@react-navigation/native'
import type { SettlementConfig } from '../lib/store'

export type MainTabParamList = {
  Home: undefined
  Club: undefined
  History: undefined
}

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined
  Profile: undefined
  Settings: undefined
  FeePrototype: undefined
  FeeMemberPrototype: { clubId: string; memberUserId: string; memberName: string; statusId: string }
  TreasuryLedgerPrototype: undefined
  TreasuryEntryPrototype: {
    kind: 'income' | 'expense'
    entry?: {
      id: string
      type: 'income' | 'expense'
      title: string
      amount: number
      entryDate: string
      memo: string
    }
  }
  NoticePrototype: undefined
  ScoreCapture: undefined
  Members: { clubId: string }
  RoundDetail: { id: string }
  RoundSetup: {
    ocrPlayers?: Array<{ name: string; strokes: number[] }>
    settlement?: SettlementConfig
  }
  ScoreEntry: {
    date: string
    courseName: string
    pars: number[]
    golfCourseId?: string
    players: Array<{ name: string; strokes: number[] }>
    editId?: string
    settlement?: SettlementConfig
    holeLabels?: string[]   // 예: ['밸리1',...,'밸리9','파인1',...,'파인9']
    photoUris?: string[]    // RoundSetup OCR 사진 → 라운드와 함께 저장
  }
  ScoreReview: {
    editId?: string
    courseName?: string
    date?: string
    pars?: number[]
    players?: Array<{ name: string; diffs: number[] }>
    photoUris?: string[]
    settlement?: SettlementConfig
    holeLabels?: string[]
  }
  Result: {
    editId?: string
    courseName?: string
    date?: string
    pars: number[]
    players: Array<{ name: string; strokes: number[] }>
    photoUris?: string[]
    settlement?: SettlementConfig
  }
}

export type RootStackProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>
