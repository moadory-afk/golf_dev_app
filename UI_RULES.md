# UI_RULES - Home v3.9 Premium Polish

## Home Structure

Home은 기능 목록이 아니다.
Home은 오늘 라운드를 준비하는 Dashboard다.

최종 구조:

```text
Header
Hero
Gogo Concierge
Stats 4
Bottom Navigation
```

## Header

Header에는 아래 3개만 둔다.

- 클럽 선택
- 공지
- 프로필

Greeting은 Header에 두지 않는다.

## Hero

Hero는 라운드 판단 정보를 담당한다.

반드시 유지할 정보:

- 날짜
- Tee Off
- 인원
- 날씨
- 풍속
- 예상 소요시간
- 출발 추천시간

## Concierge

Concierge는 사용자와 대화하는 카드다.

포함:

- Greeting
- 오늘 라운드 안내
- AI 캐디북 / 조편성 / Lotto
- AI 한줄 코멘트

제외:

- 교통상황 상세 블록
- 날씨/풍속/티오프/소요시간 4칸 반복 정보

## Stats

Stats는 한 줄 숫자 중심이다.

- HCP
- AVG
- LAST
- BEST

## Visual Rules

- 글자가 잘리는 UI는 실패로 본다.
- 카드 내부의 카드 중첩은 최소화한다.
- 초록색은 강조에만 쓴다.
- Home은 스크롤 없는 Dashboard를 목표로 한다.


# UI_RULES - Home v3.10 Addendum

## Home No Scroll Rule
- Home 첫 화면은 Header, Hero, Concierge, Stats가 동시에 보이는 것을 우선한다.
- 카드가 예뻐도 기록 카드가 보이지 않으면 실패로 본다.
- Concierge는 Hero보다 작아야 한다.

## Compact Rule
- Home의 텍스트는 1~2줄 이내로 제한한다.
- 액션 버튼은 3개 이하로 유지한다.
- 중복 정보는 제거한다.
