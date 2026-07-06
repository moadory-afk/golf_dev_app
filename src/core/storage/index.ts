import AsyncStorage from '@react-native-async-storage/async-storage'

export const appStorage = {
  async getString(key: string) {
    return AsyncStorage.getItem(key)
  },
  async setString(key: string, value: string) {
    await AsyncStorage.setItem(key, value)
  },
  async remove(key: string) {
    await AsyncStorage.removeItem(key)
  },
}
