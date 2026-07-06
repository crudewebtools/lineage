import type { Field, FieldType, WhenClause } from './types'

// ── 모달용 필드 초안 (재귀 트리) ──────────────────────────────────────
// 폼에서 직접 편집하는 값은 펼쳐 두고(name/type/플래그/children),
// 변형 설정(discriminator/enumValues/when)은 행의 팝오버(VariantPopover)로 편집한다.

// draft 전용 when 절 — discriminator 를 "행의 _k(정체성)" 로 참조한다.
// 영속 모델(WhenClause)의 경로 기반 disc 는 편집 중 개명·일시적 이름 충돌에서
// 어느 필드를 가리키는지 식별이 불가능하다(문자열 경로의 한계). draft 안에서는
// _k 로 참조하고, toDraft/저장 변환(draftsToFields) 경계에서만 경로와 오간다.
export type DraftWhenClause = { discK: string; values: string[] }

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
  when?: DraftWhenClause[]
}

// 행 식별용 키 — 값과 무관한 단조 증가 카운터(모달 인스턴스 간 공유돼도 무방).
let keySeq = 0
export const genKey = () => `f${keySeq++}`

// Field → draft. nodeId 를 주면(엔터티 모달) when 의 "노드id::경로" disc 를
// 해당 discriminator 행의 _k 로 번역한다 — 원본 트리의 경로는 유일해서 안전.
// nodeId 가 없으면(프로세스 모달 — when 미지원) when 은 버린다.
export function toDraft(fields: Field[], nodeId?: string): DraftField[] {
  const prefix = nodeId ? `${nodeId}::` : null
  const pathToK = new Map<string, string>()
  const pending: { draft: DraftField; when: WhenClause[] }[] = []
  const conv = (list: Field[], pre: string): DraftField[] =>
    list.map((f) => {
      const path = pre ? `${pre}.${f.name}` : f.name
      const d: DraftField = {
        _k: genKey(),
        name: f.name,
        type: f.type,
        array: Boolean(f.array),
        nullable: Boolean(f.nullable),
        pk: Boolean(f.pk),
        children: f.children ? conv(f.children, path) : [],
        discriminator: f.discriminator,
        enumValues: f.enumValues,
      }
      pathToK.set(path, d._k)
      if (prefix && f.when?.length) pending.push({ draft: d, when: f.when })
      return d
    })
  const out = conv(fields, '')
  // 트리 전체의 경로 → _k 가 모인 뒤 when 을 번역한다 (앞쪽 필드가 뒤쪽
  // discriminator 를 참조할 수 있으므로 두 단계로). 해석 안 되는 절은 버린다
  // — lenient 로드가 이미 정리했으므로 실제로는 없다.
  for (const { draft, when } of pending) {
    const clauses: DraftWhenClause[] = []
    for (const c of when) {
      if (!c.disc.startsWith(prefix!)) continue
      const k = pathToK.get(c.disc.slice(prefix!.length))
      if (k) clauses.push({ discK: k, values: c.values })
    }
    if (clauses.length) draft.when = clauses
  }
  return out
}

export function toField(d: DraftField): Field {
  const f: Field = { name: d.name.trim(), type: d.type }
  if (d.array) f.array = true
  if (d.nullable) f.nullable = true
  if (d.pk) f.pk = true
  // children 은 object 타입일 때만 의미가 있다 (다른 타입으로 바꾸면 떨군다)
  if (d.type === 'object' && d.children.length)
    f.children = d.children.map(toField)
  // discriminator ↔ enumValues 는 상호 필수 — 한쪽만 있으면 죽은 설정이라 떨군다
  // (팝오버에서 토글만 켜고 값을 안 넣은 채 저장되는 일은 validate 가 막는다)
  if (d.discriminator && d.enumValues?.length) {
    f.discriminator = true
    f.enumValues = d.enumValues
  }
  // when(discK 기반)은 여기서 다루지 않는다 — 경로 역번역은 트리 전체의 최종
  // 경로가 필요해서 draftsToFields 가 담당한다 (프로세스 필드는 when 미지원).
  return f
}

// draft 트리 → Field 트리 (엔터티 저장 전용). when 의 discK 를 최종 경로 기반
// disc("노드id::경로")로 역번역하고, 더는 discriminator 가 아니거나(해제·삭제·
// object 하위 폐기) enum 에서 빠진 값은 정리한다 — 저장 결과에 dangling 없음.
export function draftsToFields(drafts: DraftField[], nodeId: string): Field[] {
  // 유효 discriminator: _k → { 최종 경로, enumValues }. toField 와 같은 규칙으로
  // object 일 때만 하위로 내려간다 (일반 타입의 하위는 저장 시 폐기되므로).
  const discs = new Map<string, { path: string; values: string[] }>()
  const collect = (list: DraftField[], pre: string) => {
    for (const f of list) {
      const name = f.name.trim()
      const path = pre ? `${pre}.${name}` : name
      if (f.discriminator && f.enumValues?.length)
        discs.set(f._k, { path, values: f.enumValues })
      if (f.type === 'object' && f.children.length) collect(f.children, path)
    }
  }
  collect(drafts, '')

  const conv = (list: DraftField[]): Field[] =>
    list.map((d) => {
      const f = toField(d)
      if (d.type === 'object' && d.children.length) f.children = conv(d.children)
      const when: WhenClause[] = []
      for (const c of d.when ?? []) {
        const disc = discs.get(c.discK)
        if (!disc) continue
        const values = c.values.filter((v) => disc.values.includes(v))
        if (values.length)
          when.push({ disc: `${nodeId}::${disc.path}`, values })
      }
      if (when.length) f.when = when
      return f
    })
  return conv(drafts)
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

// 형제 그룹마다 이름이 비었거나 중복·금지 문자인지 검사 (경로는 부모별로 독립)
export function validate(fields: DraftField[], where: string): string | null {
  const names = fields.map((f) => f.name.trim())
  if (names.some((n) => !n)) return `${where}: 필드명을 모두 입력하세요`
  // '.' 은 경로 구분자, ':' 는 변형(when.disc) 키 구분자와 충돌한다
  if (names.some((n) => /[.:]/.test(n)))
    return `${where}: 필드명에 '.' 과 ':' 는 쓸 수 없습니다`
  if (new Set(names).size !== names.length)
    return `${where}: 필드명이 중복됩니다`
  for (const f of fields) {
    // 분기 기준을 켰으면 값이 1개 이상 있어야 한다 (없으면 저장 시 죽은 설정이 됨)
    if (f.discriminator && !f.enumValues?.length)
      return `${where}: "${f.name.trim()}" 분기 기준(discriminator)에 값을 1개 이상 추가하세요`
    if (f.type === 'object' && f.children.length) {
      const e = validate(f.children, f.name.trim())
      if (e) return e
    }
  }
  return null
}

// ── 필드 개명 추적 ────────────────────────────────────────────────────
// 모달의 draft 행은 _k(안정 키)를 가지므로, 열 때/저장할 때의 경로를 비교하면
// "어떤 경로가 어떤 경로로 바뀌었는지"를 알 수 있다. 부모 object 개명으로
// 자식 경로가 바뀌는 경우도 전체 경로 비교라 자연히 포함된다.
// 이 매핑은 저장 시 when.disc·엣지 핸들·접힘 상태 갱신에 쓴다.

// _k → 전체 경로 (이름은 저장 시와 동일하게 trim 해 비교)
export function collectPaths(
  fields: DraftField[],
  prefix = '',
): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (list: DraftField[], pre: string) => {
    for (const f of list) {
      const name = f.name.trim()
      const path = pre ? `${pre}.${name}` : name
      out.set(f._k, path)
      if (f.children.length) walk(f.children, path)
    }
  }
  walk(fields, prefix)
  return out
}

// 저장 시점의 "연결 가능한(리프)" 경로 집합 — object 는 컨테이너라 제외.
// 저장 후 엣지 정리에 쓴다: 개명을 반영한 핸들 경로가 이 집합에 없으면
// (필드 삭제 또는 object 전환) 그 엣지는 더는 유효하지 않다.
// toField 와 같은 규칙으로 object 일 때만 children 으로 내려간다.
export function collectLeafPaths(
  fields: DraftField[],
  prefix = '',
): Set<string> {
  const out = new Set<string>()
  const walk = (list: DraftField[], pre: string) => {
    for (const f of list) {
      const name = f.name.trim()
      const path = pre ? `${pre}.${name}` : name
      if (f.type !== 'object') out.add(path)
      else if (f.children.length) walk(f.children, path)
    }
  }
  walk(fields, prefix)
  return out
}

// 열 때(before)와 저장할 때(after)의 경로를 _k 로 이어붙여 옛 경로 → 새 경로.
// 삭제된 필드(after 에 없음)는 개명이 아니므로 담지 않는다.
export function buildRenames(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, oldPath] of before) {
    const newPath = after.get(k)
    if (newPath !== undefined && newPath !== oldPath) out.set(oldPath, newPath)
  }
  return out
}

// 팝오버 when 선택지 항목 — 정체성 키(k)로 절과 이어지고, 경로·이름은 표시와
// 색 키(discKey)용이다. Discriminator(variant.ts)의 상위 호환 형태라 색 배정
// (variantColors)에 그대로 넣을 수 있다.
export type DraftDiscOption = {
  k: string
  nodeId: string
  nodeName: string
  path: string
  values: string[]
}

// draft 트리에서 discriminator 필드들을 모은다 — 팝오버의 when 선택지에
// "지금 편집 중인(아직 저장 전) 자기 discriminator" 를 실시간으로 넣기 위한 것.
// nodeId 는 수정 모드면 실제 노드 id, 생성 모드면 SELF_NODE(임시)가 들어온다.
// toField 와 같은 규칙으로 object 일 때만 하위로 내려간다 — object 를 일반
// 타입으로 바꾸면 하위는 저장 시 폐기되므로, 그 밑의 discriminator 가 유효
// 목록(선택지)에 유령으로 남으면 안 된다.
export function collectDraftDiscOptions(
  fields: DraftField[],
  nodeId: string,
  nodeName: string,
): DraftDiscOption[] {
  const out: DraftDiscOption[] = []
  const walk = (list: DraftField[], prefix: string) => {
    for (const f of list) {
      const name = f.name.trim()
      if (!name) continue
      const path = prefix ? `${prefix}.${name}` : name
      if (f.discriminator && f.enumValues?.length)
        out.push({ k: f._k, nodeId, nodeName, path, values: f.enumValues })
      if (f.type === 'object' && f.children.length) walk(f.children, path)
    }
  }
  walk(fields, '')
  return out
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
