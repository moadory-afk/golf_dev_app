import { useMemo } from 'react'
import { createAICaddieAdvice } from '../engine'
import type { AICaddieAdvice, AICaddieInput } from '../types/caddie'

export function useAICaddie(input: AICaddieInput | null | undefined): AICaddieAdvice | null {
  return useMemo(() => {
    if (!input) return null
    return createAICaddieAdvice(input)
  }, [input])
}
