# Hero_DB_Standard.md

## 이미지 저장 구조

courses/{course}/ - hero/original.png - hero/hero_1920.webp -
hero/hero_1280.webp - hero/thumb.webp - metadata.json - insert.sql

## metadata.json

``` json
{
  "course_name":"",
  "season":"summer",
  "weather":"sunny",
  "time":"morning",
  "style":"photorealistic",
  "resolution":"3840x2160",
  "aspect_ratio":"16:9",
  "prompt_version":"v1.0"
}
```

## DB 권장 테이블

course_hero_images

-   id
-   course_id
-   season
-   weather
-   time_of_day
-   style
-   image_url
-   thumbnail_url
-   width
-   height
-   latitude
-   longitude
-   prompt_version
-   created_at
-   updated_at

## 원칙

-   Hero는 계절/날씨별 버전 관리
-   WebP 배포
-   PNG 원본 보관
-   metadata와 이미지 버전 동기화
