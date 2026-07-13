import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from './supabase'

type CropRect = {
  originX: number
  originY: number
  width: number
  height: number
}

export async function uploadRoundPhoto(uri: string, roundId: string, crop?: CropRect): Promise<string> {
  const actions: Parameters<typeof ImageManipulator.manipulateAsync>[1] = []
  if (crop) actions.push({ crop })
  actions.push({ resize: { width: 1200 } })

  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    actions,
    { compress: 0.68, format: ImageManipulator.SaveFormat.JPEG },
  )
  const response = await fetch(compressed.uri)
  const blob = await response.blob()
  const path = `${roundId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`

  const { error } = await supabase.storage
    .from('round-photos')
    .upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    })
  if (error) throw error

  const { data } = supabase.storage.from('round-photos').getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}
