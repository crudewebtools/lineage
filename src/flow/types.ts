// 노드 하나가 표현하는 "데이터 엔티티"의 모양.
// 관계형(table)에 한정하지 않고 NoSQL(collection/document)도 같은 구조로 표현한다.
// 중첩 필드(children)는 렌더링 시 depth 만큼 indent 한다.

export type FieldType =
  | 'uuid'
  | 'string'
  | 'number'
  | 'boolean'
  | 'timestamp'
  | 'object'
  | 'array'
  | 'json'

export type Field = {
  name: string
  type: FieldType
  /** null 허용 여부 (타입 옆에 ? 로 표기) */
  nullable?: boolean
  /** primary key 여부 */
  pk?: boolean
  /** 다른 엔티티를 참조하면 그 엔티티의 id. 연결선(edge)의 출발 핸들이 된다. */
  ref?: string
  /** 중첩 필드 — depth 가 깊어지면 indent 된다 */
  children?: Field[]
}

export type EntityKind = 'table' | 'collection' | 'document'

export type EntityData = {
  name: string
  kind: EntityKind
  fields: Field[]
}
