# GogoPar Component Library v1.0

## 1. Base UI

### GPButton
기본 버튼.

Variants:
```text
primary
secondary
ghost
danger
```

### GPCard
모든 카드의 기본 컴포넌트.

Props:
```ts
variant?: 'default' | 'elevated' | 'glass' | 'outline'
padding?: 'sm' | 'md' | 'lg'
```

### GPBadge
상태 표시용 작은 라벨.

예:
```text
D-1
Today
조편성 완료
비
```

### GPChip
날씨, Tee Time, 코스명 등 작은 정보 표시.

### GPText
Typography Token을 사용하는 텍스트 컴포넌트.

---

## 2. Golf UI

### GPHero
홈과 골프장 상세에 사용하는 Hero 컴포넌트.

### GogoCard
GOGO 캐릭터와 메시지를 표시하는 카드.

### GPStatCard
핸디, 평균타수, 베스트 등 통계 카드.

### GPRoundTicket
예정 라운드 티켓 카드.

### GPWeatherChip
날씨 정보.

### GPTeeTimeChip
Tee Time 정보.

### GPHandicapBadge
핸디캡 표시.

---

## 3. Component 원칙

- 모든 컴포넌트는 Theme Token을 사용한다.
- 컴포넌트 안에서 API 호출 금지.
- Props가 없어도 깨지지 않는 기본값 제공.
- 한 컴포넌트는 하나의 목적만 가진다.
