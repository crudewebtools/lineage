# lineage

**필드 단위 데이터 lineage(흐름)** 를 시각화하는 앱입니다. 여러 데이터 소스의 **어떤 필드**가 다른 엔티티의 **어떤 필드**로 연동되는지를 그래프(엣지)로 보여줍니다. 각 엔티티는 **표 형태 노드**로 그리고, 중첩이 깊은 필드는 **들여쓰기(indent)** 로 표현합니다.

> [React Flow](https://reactflow.dev) 기반의 인터랙티브 캔버스로, 필드의 핸들을 끌어 새 매핑을 만들 수 있습니다.

## 대표 사용 사례

한 시스템(특히 Spring 웹 백엔드)의 DTO/데이터 처리 흐름을 그대로 그래프로 표현합니다.

1. **Kafka**에서 이벤트를 수신 (이벤트 구조 = 엔티티)
2. 그 정보로 **API 조회** (응답값 = 엔티티)
3. **DB 조회**로 데이터 획득 (= 엔티티)
4. 각 정보를 조합해 **외부 시스템으로 전송** (최종 엔티티)

최종 엔티티는 소스들의 **조합이지만 슈퍼셋은 아닙니다**(필요한 필드만 골라 옴). 각 소스의 어떤 필드가 최종 엔티티의 어떤 필드를 채우는지, 그리고 값이 그대로인지 가공됐는지를 엣지로 나타냅니다.

## 주요 컨셉

- **필드 ↔ 필드 매핑 (핵심)** — 엣지가 `엔티티A.필드x → 엔티티B.필드y` 단위입니다. **리프(말단) 필드 행만** 좌(도착)·우(출발) 핸들을 갖고, `object`·`object[]` 같은 컨테이너 필드는 핸들을 노출하지 않아 연결할 수 없습니다(컨테이너끼리 잇는 대신 리프 단위로 매핑). 핸들 id 는 **점(.)으로 구분한 필드 경로**(중첩 포함, 예: `address.city`)입니다.
- **엣지 두 종류** — **실선(`keep`)** 은 값이 그대로 유지됨, **점선(`transform`)** 은 가공됨(trim·포맷 변경·다른 필드 생성의 입력 등). 우하단 `새 엣지` 토글로 그릴 종류를 고르고, 기존 엣지는 **클릭하면 컨텍스트 메뉴**(라벨 수정 · 타입 변경 · 삭제)가 열린다.
- **매핑은 별도 목록** — 엔티티 정의와 분리된 `FieldMapping[]` 로 관리하고 엣지로 변환합니다.
- **엔티티 = 표 노드** — 헤더(종류 아이콘 + 이름 + 종류 라벨)와 필드 행으로 구성. HTML `<table>` 태그를 강제하지 않습니다.
- **변환/프로세스 노드** — 입력을 받아 (외부 API·가공·집계 등) **다른 출력**을 내는 노드. 왼쪽 `input`(받기만, target 핸들)과 오른쪽 `output`(내보내기만, source 핸들)으로 나뉘고, 내부는 **블랙박스**(input↔output 매핑은 그리지 않으므로 lineage 하이라이트도 노드를 통과하지 않음). 핸들 경로는 `in.<>`·`out.<>`, 종류는 엔티티처럼 고를 수 있습니다.
- **깊이 = 들여쓰기** — `children` 을 가진 중첩 필드는 depth 에 비례해 indent.
- **입력 변형 (discriminated union)** — **엔터티 내부** 개념입니다: 같은 엔터티의 특정 필드(`discriminator`) 값에 따라 **그 엔터티의 다른 필드**가 "있는지"가 갈립니다(예: 주문 이벤트가 `type=CREATED` 면 주문자 정보 포함, `type=CANCELED` 면 없음). 필드에 `discriminator: true` + `enumValues` 를 주면 분기 기준이 되고(🜨 분기 아이콘), 한 엔터티에 **여러 개** 둘 수 있습니다. 다른 필드에는 `when: [{ disc: '노드id::경로', values: ['A'] }]` 절 배열을 달면 조건부로 존재합니다 — `disc` 는 반드시 **같은 엔터티의 discriminator** 여야 하고(자기 자신 참조는 불가, 검증에서 강제), **절 사이는 AND, `values` 안은 OR** 이라 "status=CANCELED 이면서 channel=APP 일 때만" 같은 조합도 표현됩니다(`when` 없으면 모든 변형 공통). 각 필드는 자기 `when` 값을 **(discriminator, 값)마다 다른 색의 배지**로 달고(색 팔레트는 엔터티마다 초기화 — 모달 팝오버와 캔버스가 같은 색), AND 절 사이는 `&` 로 잇습니다. **좌상단 셀렉터**(접이식·스크롤)에서 discriminator 마다 값을 고르거나 **캔버스의 배지를 클릭**하면 그 변형으로 전환되고, 변형에 없는 필드는 **숨기지 않고 흐리게(dim)** 처리됩니다(전체 구조를 그대로 두고 비교). **엣지에는 when 이 없습니다** — 조건부 필드에 걸린 엣지는 끝 필드가 흐려질 때 자동으로 함께 흐려지고, 그때 **라벨을 감추고 클릭도 막아** 헷갈리지 않게 합니다. `object` 컨테이너에 `when` 을 달면 하위까지 통째로 흐려집니다. `nullable`(값이 빌 수 있음)과 달리 **존재 자체가 조건부**임을 명확히 보여줍니다. 입력 변형은 **엔티티 전용**입니다 — 프로세스 필드의 `discriminator`/`when` 과 매핑의 `when` 은 코드 패널 적용 시 거부됩니다. `discriminator` 와 `enumValues` 는 **상호 필수**이고 값은 비어있지 않은 고유 문자열이어야 합니다. 합성 키(`노드id::경로` 등)가 안전하도록 **노드 id 는 영문·숫자·`_`·`-` 만**, **필드명에는 `.` 과 `:` 금지**입니다. 검증은 두 모드로 나뉩니다: **코드 패널 적용은 strict**(위 규칙 위반과 dangling `disc`·enum 에 없는 값·같은 disc 절 중복을 에러로 안내), **저장본·공유 URL 로드는 lenient**(dangling 절·효과 없는 변형 설정은 조용히 제거하고, 중복 절은 의미가 바뀌지 않게 그대로 통과 — 정상 편집으로 만든 페이지가 검증 실패로 잠기지 않습니다). 모달에서 **필드 이름을 바꾸면** 이를 참조하던 `when.disc`·엣지 핸들·접힘 상태·셀렉터 선택이 **함께 갱신**됩니다.
- **object 접기** — `object`·`object[]` 필드를 클릭하면 하위 필드를 접을 수 있습니다. 접힌 컨테이너 하위로 오가던 엣지는 컨테이너로 **롤업되어 점선**으로 표시됩니다(도착지가 접히면 화살표가 컨테이너로 들어가고, 출발지가 접히면 컨테이너에서 나옵니다). 원본 매핑은 보존되어 펼치면 복원됩니다.
- **호버 하이라이트** — 필드에 마우스를 올리면 그 필드(볼드)와 연결된 엣지(진하게·굵게), 그리고 엣지 너머로 이어지는 필드들이 **끝까지(연결 컴포넌트 전체)** 강조됩니다. 양방향으로 전파되어 해당 필드의 lineage 전체가 한눈에 보입니다. 펼친 `object` 는 하위 리프를 직접 호버하면 되므로 강조하지 않고, **접힌 `object`** 를 호버하면 숨겨진 하위 전체의 lineage(롤업 엣지 포함)를 한꺼번에 강조합니다. **숨긴 노드에 걸린 엣지는 전파에서 제외**되어, 숨긴 노드를 거쳐 강조가 새어 나가지 않습니다.
- **노드 표시/숨김 (우상단 패널)** — 노드(엔터티/프로세스) 목록에서 눈 아이콘으로 개별 노드를 숨기거나 다시 보이게 합니다. 숨겨도 **데이터·위치는 보존**되고 화면에서만 가려지며(연결 엣지도 함께 사라짐), `모두 보이기` 로 한 번에 복원합니다. 목록 헤더로 패널을 접을 수 있습니다.
- **엔터티 생성/수정/삭제 (모달)** — 캔버스 **우하단 `+ 엔터티`** 버튼으로 새 엔터티를, 노드 헤더의 **✏️** 로 기존 엔터티를 **모달**에서 편집합니다. 이름·종류와 함께 필드를 추가/수정/삭제하고, `object` 타입은 **내부에 하위 필드를 추가**(깊이 무제한)하거나 **접을 수 있으며**, 행 왼쪽 **손잡이(⠿)를 드래그**해 순서를 바꿉니다(dnd-kit). 재배치는 **같은 부모(형제) 안에서만** 되고, 펼친 `object` 는 펼친 모습 그대로 통째로 이동합니다. 순서가 바뀌면 노드 핸들을 재측정해 **엣지 끝점도 따라옵니다**. 변형(`discriminator`/`when`)은 필드행의 **분기 아이콘(⑂) 팝오버**에서 설정합니다 — 분기 기준 토글 + 값 칩 입력, when 은 자기 엔터티 discriminator 별 값 토글(자기 자신은 조건으로 선택 불가). 필드 **이름을 바꾸면** 이를 참조하던 매핑·when 조건이 따라오며, 필드를 **삭제하거나 object 로 바꾸면** 그 필드에 걸린 엣지는 무효가 되므로 **함께 제거**됩니다. 수정 모달 왼쪽 아래의 **삭제 버튼**으로 노드를 지울 수 있고(실수 방지를 위해 한 번 더 눌러 확정하는 2단계), **연결된 엣지도 함께 삭제**됩니다.
- **프로세스 생성/수정/삭제 (모달)** — 우하단 **`+ 프로세스`** 버튼/노드 헤더 **✏️** 로 변환·프로세스 노드를 편집합니다. `input`(받기)·`output`(내보내기) 두 리스트를 나란히 구성하며, 핸들 경로가 한 단계(`in.<>`/`out.<>`)라 **중첩은 두지 않습니다**(플랫). 필드 에디터([`FieldTreeEditor`](src/flow/FieldTreeEditor.tsx))는 엔터티 모달과 **공유**하고 `nested` 플래그로 중첩 허용 여부만 가릅니다. 삭제 버튼(2단계 확인)도 엔터티 모달과 동일합니다.
- **오른쪽 패널 (도구 허브)** — `코드` 도구. 그래프 전체를 JSON 으로 편집하며, **적용 버튼을 눌러야 반영**되고 반영 전에 구조·종류·엔티티/필드 참조를 검증합니다(실시간 아님). (엔터티 추가·수정은 위 모달로 분리됨)
- **URL 공유 (링크 복사)** — 사이드 패널 헤더의 **🔗 링크 복사** 버튼을 누르면 현재 그래프(엔티티·프로세스 노드·엣지)를 담은 **`?g=...` 쿼리 포함 풀 URL** 이 클립보드에 복사됩니다. **키 없는 튜플로 패킹**(enum 인덱스 + 비트플래그)한 뒤 **lz-string 으로 압축**해 URL 을 최대한 짧게 만듭니다(샘플 기준 raw JSON 대비 ~1/3). 그 URL 을 열면 항상 **`가져온 페이지` 라는 새 페이지로 추가**되어 기존 페이지를 덮지 않고, 반영 직후 **쿼리는 주소에서 자동 제거**됩니다. 평소 편집으로는 URL 이 바뀌지 않아 주소가 깨끗하게 유지되고, 노드 **위치·접힘 상태는 제외**하므로 로드 시 위치는 자동 배치됩니다.
- **페이지 (왼쪽 사이드바)** — 그래프 하나가 페이지 하나입니다. 사이드바에서 페이지를 **추가·이름 변경·삭제·전환**하고(접기 가능), 마지막 하나를 지우면 빈 페이지가 자동 생성됩니다. 그래프는 편집할 때마다 **IndexedDB 에 디바운스 자동저장**되고(코드 패널과 같은 `CodeDoc` 포맷), 마지막으로 열었던 페이지를 기억해 다음 방문 때 이어서 봅니다. IndexedDB 를 못 쓰는 환경은 **메모리 전용 모드**로 동작하고(배너 안내), 쓰기 실패분은 다음 편집·페이지 전환 때 재시도합니다. 저장본이 검증에 실패하면 그래프 대신 **안내 화면**을 띄워 원본을 보존한 채 JSON 복사·초기화를 선택하게 합니다.

## 기술 스택

| 분류 | 사용 기술 |
|------|-----------|
| 프레임워크 | React 19 + TypeScript |
| 빌드 도구 | Vite 8 |
| 캔버스 | React Flow (`@xyflow/react` v12) |
| 스타일 | Tailwind CSS v4 (`@tailwindcss/vite`) |
| UI 컴포넌트 | shadcn/ui (new-york / neutral, Radix UI(`radix-ui`), lucide-react) · 엔터티 편집은 Dialog 모달 |
| 드래그앤드롭 | dnd-kit (`@dnd-kit/core`·`sortable`·`utilities`) — 모달 필드 순서 변경 |
| URL 상태 | lz-string (링크 복사 시 `?g=` 쿼리 압축) |
| 로컬 저장 | IndexedDB (`idb`) — 페이지별 그래프 자동저장 (+ localStorage 에 마지막 페이지 id) |

## 시작하기

요구사항: **Node.js 20.19+** (Vite 8 기준)

```bash
npm install      # 의존성 설치
npm run dev      # 개발 서버 → http://localhost:5173
```

### npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 실행 (HMR) |
| `npm run build` | 타입 체크(`tsc -b`) 후 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 로컬 미리보기 |
| `npm run lint` | ESLint 검사 |

## 프로젝트 구조

```
src/
├─ main.tsx               # 앱 부트스트랩
├─ App.tsx                # 페이지 로드/저장 연결 + <Flow /> 렌더 (저장소 배너 · 깨진 저장본 분기)
├─ index.css              # Tailwind v4 import + shadcn 테마 토큰
├─ flow/
│  ├─ Flow.tsx               # 캔버스 + 오른쪽 패널 레이아웃, 상태·연동
│  ├─ EntityNode.tsx         # 표 형태 노드 (리프별 좌/우 핸들, object 접기 가능)
│  ├─ ProcessNode.tsx        # 변환/프로세스 노드 (왼쪽 input / 오른쪽 output)
│  ├─ node-types.ts          # 노드 타입 정의 (EntityNodeType | ProcessNodeType = AppNode)
│  ├─ node-context.ts        # 노드 → 캔버스 접기·호버 통로 (context, 노드 공용)
│  ├─ SidePanel.tsx          # 오른쪽 도구 허브 (코드 · 링크 복사)
│  ├─ EntityDialog.tsx       # 엔터티 생성·수정·삭제 모달 (이름·종류 + 필드 트리)
│  ├─ ProcessDialog.tsx      # 프로세스 생성·수정·삭제 모달 (input/output 플랫 리스트)
│  ├─ FieldTreeEditor.tsx    # 재귀 필드 트리 에디터 (중첩 추가·접기·드래그 순서변경(dnd-kit), nested 플래그) — 모달 공용
│  ├─ VariantPopover.tsx     # 필드행 입력 변형 설정 팝오버 (discriminator 토글·값 칩 + when 토글)
│  ├─ WhenPicker.tsx         # when 편집 코어 — discriminator 별 값 토글 그룹 (그룹 안 OR·그룹 간 AND)
│  ├─ field-draft.ts         # 필드 초안(DraftField) ↔ Field 변환·트리 조작·검증 — when 은 행의 _k 로 참조(개명·이름 충돌에 안전), 저장 시 경로로 역번역
│  ├─ entity-util.ts         # 노드 id 슬러그·배치 헬퍼
│  ├─ CodeEditor.tsx         # 전체 JSON 편집·검증·적용
│  ├─ code.ts                # 그래프 ↔ JSON(CodeDoc) 변환 + 검증 — 코드 패널·페이지 저장 공용 포맷
│  ├─ share.ts               # 그래프 ↔ 공유 링크(?g= 쿼리) (튜플 패킹 + lz-string 압축)
│  ├─ EdgeKindControl.tsx    # 새 엣지 종류(유지/가공) 토글
│  ├─ EdgeContextMenu.tsx    # 엣지 클릭 메뉴 (라벨 수정·타입 변경·삭제, 하단 부족 시 커서 위로 flip)
│  ├─ NodeVisibilityPanel.tsx # 우상단 노드 표시/숨김 패널
│  ├─ VariantControl.tsx     # 좌상단 입력 변형 셀렉터 (접이식 헤더 + 스크롤 목록)
│  ├─ variant.ts             # discriminator 수집 · 변형별 dim 계산 · 값별 색 배정(엔터티별 팔레트)
│  ├─ entity-kind.tsx        # 엔티티 종류별 아이콘·라벨 (노드·패널 공용)
│  ├─ edge-kind.ts           # 엣지 종류 → 시각 속성(실선/점선)
│  ├─ collapse.ts            # 접힌 컨테이너로 엣지 롤업(점선)
│  ├─ highlight.ts           # 호버한 필드의 lineage(필드·엣지) closure 계산
│  ├─ sample-data.ts         # 샘플 엔티티 + 필드 매핑
│  └─ types.ts               # 데이터 모델 (EntityData, ProcessData, Field, FieldMapping, MappingKind 등)
├─ pages/
│  ├─ PageSidebar.tsx        # 왼쪽 페이지 목록 사이드바 (추가·이름 변경·삭제·전환, 접기)
│  ├─ use-pages.ts           # 페이지 생명주기 훅 (목록·현재 페이지·CRUD·디바운스 자동저장·실패 재시도)
│  ├─ db.ts                  # IndexedDB 저장소 (idb) — 페이지 레코드 CRUD + 마지막 페이지 기억
│  └─ InvalidPagePanel.tsx   # 검증 실패한 저장본 안내 화면 (원본 보존 · JSON 복사 · 초기화)
├─ components/ui/         # shadcn 컴포넌트 (badge, button, dialog, input, popover)
└─ lib/
   └─ utils.ts            # cn() className 헬퍼
```

## 데이터 모델

[`src/flow/types.ts`](src/flow/types.ts) 에 정의되어 있습니다.

```ts
// 입력 변형 조건 절 — disc("노드id::필드경로")가 가리키는 discriminator 의
// 현재 값이 values 중 하나면 성립(OR). 절 배열(When)은 절 사이 AND.
// disc 는 반드시 "자기 엔터티" 의 discriminator (엔터티 내부 변형).
type WhenClause = { disc: string; values: string[] }
type When = WhenClause[]

type Field = {
  name: string
  type: 'uuid' | 'string' | 'number' | 'boolean' | 'timestamp' | 'object' | 'json'
  array?: boolean      // 배열이면 타입 옆에 [] 로 표기. 예: object[] , string[]
  nullable?: boolean   // 타입 옆에 ? 로 표기
  pk?: boolean         // primary key (🔑 표시)
  children?: Field[]   // 중첩 필드 → indent. 핸들 경로는 부모.자식 으로 이어짐
  discriminator?: boolean  // 입력 변형의 분기 기준 필드 (값에 따라 다른 필드 유무가 갈림)
  enumValues?: string[]    // discriminator 일 때 고를 수 있는 값들 (예: ['NORMAL','CANCELED'])
  when?: When              // 모든 절이 성립할 때만(AND) 존재. 없으면 모든 변형 공통
}

type EntityData = {
  name: string
  kind: 'event' | 'api' | 'db' | 'etc'  // kafka 이벤트 / API 응답 / DB / 기타(DTO 등)
  fields: Field[]
  collapsed?: string[]  // 접힌 object 필드 경로들 (하위 숨김 + 엣지 롤업). 그래프 상태라 공유 URL 엔 제외
}

// 변환/프로세스 노드 — 입력을 받아 다른 출력을 내는 블랙박스.
// input 은 받기만(target), output 은 내보내기만(source). 핸들 경로는 in.<>/out.<>.
type ProcessData = {
  name: string
  kind: 'event' | 'api' | 'db' | 'etc'
  inputs: Field[]
  outputs: Field[]
}

// 엣지 종류: keep = 값 유지(실선), transform = 가공(점선)
type MappingKind = 'keep' | 'transform'

// ── 핵심: 필드 ↔ 필드 매핑 ──
type FieldMapping = {
  id: string
  source: string       // 출발 엔티티 id
  sourceField: string  // 출발 필드 경로 (예: 'address.city')
  target: string       // 도착 엔티티 id
  targetField: string  // 도착 필드 경로 (예: 'customer.city')
  kind?: MappingKind   // keep(실선, 기본) | transform(점선)
  label?: string       // 변환 메모 등 (선택)
  // 매핑에는 when 이 없다 — 조건부 필드에 걸린 엣지는 끝 필드를 따라 자동으로 흐려진다
}
```

엔티티와 매핑은 [`src/flow/sample-data.ts`](src/flow/sample-data.ts) 에서 정의합니다. 매핑 예시:

```ts
// 값 유지(실선): CustomerApi.address.city → FulfillmentRequest.customer.city
{ id: 'm7', source: 'customerApi', sourceField: 'address.city',
  target: 'fulfillment', targetField: 'customer.city' },

// 가공(점선): CustomerApi.email → FulfillmentRequest.customer.email
{ id: 'm6', source: 'customerApi', sourceField: 'email',
  target: 'fulfillment', targetField: 'customer.email',
  kind: 'transform', label: '소문자 정규화' }
```

`mappings` 배열은 그대로 React Flow 엣지로 변환됩니다(`sourceHandle`/`targetHandle` = 필드 경로). 따라서 `sourceField`/`targetField` 값은 노드 필드 행의 **핸들 id(= 필드 경로)와 정확히 일치**해야 하며, 중첩 필드는 `부모.자식` 경로로 지정합니다. 경로가 어긋나면 React Flow 가 "couldn't find handle" 경고를 냅니다. 그리고 `kind` 가 `transform` 이면 점선, 생략하거나 `keep` 이면 실선으로 렌더됩니다.

## 스타일 / UI

- **Tailwind CSS v4** — 별도 `tailwind.config.js` 없이 `@tailwindcss/vite` 플러그인으로 동작. 테마 토큰은 [`src/index.css`](src/index.css)에 정의.
- **shadcn/ui** — 컴포넌트는 프로젝트에 직접 복사되어 자유롭게 수정 가능. 새 컴포넌트 추가:

  ```bash
  npx shadcn@latest add dialog tooltip
  ```

- **경로 별칭** — `@/` 는 `src/` 를 가리킵니다. 예: `import { Badge } from '@/components/ui/badge'`

## 로드맵

- [ ] 패널 매핑 인식 — 엔티티/필드 선택 시 "어디로 / 어디서" 연동되는지 함께 표시
- [ ] 핸들 시각 정리 — 연결된 핸들만 강조하거나 호버 시에만 노출
- [ ] 가공(transform) 엣지에 변환 내용(메모) 표시 — 실선/점선 구분은 이미 적용됨
- [x] 입력 변형(discriminator/when) — 엔터티 내부 discriminated union. 좌상단 셀렉터로 변형 선택, 없는 필드와 그에 걸린 엣지 dim. when 은 `{ disc, values }` 절 배열로 AND/OR 조합 표현(disc 는 같은 엔터티의 discriminator 만), JSON 검증에 disc 소속·enum 값 검사 포함 (URL 공유까지 영속)
- [x] 엔터티·프로세스 생성·수정·삭제 모달 — 우하단 버튼/노드 ✏️, 공용 필드 트리 에디터(중첩 추가·접기·드래그 순서변경), 삭제는 2단계 확인
- [x] 노드 표시/숨김 — 우상단 패널에서 노드별 토글 (데이터 보존, 엣지·lineage 하이라이트도 함께 제외)
- [x] 페이지 관리 — 왼쪽 사이드바 + IndexedDB 자동저장 (페이지별 그래프, 마지막 페이지 기억)
- [x] 변형 편집 GUI — 엔터티 모달 필드행의 분기 아이콘(⑂) 팝오버에서 discriminator 토글 + enumValues 칩 + when 값 토글(자기 엔터티 discriminator 별 그룹, 그룹 안 OR·그룹 간 AND). UI 구조상 invalid 한 when 을 만들 수 없고, 모달 안에서는 when 이 행의 _k(정체성)를 참조해 개명·일시적 이름 충돌에도 안전 — 저장 시 최종 경로로 역번역하며 무효 참조 정리
- [x] when 배지 클릭 전환 — 캔버스 필드의 변형 배지를 클릭하면 그 (discriminator, 값) 변형으로 바로 전환 (좌상단 셀렉터까지 안 가도 됨)
- [x] 필드 호버 시 연결된 lineage 하이라이트 (양방향, 끝까지 전파)
- [x] 전체 JSON 코드로 편집·검증·적용 (오른쪽 `코드` 패널)
- [ ] 외부 스키마(OpenAPI/JSON Schema 등) 임포트 → 엔티티 자동 생성
- [ ] 다크 모드 토글 (테마 토큰은 이미 준비됨)
