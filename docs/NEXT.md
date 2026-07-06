# NEXT - Home Hero Full Bleed

## 다음 확인 필요
- iPhone 실기기/시뮬레이터에서 Hero 이미지가 상태바 영역부터 좌우 여백 없이 표시되는지 확인
- 상태바 글자 색상이 Hero 이미지 위에서 충분히 보이는지 확인
- Hero 아래 캐디 카드/통계 섹션은 기존 좌우 여백 20px이 유지되는지 확인

## 다음 개발 후보
1. Hero 상단 버튼의 대비를 이미지 밝기에 따라 자동 보정
2. StatusBar 스타일을 Home Hero에 맞게 light-content로 고정하는 구조 검토
3. Hero 하단 곡선 연결부를 full-bleed 기준으로 재정렬

## 주의
- DB 변경 없음
- Hero 외 Home 섹션의 좌우 여백은 LayoutRenderer에서 유지
