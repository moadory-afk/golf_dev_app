# Hero_Prompt_Template.md

## 목적

골프장 이름만 입력하면 Gemini에서 사용할 최종 Hero 생성 프롬프트를 자동
생성한다.

## 입력

-   골프장명
-   지역
-   국가
-   계절
-   시간대
-   날씨

## Workflow

1.  웹에서 실제 골프장 조사
2.  20\~100장의 실제 사진 분석
3.  대표홀 선정
4.  Hero 구도 선정
5.  이미지 생성

## 핵심 규칙

-   실제 골프장 기반
-   새로운 지형 창작 금지
-   실제 클럽하우스 유지
-   좌측 35% UI Safe Area 확보
-   3840x2160 / 16:9 / PNG

## 출력

-   hero_prompt.md
-   research.md
-   metadata.json
-   insert.sql
