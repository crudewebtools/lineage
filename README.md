# liner

데이터 엔티티 간의 **연결을 시각적으로 보여주는** 앱입니다. 각 데이터를 **표 형태 노드**로 그리고, 참조 관계를 연결선으로 잇습니다. 관계형(table)에 한정하지 않고 **NoSQL(collection/document)** 도 동일하게 다루며, 중첩이 깊은 필드는 **들여쓰기(indent)** 로 표현합니다.

> [React Flow](https://reactflow.dev) 기반의 인터랙티브 캔버스로, 노드를 드래그하거나 핸들을 끌어 새 연결을 만들 수 있습니다.

## 주요 컨셉

- **엔티티 = 표 노드** — 헤더(이름 + 종류)와 필드 행으로 구성. HTML `<table>` 태그를 강제하지 않습니다.
- **관계형 / NoSQL 통합 모델** — `table`, `collection`, `document` 종류를 하나의 데이터 구조로 표현.
- **깊이 = 들여쓰기** — `children`을 가진 중첩 필드는 depth에 비례해 indent.
- **필드 단위 연결** — 참조(FK) 필드 행에서 연결선이 출발해 대상 엔티티로 이어집니다.

## 기술 스택

| 분류 | 사용 기술 |
|------|-----------|
| 프레임워크 | React 19 + TypeScript |
| 빌드 도구 | Vite 8 |
| 캔버스 | React Flow (`@xyflow/react` v12) |
| 스타일 | Tailwind CSS v4 (`@tailwindcss/vite`) |
| UI 컴포넌트 | shadcn/ui (new-york / neutral, Radix UI, lucide-react) |

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
├─ main.tsx            # 앱 부트스트랩
├─ App.tsx             # <Flow /> 렌더
├─ index.css           # Tailwind v4 import + shadcn 테마 토큰
├─ flow/
│  ├─ Flow.tsx         # React Flow 캔버스 (노드·엣지·컨트롤 배선)
│  ├─ EntityNode.tsx   # 표 형태 커스텀 노드 (헤더 + 필드 행 + 핸들)
│  ├─ sample-data.ts   # 샘플 스키마 (초기 노드·엣지)
│  └─ types.ts         # 데이터 모델 (EntityData, Field)
├─ components/ui/      # shadcn 컴포넌트
│  └─ badge.tsx
└─ lib/
   └─ utils.ts         # cn() className 헬퍼
```

## 데이터 모델

노드 하나가 표현하는 엔티티의 모양은 [`src/flow/types.ts`](src/flow/types.ts)에 정의되어 있습니다.

```ts
type Field = {
  name: string
  type: 'uuid' | 'string' | 'number' | 'boolean' | 'timestamp' | 'object' | 'array' | 'json'
  nullable?: boolean   // 타입 옆에 ? 로 표기
  pk?: boolean         // primary key (🔑 표시)
  ref?: string         // 참조 대상 엔티티 id → 연결선의 출발 핸들
  children?: Field[]   // 중첩 필드 → depth 만큼 indent
}

type EntityData = {
  name: string
  kind: 'table' | 'collection' | 'document'
  fields: Field[]
}
```

엔티티를 노드로 추가하는 예시 ([`src/flow/sample-data.ts`](src/flow/sample-data.ts) 참고):

```ts
{
  id: 'users',
  type: 'entity',
  position: { x: 0, y: 0 },
  data: {
    name: 'users',
    kind: 'table',
    fields: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'email', type: 'string' },
      { name: 'created_at', type: 'timestamp' },
    ],
  },
}
```

`ref`이 지정된 필드는 자동으로 연결 핸들이 생기고, 해당 필드에서 대상 엔티티로 엣지를 연결할 수 있습니다.

## 스타일 / UI

- **Tailwind CSS v4** — 별도 `tailwind.config.js` 없이 `@tailwindcss/vite` 플러그인으로 동작. 테마 토큰은 [`src/index.css`](src/index.css)에 정의.
- **shadcn/ui** — 컴포넌트는 프로젝트에 직접 복사되어 자유롭게 수정 가능. 새 컴포넌트 추가:

  ```bash
  npx shadcn@latest add button card dialog
  ```

- **경로 별칭** — `@/` 는 `src/` 를 가리킵니다. 예: `import { Badge } from '@/components/ui/badge'`

## 로드맵

- [ ] 연결선 라우팅 개선 (floating edge로 대상 방향에 맞춰 핸들 자동 배치)
- [ ] 실제 데이터(JSON/스키마) 주입 및 파서
- [ ] 인터랙션 — 연결 엔티티 하이라이트, 중첩 필드 접기/펼치기
- [ ] 다크 모드 토글 (테마 토큰은 이미 준비됨)
