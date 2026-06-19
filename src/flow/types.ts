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
}

export type EntityKind = 'event' | 'api' | 'db' | 'etc'

export type EntityData = {
  name: string
  kind: EntityKind
  fields: Field[]
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
}
