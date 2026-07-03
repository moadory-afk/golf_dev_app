import AsyncStorage from '@react-native-async-storage/async-storage'

export type HandicapBasis = 3 | 5 | 10

const LEGACY_KEY = '@gogopar_handicap_basis'
const CLUB_KEY_PREFIX = '@gogopar_handicap_basis:club:'

function parseHandicapBasis(value: string | null): HandicapBasis | null {
  if (value === '3' || value === '5' || value === '10') return Number(value) as HandicapBasis
  return null
}

export async function loadHandicapBasis(clubId?: string | null): Promise<HandicapBasis> {
  if (clubId) {
    const clubValue = parseHandicapBasis(await AsyncStorage.getItem(`${CLUB_KEY_PREFIX}${clubId}`))
    if (clubValue) return clubValue
  }
  return parseHandicapBasis(await AsyncStorage.getItem(LEGACY_KEY)) ?? 5
}

export async function saveHandicapBasis(clubId: string, value: HandicapBasis): Promise<void> {
  await AsyncStorage.setItem(`${CLUB_KEY_PREFIX}${clubId}`, String(value))
}
