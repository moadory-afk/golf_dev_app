import AsyncStorage from '@react-native-async-storage/async-storage'
import { TUTORIAL_VERSION } from './tutorial'

export type FeatureTutorialKey = 'history' | 'award' | 'lotto' | 'caddieBook'

function featureStorageKey(feature: FeatureTutorialKey, userId?: string | null) {
  return `@gogopar_tutorial_v${TUTORIAL_VERSION}:feature:${feature}:${userId || 'guest'}`
}

export async function hasCompletedFeatureTutorial(
  feature: FeatureTutorialKey,
  userId?: string | null,
): Promise<boolean> {
  return (await AsyncStorage.getItem(featureStorageKey(feature, userId))) === 'completed'
}

export async function markFeatureTutorialCompleted(
  feature: FeatureTutorialKey,
  userId?: string | null,
): Promise<void> {
  await AsyncStorage.setItem(featureStorageKey(feature, userId), 'completed')
}

export async function resetFeatureTutorials(userId?: string | null): Promise<void> {
  const features: FeatureTutorialKey[] = ['history', 'award', 'lotto', 'caddieBook']
  await Promise.all(
    features.map((feature) => AsyncStorage.removeItem(featureStorageKey(feature, userId))),
  )
}
