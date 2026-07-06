# GogoPar Design System v1.0

## 1. Brand Identity

**골프는 기록이 아니라 추억입니다.**

GogoPar는 골퍼의 하루를 시작하는 앱이다.  
기능보다 경험, 정보보다 감성을 우선한다.

---

## 2. Design Principles

### Hero First
Home 화면은 Hero가 중심이다.

### Emotion Before Information
정보를 보여주기 전에 감정을 만든다.

### Large White Space
여백을 두려워하지 않는다.

### One Focus
한 화면에는 하나의 핵심 메시지만 둔다.

### Card Based UI
모든 정보는 카드 단위로 보여준다.

---

## 3. Color System

| Token | Color | Usage |
|---|---|---|
| Primary | `#1E7A44` | 메인 그린 |
| Secondary | `#4CAF50` | 보조 그린 |
| Accent | `#FFD54F` | 강조, 날씨, 보상 |
| Orange | `#F59E0B` | 베스트, 기록 강조 |
| Blue | `#3B82F6` | 통계, 링크 |
| Purple | `#8B5CF6` | 커뮤니티, 보조 액션 |
| Danger | `#E74C3C` | 경고, 오류 |
| Background | `#F7FAF7` | 앱 배경 |
| Card | `#FFFFFF` | 카드 배경 |
| Text Primary | `#111827` | 주요 텍스트 |
| Text Secondary | `#6B7280` | 보조 텍스트 |

---

## 4. Typography

| Style | Size | Weight |
|---|---:|---|
| Hero Title | 42 | Bold |
| Page Title | 28 | Bold |
| Section Title | 22 | Bold |
| Card Title | 16 | Semibold |
| Body | 16 | Regular |
| Caption | 13 | Regular |

폰트는 `Pretendard`를 기본으로 사용한다.

---

## 5. Radius

| Component | Radius |
|---|---:|
| Hero | 28 |
| Card | 24 |
| Button | 20 |
| Badge | 999 |
| Image Thumbnail | 18 |

---

## 6. Shadow

기본 카드 그림자:

```text
Y: 8
Blur: 24
Opacity: 10%
Color: rgba(0, 0, 0, 0.10)
```

Hero와 주요 카드는 조금 더 깊은 그림자를 사용한다.

---

## 7. Spacing

| Token | Value |
|---|---:|
| xs | 4 |
| sm | 8 |
| md | 12 |
| lg | 16 |
| xl | 24 |
| xxl | 32 |

Home 화면 기본 좌우 여백은 `24px`로 한다.

---

## 8. Hero System

Hero는 GogoPar Home의 핵심이다.

Hero는 다음 상태를 지원한다.

```text
Morning
Afternoon
Evening
Night
Rain
Spring
Summer
Autumn
Winter
Special Event
```

Hero에는 너무 많은 정보를 넣지 않는다.

표시 정보는 아래까지만 허용한다.

```text
Greeting
Course Name
Weather
D-Day
Tee Time
```

Hero 안에는 기능 버튼을 넣지 않는다.  
버튼은 Gogo Caddie Card 또는 Round Ticket에서 제공한다.

---

## 9. Card System

### Stat Card
- Radius: 24
- Height: 150~170
- 숫자는 크게
- 보조 설명은 짧게
- 가능하면 작은 그래프 또는 아이콘 표시

### Gogo Caddie Card
- 캐릭터가 반드시 포함된다.
- 메시지는 짧고 따뜻해야 한다.
- 버튼은 하나만 둔다.

### Round Ticket
- 예정 라운드의 핵심 정보를 보여준다.
- 골프장명, 날짜, Tee Time, 참가 인원, 날씨를 포함한다.
- Course Map, 조편성, Lotto 버튼을 제공한다.

---

## 10. Icon System

아이콘은 한 가지 스타일만 사용한다.

추천:
- `Lucide`
- 또는 `Material Symbols Rounded`

혼용하지 않는다.

---

## 11. Animation

애니메이션은 과하지 않게 사용한다.

| Motion | Duration |
|---|---:|
| Fade | 250ms |
| Slide Up | 350ms |
| Button Press | 120ms |
| Hero Transition | 500ms |

---

## 12. Home Layout

Home V2 기본 구조:

```text
Top Bar
Hero Section
Gogo Caddie Card
Stats Cards
Upcoming Round Ticket
Quick Actions
Bottom Navigation
```

Hero는 화면 첫인상의 70%를 담당한다.

---

## 13. Design Do / Don't

### Do
- 골프장에 도착한 느낌을 준다.
- 카드와 여백을 충분히 사용한다.
- 문장은 짧고 따뜻하게 쓴다.
- 초록색을 기본으로 하되 노란색으로 포인트를 준다.

### Don't
- Hero에 버튼을 많이 넣지 않는다.
- 텍스트를 과하게 넣지 않는다.
- 화면을 기능 목록처럼 만들지 않는다.
- 기존 앱처럼 단순 메뉴형 홈을 만들지 않는다.
