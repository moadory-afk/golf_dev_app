import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { NavigatorScreenParams } from '@react-navigation/native'

export type MainTabParamList = {
  Home: undefined
  Club: undefined
  History: undefined
}

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined
  Profile: undefined
  ScoreCapture: undefined
  Members: { clubId: string }
  RoundDetail: { id: string }
  ScoreReview: {
    editId?: string
    courseName?: string
    date?: string
    pars?: number[]
    players?: Array<{ name: string; diffs: number[] }>
    photoUris?: string[]
  }
  Result: {
    editId?: string
    courseName?: string
    date?: string
    pars: number[]
    players: Array<{ name: string; strokes: number[] }>
    photoUris?: string[]
  }
}

export type RootStackProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>
