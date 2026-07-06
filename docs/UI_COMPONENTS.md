# GogoPar UI Components

GogoPar 화면은 앞으로 아래 순서를 우선 사용합니다.

```tsx
import { GPButton, GPCard, GPSection, GPText } from '../components/ui'
```

## 기본 원칙

- Screen은 Section으로 구성한다.
- Section 안에는 Card를 배치한다.
- Card 안에는 Text, Button, Chip, Badge 등 Widget을 배치한다.
- 색상은 직접 하드코딩하지 않고 `useSkin()` 기반 컴포넌트를 사용한다.

## Components

- `GPText`: 텍스트 스타일 표준화
- `GPCard`: 카드 컨테이너
- `GPButton`: 버튼
- `GPSection`: 섹션 헤더/본문 레이아웃
- `GPBadge`: 상태 표시
- `GPChip`: 선택/필터 칩
- `GPIconButton`: 아이콘 버튼
- `GPAvatar`: 사용자/멤버 아바타
- `GPDivider`: 구분선
