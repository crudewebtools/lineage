import type { Field, FieldType } from './types'

// ── 모달용 필드 초안 (재귀 트리) ──────────────────────────────────────
// 폼에서 직접 편집하는 값은 펼쳐 두고(name/type/플래그/children),
// 변형 설정(discriminator/enumValues/when)은 편집하진 않되 보존만 한다.
export type DraftField = {
  _k: string
  name: string
  type: FieldType
  array: boolean
  nullable: boolean
  pk: boolean
  children: DraftField[]
  discriminator?: boolean
  enumValues?: string[]
  when?: string[]
}

// 행 식별용 키 — 값과 무관한 단조 증가 카운터(모달 인스턴스 간 공유돼도 무방).
let keySeq = 0
export const genKey = () => `f${keySeq++}`

export function toDraft(fields: Field[]): DraftField[] {
  return fields.map((f) => ({
    _k: genKey(),
    name: f.name,
    type: f.type,
    array: Boolean(f.array),
    nullable: Boolean(f.nullable),
    pk: Boolean(f.pk),
    children: f.children ? toDraft(f.children) : [],
    discriminator: f.discriminator,
    enumValues: f.enumValues,
    when: f.when,
  }))
}

export function toField(d: DraftField): Field {
  const f: Field = { name: d.name.trim(), type: d.type }
  if (d.array) f.array = true
  if (d.nullable) f.nullable = true
  if (d.pk) f.pk = true
  // children 은 object 타입일 때만 의미가 있다 (다른 타입으로 바꾸면 떨군다)
  if (d.type === 'object' && d.children.length)
    f.children = d.children.map(toField)
  if (d.discriminator) f.discriminator = true
  if (d.enumValues?.length) f.enumValues = d.enumValues
  if (d.when?.length) f.when = d.when
  return f
}

export function newDraftField(): DraftField {
  return {
    _k: genKey(),
    name: '',
    type: 'string',
    array: false,
    nullable: false,
    pk: false,
    children: [],
  }
}

// ── 트리 조작 (불변, _k 로 대상 지정) ─────────────────────────────────
export function mapTree(
  fields: DraftField[],
  k: string,
  fn: (f: DraftField) => DraftField,
): DraftField[] {
  return fields.map((f) => {
    if (f._k === k) return fn(f)
    if (f.children.length) return { ...f, children: mapTree(f.children, k, fn) }
    return f
  })
}

export function removeTree(fields: DraftField[], k: string): DraftField[] {
  return fields
    .filter((f) => f._k !== k)
    .map((f) =>
      f.children.length ? { ...f, children: removeTree(f.children, k) } : f,
    )
}

export function addChildTree(
  fields: DraftField[],
  parentK: string,
  child: DraftField,
): DraftField[] {
  return fields.map((f) => {
    if (f._k === parentK) return { ...f, children: [...f.children, child] }
    if (f.children.length)
      return { ...f, children: addChildTree(f.children, parentK, child) }
    return f
  })
}

// 같은 부모 안에서 위/아래로 한 칸 이동 (형제 순서 변경)
export function moveTree(
  fields: DraftField[],
  k: string,
  dir: -1 | 1,
): DraftField[] {
  const i = fields.findIndex((f) => f._k === k)
  if (i !== -1) {
    const j = i + dir
    if (j < 0 || j >= fields.length) return fields
    const copy = [...fields]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    return copy
  }
  return fields.map((f) =>
    f.children.length ? { ...f, children: moveTree(f.children, k, dir) } : f,
  )
}

// 형제 그룹마다 이름이 비었거나 중복인지 검사 (경로는 부모별로 독립)
export function validate(fields: DraftField[], where: string): string | null {
  const names = fields.map((f) => f.name.trim())
  if (names.some((n) => !n)) return `${where}: 필드명을 모두 입력하세요`
  if (new Set(names).size !== names.length)
    return `${where}: 필드명이 중복됩니다`
  for (const f of fields) {
    if (f.type === 'object' && f.children.length) {
      const e = validate(f.children, f.name.trim())
      if (e) return e
    }
  }
  return null
}

// 변형 설정을 가진 필드가 하나라도 있는지 (보존 안내 표시용)
export function anyVariant(fields: DraftField[]): boolean {
  return fields.some(
    (f) =>
      f.discriminator ||
      f.enumValues?.length ||
      f.when?.length ||
      anyVariant(f.children),
  )
}
