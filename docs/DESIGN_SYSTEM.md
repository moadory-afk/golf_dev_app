# GogoPar Design System

GogoPar Design System은 스킨, 토큰, 컴포넌트, 골프 전용 UI를 분리해서 관리한다.

## 레이어

```text
Skin Palette
  ↓
Design Token
  ↓
Base UI Component
  ↓
Golf Business Component
  ↓
Screen Section
```

## 기본 컴포넌트 예정

- GPButton
- GPCard
- GPSection
- GPText
- GPBadge
- GPChip
- GPAvatar
- GPListItem
- GPDialog
- GPBottomSheet

## 골프 전용 컴포넌트 예정

- GPHoleCard
- GPRoundCard
- GPScoreCard
- GPClubCard
- GPCaddieCard
- GPWeatherCard
- GPDistanceChip
- GPShotPlan

## 화면 구성 규칙

화면은 반드시 다음 단계를 따른다.

```text
Screen
  ↓
Section
  ↓
Card
  ↓
Widget
```

Home, Round, AI Caddie, Community 등 모든 화면은 같은 규칙으로 구성한다.
