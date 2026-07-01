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

// 드래그앤드롭 재배치 — activeK 를 overK 자리로 옮긴다.
// 둘이 같은 부모(형제)일 때만 이동하고, 그렇지 않으면 그대로 둔다
// (한 단계 아래로 재귀하며 형제 그룹을 찾는다).
export function reorderTree(
  fields: DraftField[],
  activeK: string,
  overK: string,
): DraftField[] {
  const ai = fields.findIndex((f) => f._k === activeK)
  const oi = fields.findIndex((f) => f._k === overK)
  // 둘 다 이 레벨에 있으면 형제 → 재배치
  if (ai !== -1 && oi !== -1) {
    const copy = [...fields]
    const [moved] = copy.splice(ai, 1)
    copy.splice(oi, 0, moved)
    return copy
  }
  // 한쪽만 있으면 서로 다른 부모 → 이동 금지 (변경 없음)
  if (ai !== -1 || oi !== -1) return fields
  // 둘 다 없으면 더 깊은 곳의 형제 그룹 탐색
  return fields.map((f) =>
    f.children.length
      ? { ...f, children: reorderTree(f.children, activeK, overK) }
      : f,
  )
}

// k 와 같은 그룹(형제)에 있는 _k 들의 집합 (k 자신 포함). 못 찾으면 null.
// 드래그 시 충돌 판정을 같은 부모 안으로 제한하는 데 쓴다 — 다른 그룹의 자식이
// 커서 아래 있어도 형제만 대상으로 잡히게.
export function siblingKeys(
  fields: DraftField[],
  k: string,
): Set<string> | null {
  if (fields.some((f) => f._k === k)) return new Set(fields.map((f) => f._k))
  for (const f of fields) {
    if (f.children.length) {
      const s = siblingKeys(f.children, k)
      if (s) return s
    }
  }
  return null
}

// _k 로 필드 하나를 찾는다 (드래그 중 오버레이에 그릴 대상). 못 찾으면 null.
export function findTree(fields: DraftField[], k: string): DraftField | null {
  for (const f of fields) {
    if (f._k === k) return f
    const hit = f.children.length ? findTree(f.children, k) : null
    if (hit) return hit
  }
  return null
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
