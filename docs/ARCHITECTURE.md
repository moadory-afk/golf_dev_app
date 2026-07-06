# GogoPar Architecture

GogoPar는 기능을 화면에 바로 붙이는 방식이 아니라, `Framework → Design System → Component → Feature → Screen` 순서로 확장한다.

## 목표 구조

```text
src/
├── app/                 # 앱 시작점, Provider, Navigation 조립
│   └── providers/
├── core/                # 공통 엔진: theme, storage, network, auth, config, utils
│   ├── theme/
│   └── storage/
├── design/              # 디자인 토큰과 디자인 시스템
├── components/          # 공통 UI와 골프 전용 컴포넌트
│   ├── ui/
│   ├── golf/
│   ├── layout/
│   └── common/
├── features/            # 기능 단위 모듈
├── lib/                 # 기존 비즈니스 로직. 점진적으로 core/features로 이동
├── navigation/          # 현재 Navigation. 추후 app/navigation으로 점진 이동
└── screens/             # 현재 화면. 추후 features/*/screens로 점진 이동
```

## 원칙

1. 기존 기능을 깨지 않기 위해 대규모 이동은 금지한다.
2. 새 구조는 먼저 만들고, 기존 import는 점진적으로 변경한다.
3. 화면은 `Screen → Section → Card → Widget` 구조를 따른다.
4. 전역 Provider는 `src/app/providers/AppProviders.tsx`에서만 조립한다.
5. 테마 접근은 장기적으로 `src/core/theme`을 기준으로 통일한다.

## 현재 Sprint 4-1에서 적용된 변경

- `src/app/providers/AppProviders.tsx` 추가
- `src/app/index.ts` 추가
- `src/core/theme/index.ts` 추가
- `src/core/storage/index.ts` 추가
- `App.tsx`의 전역 Provider 조립 책임 분리
- `Navigation` 내부의 `SkinProvider` 중복 제거

