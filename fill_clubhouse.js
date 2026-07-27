/**
 * 골프장 클럽하우스 좌표/주소 채우기 스크립트
 *
 * 사용법:
 *   1) 카카오 개발자 콘솔에서 "REST API 키" 발급 (JavaScript 키 아님!)
 *   2) 환경변수로 키 지정 후 실행:
 *        Windows(PowerShell):  $env:KAKAO_REST_API_KEY="발급받은키"; node fill_clubhouse.js
 *        Windows(cmd):         set KAKAO_REST_API_KEY=발급받은키 && node fill_clubhouse.js
 *        Mac/Linux:            KAKAO_REST_API_KEY=발급받은키 node fill_clubhouse.js
 *   3) Node 18+ 필요 (내장 fetch 사용). node -v 로 확인.
 *
 * 결과물:
 *   - update_clubhouse.sql : 찾은 골프장에 대한 UPDATE 문
 *   - not_found.csv        : 검색 실패했거나 확인이 필요한 골프장 목록 (수동 확인용)
 *   - result_log.json      : 카카오 API 원본 응답 로그 (디버깅/검증용)
 */

const fs = require("fs");
const path = require("path");

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
if (!KAKAO_KEY) {
  console.error("환경변수 KAKAO_REST_API_KEY 가 설정되지 않았습니다.");
  process.exit(1);
}

// ── 입력 데이터: NULL인 golf courses만 여기 넣었습니다 (id, name, region 기준으로 검색) ──
const courses = [
  { id: "25fedbec-f43b-4072-b2ba-b74a2e59ad43", name: "가야 CC", region: "경남 김해시" },
  { id: "d98d9ce9-604f-458f-9ee1-7f8c54cbb98f", name: "거제뷰 CC", region: "경남 거제" },
  { id: "2d525d18-9475-4791-827e-774e28182a1b", name: "경산 CC", region: "경북 경산시" },
  { id: "dc83ca87-b314-45c9-b5b9-9a375db0b281", name: "경주 CC", region: "경북 경주시" },
  { id: "afd6db2b-b5c3-4f7a-9a3d-0ba3cc912888", name: "고성 CC", region: "경남 고성" },
  { id: "02b8cf4e-e607-438a-9d38-c363f1792948", name: "골프존카운티 감포", region: "경북 경주시" },
  { id: "88a84fe4-cf14-48d5-8b28-b7e2ffd52baf", name: "골프존카운티 경남", region: "경남 함안군" },
  { id: "5d9384b9-c613-4246-8baf-93b3cb944b1c", name: "골프존카운티 구미", region: "경북 구미시" },
  { id: "e70b6d1e-f621-4646-8cd2-42ce4a423783", name: "골프존카운티 더골프", region: "울산 울주군" },
  { id: "ab13a806-95eb-431b-b23d-98efbf46b21f", name: "골프존카운티 사천", region: "경남 사천시" },
  { id: "7daddd5a-2134-47b2-8dc4-92feeefd7fc5", name: "골프존카운티 선산", region: "경북 구미시" },
  { id: "34e1ed97-dc4c-4263-9eb8-7897901e3515", name: "구미 CC", region: "경북 구미시" },
  { id: "591e11a4-d86d-4e2f-9069-7c41025c6f7a", name: "동래베네스트 GC", region: "부산 금정구" },
  { id: "4b2116b2-88d9-4120-a5b9-b98b22096b47", name: "동부산 CC", region: "부산 기장군" },
  { id: "14bfd8db-eab5-4373-b5ff-4dd399f4efae", name: "문경 CC", region: "경북 문경" },
  { id: "56c3b1d4-2529-4047-923f-764b0db5de61", name: "밀양리더스 CC", region: "경남 밀양" },
  { id: "7adb61ff-fe63-433f-9425-022709fedfb4", name: "보문 CC", region: "경북 경주시" },
  { id: "e1704f24-9c51-4b9a-a759-38cb6444aac2", name: "부곡 CC", region: "경남 창녕" },
  { id: "6127185a-581e-4b3d-bcea-3e7d0bdc6a29", name: "부산 CC", region: "부산 금정" },
  { id: "dc33b049-4a55-4c0c-868a-941592b0dc61", name: "강동디아너스CC", region: "경북 경주시" }, // 舊 블루원리조트 CC (2024년 강동그룹 인수 후 개명)
  { id: "ff46a24f-7378-4ea8-b4af-1b098c3d3ab5", name: "블루원상주 CC", region: "경북 상주" },
  { id: "113cdb2b-53ab-4611-8f93-166faa541fdb", name: "사우스케이프 CC", region: "경남 남해" },
  { id: "fea707bb-d586-4477-bdc0-d1831e379b86", name: "서라벌 CC", region: "경북 경주시" },
  { id: "ed286cf5-836d-481b-a4f7-22b03e399338", name: "아난티남해 CC", region: "경남 남해" },
  { id: "f79744a8-0493-4335-97ca-7db749f36621", name: "아델스코트 CC", region: "경남 합천" },
  { id: "bb8c8f49-d3b3-4bc3-b3a1-31a4a64d4581", name: "아시아드 CC", region: "부산 기장군 일광읍" }, // 기존 region(부산 북구)이 실제 소재지와 달라서 검색 실패했던 항목
  { id: "8173d90a-e636-482a-aedd-0a862fa96021", name: "안동 CC", region: "경북 안동시" },
  { id: "f9c9daaf-ce96-4a5d-9816-4899ff4edd9d", name: "양산 CC", region: "경남 양산시" },
  { id: "b04866d8-e383-4821-aba7-f64a85595a90", name: "양산동원로얄 CC", region: "경남 양산시" },
  { id: "4e5ebb15-f0e6-4456-a503-e115292a4e9c", name: "영천 CC", region: "경북 영천시" },
  { id: "83b10e5e-0c9b-4c28-8c33-7c77620d904b", name: "진주 CC", region: "경남 진주" },
  { id: "d30638b4-bfb2-4d36-b49a-72e846d6c645", name: "진해신항 CC", region: "경남 창원시 진해구" },
  { id: "0bf001c0-8867-4e92-8543-6819a2c51ed1", name: "창원 CC", region: "경남 창원" },
  { id: "98b7ae2f-204f-4829-a209-75eb87ed56d4", name: "청도그레이스 CC", region: "경북 청도" },
  { id: "a0618a0d-cf85-44ec-bc42-78c7d76f66b1", name: "통도파인이스트 CC", region: "경남 양산시" },
  { id: "97ee84f7-61b4-44a2-89c9-fc41dd8e8c4b", name: "통영동원로얄 CC", region: "경남 통영시" },
  { id: "6ec665d8-5806-485e-a71e-590e0ca201bb", name: "포웰 CC", region: "경남 김해시" },
  { id: "7baae377-0c29-45d4-b309-3821e91410c1", name: "포항 CC", region: "경북 포항시" },
  { id: "a36e71f0-c46a-437b-b72e-fc523bbbd108", name: "해운대 CC", region: "부산 기장군" },
  { id: "022c982b-b143-4189-88bc-8b728471d9fe", name: "힐마루 CC", region: "경남 창녕군" },
  { id: "1b4074ef-716e-4468-bedf-b2edacafbf1b", name: "힐스카이 CC", region: "경북 경주" },
];
// 43cb77ce...(골프존카운티 이든)는 이미 값이 채워져 있어서 목록에서 제외했습니다.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function kakaoKeywordSearch(query) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
    query
  )}&size=5`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Kakao API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// 카카오 결과 중 실제 골프장/CC 후보를 우선 선택
function pickBestResult(name, json) {
  const docs = json.documents || [];
  if (docs.length === 0) return null;

  // 카테고리에 골프가 들어가거나, 장소명에 CC/GC/컨트리클럽/골프장 등이 들어간 것 우선
  const golfLike = docs.find(
    (d) =>
      (d.category_name && d.category_name.includes("골프")) ||
      /CC|GC|컨트리|골프/i.test(d.place_name)
  );
  return golfLike || docs[0];
}

async function main() {
  const sqlLines = [];
  const notFound = [];
  const rawLog = [];

  for (const course of courses) {
    const query = `${course.name} ${course.region}`;
    try {
      const json = await kakaoKeywordSearch(query);
      rawLog.push({ query, response: json });

      const best = pickBestResult(course.name, json);
      if (!best) {
        notFound.push({ ...course, reason: "검색결과 없음" });
        console.log(`[없음] ${course.name}`);
        await sleep(150);
        continue;
      }

      const lat = best.y; // 카카오는 y=위도, x=경도
      const lng = best.x;
      const placeName = best.place_name;
      const address = best.road_address_name || best.address_name;

      sqlLines.push(
        `UPDATE golf_courses SET clubhouse_latitude = ${lat}, clubhouse_longitude = ${lng}, navigation_name = '${placeName.replace(
          /'/g,
          "''"
        )}', navigation_address = '${address.replace(
          /'/g,
          "''"
        )}' WHERE id = '${course.id}'; -- ${course.name}`
      );
      console.log(`[찾음] ${course.name} -> ${placeName} (${address})`);
    } catch (e) {
      notFound.push({ ...course, reason: e.message });
      console.log(`[에러] ${course.name}: ${e.message}`);
    }
    await sleep(150); // 카카오 API rate limit 보호
  }

  fs.writeFileSync(
    path.join(__dirname, "update_clubhouse.sql"),
    sqlLines.join("\n") + "\n",
    "utf8"
  );

  fs.writeFileSync(
    path.join(__dirname, "not_found.csv"),
    "id,name,region,reason\n" +
      notFound
        .map((n) => `${n.id},${n.name},${n.region},${n.reason}`)
        .join("\n") +
      "\n",
    "utf8"
  );

  fs.writeFileSync(
    path.join(__dirname, "result_log.json"),
    JSON.stringify(rawLog, null, 2),
    "utf8"
  );

  console.log(
    `\n완료: ${sqlLines.length}개 성공, ${notFound.length}개 확인 필요 (not_found.csv 참고)`
  );
}

main();
