# GogoPar Folder Structure

## 권장 구조

```text
src/
  app/
    AppProvider.tsx
    navigation/
    routes.ts

  core/
    api/
    repositories/
    services/
    storage/
    types/
    utils/

  theme/
    colors.ts
    typography.ts
    spacing.ts
    radius.ts
    shadows.ts
    motion.ts
    index.ts

  shared/
    ui/
      GPButton.tsx
      GPCard.tsx
      GPBadge.tsx
      GPChip.tsx
      GPAvatar.tsx
      GPText.tsx
      GPSection.tsx

    golf/
      GPHero.tsx
      GogoCard.tsx
      GPStatCard.tsx
      GPRoundTicket.tsx
      GPWeatherChip.tsx
      GPTeeTimeChip.tsx
      GPHandicapBadge.tsx

  features/
    home/
      screens/
        HomeScreenV2.tsx
      components/
      hooks/
        useHomeViewModel.ts
      services/
        homeService.ts
      types.ts

    round/
    club/
    record/
    caddiebook/
    settings/

  assets/
    heroes/
      default/
      courses/
        bomun/
          hero.png
          thumbnail.png
    mascot/
      gogo/
    icons/
    patterns/

docs/
  design/
  product/
  feature/
  development/
  management/
```

---

## 폴더 원칙

### app
전역 설정과 라우팅만 둔다.

### core
앱 전체에서 공통으로 사용하는 비즈니스 기반 코드.

### shared
재사용 가능한 UI 컴포넌트.

### features
각 기능별 화면, 훅, 서비스.

### assets
이미지, 캐릭터, Hero, 아이콘.

### docs
제품, 디자인, 기능, 개발 문서.
