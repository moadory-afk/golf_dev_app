import { createAICaddieAdvice } from './index'
import type { AICaddieAdvice, AICaddieInput } from '../types/caddie'

export type CaddieEngineSelfTestCase = {
  name: string
  input: AICaddieInput
  expectedClubLabel?: string
  expectedRiskLevel?: AICaddieAdvice['risk']['level']
}

export const caddieEngineSelfTestCases: CaddieEngineSelfTestCase[] = [
  {
    name: '맞바람과 오르막을 반영해 4H를 추천한다',
    input: {
      environment: {
        remainingDistanceM: 152,
        windSpeedMps: 5,
        windDirection: 'hurting',
        elevationM: 5,
        slopeDirection: 'uphill',
        lie: 'fairway',
      },
      distanceProfile: {
        hybrid4: 165,
        iron5: 155,
        iron6: 145,
        iron7: 135,
      },
    },
    expectedClubLabel: '4H',
  },
  {
    name: '해저드와 OB 키워드를 high risk로 분류한다',
    input: {
      environment: { remainingDistanceM: 180, intent: 'safe' },
      distanceProfile: { wood3: 180, wood5: 170, hybrid4: 160 },
      holeGuide: {
        caution: '좌측 OB와 우측 해저드가 있어 티샷 방향성 관리가 중요합니다.',
      },
    },
    expectedRiskLevel: 'high',
  },
]

export function runCaddieEngineSelfTest() {
  return caddieEngineSelfTestCases.map((testCase) => {
    const advice = createAICaddieAdvice(testCase.input)
    return {
      name: testCase.name,
      passedClub: testCase.expectedClubLabel ? advice.recommendation?.clubLabel === testCase.expectedClubLabel : true,
      passedRisk: testCase.expectedRiskLevel ? advice.risk.level === testCase.expectedRiskLevel : true,
      advice,
    }
  })
}
