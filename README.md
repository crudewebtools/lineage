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
- **엣지 두 종류** — **실선(`keep`)** 은 값이 그대로 유지됨, **점선(`transform`)** 은 가공됨(trim·포맷 변경·다른 필드 생성의 입력 등). 우상단 `새 엣지` 토글로 그릴 종류를 고르고, 기존 엣지는 **클릭하면 컨텍스트 메뉴**(라벨 수정 · 타입 변경 · 삭제)가 열린다.
- **매핑은 별도 목록** — 엔티티 정의와 분리된 `FieldMapping[]` 로 관리하고 엣지로 변환합니다.
- **엔티티 = 표 노드** — 헤더(종류 아이콘 + 이름 + 종류 라벨)와 필드 행으로 구성. HTML `<table>` 태그를 강제하지 않습니다.
- **깊이 = 들여쓰기** — `children` 을 가진 중첩 필드는 depth 에 비례해 indent.
- **object 접기** — `object`·`object[]` 필드를 클릭하면 하위 필드를 접을 수 있습니다. 접힌 컨테이너 하위로 오가던 엣지는 컨테이너로 **롤업되어 점선**으로 표시됩니다(도착지가 접히면 화살표가 컨테이너로 들어가고, 출발지가 접히면 컨테이너에서 나옵니다). 원본 매핑은 보존되어 펼치면 복원됩니다.
- **오른쪽 패널 (도구 허브)** — `엔터티`(추가·수정)와 `코드` 두 도구. **코드**는 그래프 전체를 JSON 으로 편집하며, **적용 버튼을 눌러야 반영**되고 반영 전에 구조·종류·엔티티/필드 참조를 검증합니다(실시간 아님).
- **URL 공유** — 테이블·엣지 구조가 바뀌면 URL 해시(`#g=...`)에 실립니다. **키 없는 튜플로 패킹**(enum 인덱스 + 비트플래그)한 뒤 **lz-string 으로 압축**해 URL 을 최대한 짧게 만듭니다(샘플 기준 raw JSON 대비 ~1/3). URL 을 복사해 붙여넣으면 같은 테이블·엣지가 재현됩니다. 노드 **위치·접힘 상태는 제외**(공유 시 재현 불필요)하므로 드래그·접기로는 URL 이 바뀌지 않고, 로드 시 위치는 자동 배치됩니다.

## 기술 스택

| 분류 | 사용 기술 |
|------|-----------|
| 프레임워크 | React 19 + TypeScript |
| 빌드 도구 | Vite 8 |
| 캔버스 | React Flow (`@xyflow/react` v12) |
| 스타일 | Tailwind CSS v4 (`@tailwindcss/vite`) |
| UI 컴포넌트 | shadcn/ui (new-york / neutral, Radix UI, lucide-react) |
| URL 상태 | lz-string (해시 압축 공유) |

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
├─ App.tsx                # <Flow /> 렌더
├─ index.css              # Tailwind v4 import + shadcn 테마 토큰
├─ flow/
│  ├─ Flow.tsx               # 캔버스 + 오른쪽 패널 레이아웃, 상태·연동
│  ├─ EntityNode.tsx         # 표 형태 노드 (리프별 좌/우 핸들, object 접기 가능)
│  ├─ entity-node-context.ts # 노드 → 캔버스 접기 토글 통로 (context)
│  ├─ SidePanel.tsx          # 오른쪽 도구 허브 (엔터티 / 코드)
│  ├─ EntityEditor.tsx       # 엔티티 추가·수정 폼
│  ├─ CodeEditor.tsx         # 전체 JSON 편집·검증·적용
│  ├─ code.ts                # 그래프 ↔ JSON 변환 + 검증
│  ├─ share.ts               # 그래프 ↔ URL 해시 (튜플 패킹 + lz-string 압축)
│  ├─ EdgeKindControl.tsx    # 새 엣지 종류(유지/가공) 토글
│  ├─ EdgeContextMenu.tsx    # 엣지 클릭 메뉴 (라벨 수정·타입 변경·삭제)
│  ├─ entity-kind.tsx        # 엔티티 종류별 아이콘·라벨 (노드·패널 공용)
│  ├─ edge-kind.ts           # 엣지 종류 → 시각 속성(실선/점선)
│  ├─ collapse.ts            # 접힌 컨테이너로 엣지 롤업(점선)
│  ├─ sample-data.ts         # 샘플 엔티티 + 필드 매핑
│  └─ types.ts               # 데이터 모델 (EntityData, Field, FieldMapping, MappingKind)
├─ components/ui/         # shadcn 컴포넌트 (badge, button)
└─ lib/
   └─ utils.ts            # cn() className 헬퍼
```

## 데이터 모델

[`src/flow/types.ts`](src/flow/types.ts) 에 정의되어 있습니다.

```ts
type Field = {
  name: string
  type: 'uuid' | 'string' | 'number' | 'boolean' | 'timestamp' | 'object' | 'json'
  array?: boolean      // 배열이면 타입 옆에 [] 로 표기. 예: object[] , string[]
  nullable?: boolean   // 타입 옆에 ? 로 표기
  pk?: boolean         // primary key (🔑 표시)
  children?: Field[]   // 중첩 필드 → indent. 핸들 경로는 부모.자식 으로 이어짐
}

type EntityData = {
  name: string
  kind: 'event' | 'api' | 'db' | 'etc'  // kafka 이벤트 / API 응답 / DB / 기타(DTO 등)
  fields: Field[]
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
}
```

엔티티와 매핑은 [`src/flow/sample-data.ts`](src/flow/sample-data.ts) 에서 정의합니다. 매핑 예시:

```ts
// 값 유지(실선): CustomerApi.address.city → FulfillmentRequest.customer.city
{ id: 'm5', source: 'customerApi', sourceField: 'address.city',
  target: 'fulfillment', targetField: 'customer.city' },

// 가공(점선): CustomerApi.email → FulfillmentRequest.customer.email
{ id: 'm4', source: 'customerApi', sourceField: 'email',
  target: 'fulfillment', targetField: 'customer.email', kind: 'transform' }
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
- [ ] 필드·엣지 클릭 시 연결된 lineage 하이라이트
- [x] 전체 JSON 코드로 편집·검증·적용 (오른쪽 `코드` 패널)
- [ ] 외부 스키마(OpenAPI/JSON Schema 등) 임포트 → 엔티티 자동 생성
- [ ] 다크 모드 토글 (테마 토큰은 이미 준비됨)
```
