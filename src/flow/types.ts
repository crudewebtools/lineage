// 노드 하나가 표현하는 "데이터 엔티티"의 모양.
// 관계형/NoSQL 구분 없이 동일 구조로 표현하고, 중첩 필드(children)는 depth 만큼 indent.

export type FieldType =
  | 'uuid'
  | 'string'
  | 'number'
  | 'boolean'
  | 'timestamp'
  | 'object'
  | 'json'

export type Field = {
  name: string
  type: FieldType
  /** 배열 여부 (타입 옆에 [] 로 표기). 예: type 'object' + array → object[] */
  array?: boolean
  /** null 허용 여부 (타입 옆에 ? 로 표기) */
  nullable?: boolean
  /** primary key 여부 */
  pk?: boolean
  /** 중첩 필드 — depth 가 깊어지면 indent 된다 */
  children?: Field[]
  /**
   * 입력 변형(discriminated union)의 기준 필드.
   * 이 필드 값에 따라 같은 엔티티의 다른 필드 유무가 갈린다. enumValues 로 가능한 값을 준다.
   */
  discriminator?: boolean
  /** discriminator 일 때 고를 수 있는 값들 (예: ['NORMAL', 'CANCELED']) */
  enumValues?: string[]
  /**
   * 조건부 존재 — 활성 변형 값이 이 목록 중 하나일 때만 "있는" 필드.
   * 비우면(없으면) 모든 변형에 공통으로 존재한다. object 에 달면 하위까지 함께 사라진다.
   */
  when?: string[]
}

export type EntityKind = 'event' | 'api' | 'db' | 'etc'

export type EntityData = {
  name: string
  kind: EntityKind
  fields: Field[]
  /** 그래프에서 접힌 object 필드 경로들. 하위 필드를 숨기고, 그쪽으로 향하던 엣지는 컨테이너로 롤업한다. */
  collapsed?: string[]
}

// 입력을 받아 (외부 호출·가공 등) 다른 출력을 내는 "변환/프로세스" 노드.
// 내부는 블랙박스 — 왼쪽 input 은 받기만(target), 오른쪽 output 은 내보내기만(source).
// 핸들 경로는 inputs 는 `in.<경로>`, outputs 는 `out.<경로>` 로 구분한다.
export type ProcessData = {
  name: string
  kind: EntityKind
  inputs: Field[]
  outputs: Field[]
}

// 매핑 종류: keep = 값이 그대로 유지(실선), transform = 가공/입력으로 사용(점선)
export type MappingKind = 'keep' | 'transform'

// ── 핵심: 필드 ↔ 필드 매핑 ────────────────────────────────────────────
// 어떤 엔티티의 어떤 필드가 다른 엔티티의 어떤 필드로 연동되는지(데이터 lineage).
// field 는 중첩을 점(.)으로 구분한 경로다. 예: "address.city", "customer.id"
export type FieldMapping = {
  id: string
  source: string // 출발 엔티티 id
  sourceField: string // 출발 필드 경로
  target: string // 도착 엔티티 id
  targetField: string // 도착 필드 경로
  /** keep(실선)=값 유지, transform(점선)=가공. 기본 keep */
  kind?: MappingKind
  /** 변환 메모 등 (선택) */
  label?: string
  /**
   * 조건부 매핑 — 활성 변형 값이 이 목록 중 하나일 때만 "있는" 엣지.
   * 비우면 항상 존재. (양 끝 필드가 변형으로 사라지면 엣지도 자동으로 흐려진다)
   */
  when?: string[]
}
