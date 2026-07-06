import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string'
import { FIELD_TYPES, KINDS, graphFromDoc, graphToDoc } from './code'
import type { AppNode } from './node-types'
import type { MappingEdge } from './edge-kind'
import type { EntityKind, Field, FieldMapping, When } from './types'

// 그래프(테이블 + 엣지) 구조를 공유 링크로 싣는다 — "링크 복사" 시에만 URL 쿼리(?g=...)에.
// 압축(lz-string) 전에 "키 없는 튜플 배열"로 패킹해 페이로드를 줄인다 →
// 반복되던 "id"/"sourceField"/"type" 같은 키와 따옴표·중괄호가 사라져 URL 이 짧아진다.
const SHARE_PARAM = 'g'
// 패킹 포맷: [version, entities, processes, mappings]. field·mapping 의 선택 항목은
// 튜플 끝쪽 슬롯으로 담고 비면 잘라낸다(trimTail).
const PACK_VERSION = 1

// 필드 플래그 비트마스크 (array/nullable/pk/discriminator 를 정수 하나로)
const F_ARRAY = 1
const F_NULLABLE = 2
const F_PK = 4
const F_DISCRIMINATOR = 8

type PackEntity = { id: string; name: string; kind: EntityKind; fields: Field[] }
type PackProcess = {
  id: string
  name: string
  kind: EntityKind
  inputs: Field[]
  outputs: Field[]
}
type PackDoc = {
  entities: PackEntity[]
  processes?: PackProcess[]
  mappings: FieldMapping[]
}

// ── 패킹: 객체 → 튜플 배열 ────────────────────────────────────────────
// field  → [name, typeIdx, flags, children?, enumValues?, when?]
// entity → [id, name, kindIdx, fields]
// process→ [id, name, kindIdx, inputs, outputs]
// mapping→ [id, source, sourceField, target, targetField, kindIdx?, label?]
// when   → [[disc, ...values], ...]  (절마다 튜플 하나 — 첫 칸이 disc 키)
// doc    → [version, entities, processes, mappings]
//
// 끝쪽 선택 슬롯(children/enumValues/when, kindIdx/label)은 "비면 뒤에서부터 잘라낸다".
// → 선택 항목이 없는 대부분의 필드·매핑은 짧은 튜플로 패킹돼 URL 이 짧게 유지된다.
function trimTail(slots: unknown[]): unknown[] {
  const t = [...slots]
  while (t.length && !t[t.length - 1]) t.pop()
  return t
}

// when 절 배열 ↔ 튜플. 언패킹은 신뢰할 수 없는 입력 — 형태가 어긋나면
// 그대로 두고 graphFromDoc 검증에서 걸러지게 한다.
function packWhen(when: When): unknown[] {
  return when.map((c) => [c.disc, ...c.values])
}

function unpackWhen(v: unknown): unknown {
  if (!Array.isArray(v)) return v
  return v.map((c) =>
    Array.isArray(c) ? { disc: c[0], values: c.slice(1) } : c,
  )
}

function packField(f: Field): unknown[] {
  let flags = 0
  if (f.array) flags |= F_ARRAY
  if (f.nullable) flags |= F_NULLABLE
  if (f.pk) flags |= F_PK
  if (f.discriminator) flags |= F_DISCRIMINATOR
  const t: unknown[] = [f.name, FIELD_TYPES.indexOf(f.type), flags]
  const tail = trimTail([
    f.children?.length ? f.children.map(packField) : 0,
    f.enumValues?.length ? f.enumValues : 0,
    f.when?.length ? packWhen(f.when) : 0,
  ])
  t.push(...tail)
  return t
}

function packDoc(doc: PackDoc): unknown[] {
  const entities = doc.entities.map((e) => [
    e.id,
    e.name,
    KINDS.indexOf(e.kind),
    e.fields.map(packField),
  ])
  const processes = (doc.processes ?? []).map((p) => [
    p.id,
    p.name,
    KINDS.indexOf(p.kind),
    p.inputs.map(packField),
    p.outputs.map(packField),
  ])
  const mappings = doc.mappings.map((m) => {
    const t: unknown[] = [m.id, m.source, m.sourceField, m.target, m.targetField]
    const kindIdx = m.kind === 'transform' ? 1 : 0
    // kind/label 은 끝쪽 선택 항목 — 뒤쪽 빈 칸을 잘라 위치 기반으로 담는다.
    const tail = trimTail([kindIdx, m.label ?? 0])
    t.push(...tail)
    return t
  })
  return [PACK_VERSION, entities, processes, mappings]
}

// ── 언패킹: 튜플 → { entities, mappings } 객체 ────────────────────────
// 입력은 URL 에서 온 신뢰할 수 없는 값이므로, 빠진 값은 그대로 두고
// 이후 graphFromDoc 검증에 맡긴다.
function unpackField(t: unknown): unknown {
  if (!Array.isArray(t)) return {}
  const [name, typeIdx, flags, children, enumValues, when] = t
  const f: Record<string, unknown> = {
    name,
    type: FIELD_TYPES[typeIdx as number],
  }
  const fl = typeof flags === 'number' ? flags : 0
  if (fl & F_ARRAY) f.array = true
  if (fl & F_NULLABLE) f.nullable = true
  if (fl & F_PK) f.pk = true
  if (fl & F_DISCRIMINATOR) f.discriminator = true
  if (Array.isArray(children)) f.children = children.map(unpackField)
  if (Array.isArray(enumValues)) f.enumValues = enumValues
  if (Array.isArray(when)) f.when = unpackWhen(when)
  return f
}

function unpackDoc(arr: unknown): unknown {
  if (!Array.isArray(arr)) return null
  // 버전이 다르면 명시적으로 거부 — 포맷이 바뀐 링크가 조용히 오파싱되는 것 방지
  if (arr[0] !== PACK_VERSION) {
    console.warn('[lineage] 지원하지 않는 공유 링크 버전입니다:', arr[0])
    return null
  }
  // [version, entities, processes, mappings]
  const entities = Array.isArray(arr[1]) ? arr[1] : []
  const processes = Array.isArray(arr[2]) ? arr[2] : []
  const mappings = Array.isArray(arr[3]) ? arr[3] : []
  return {
    entities: entities.map((e: unknown) => {
      const a = Array.isArray(e) ? e : []
      return {
        id: a[0],
        name: a[1],
        kind: KINDS[a[2] as number],
        fields: Array.isArray(a[3]) ? a[3].map(unpackField) : [],
      }
    }),
    processes: processes.map((p: unknown) => {
      const a = Array.isArray(p) ? p : []
      return {
        id: a[0],
        name: a[1],
        kind: KINDS[a[2] as number],
        inputs: Array.isArray(a[3]) ? a[3].map(unpackField) : [],
        outputs: Array.isArray(a[4]) ? a[4].map(unpackField) : [],
      }
    }),
    mappings: mappings.map((m: unknown) => {
      const a = Array.isArray(m) ? m : []
      const obj: Record<string, unknown> = {
        id: a[0],
        source: a[1],
        sourceField: a[2],
        target: a[3],
        targetField: a[4],
      }
      if (a[5] === 1) obj.kind = 'transform'
      if (typeof a[6] === 'string' && a[6]) obj.label = a[6]
      return obj
    }),
  }
}

// ── URL 쿼리 ↔ 그래프 ─────────────────────────────────────────────────
// 현재 그래프(위치·접힘 제외)를 패킹·압축해 ?g=... 를 포함한 풀 URL 로 만든다.
// "링크 복사" 버튼에서만 호출한다 — 평소 편집 중에는 주소가 깨끗하게 유지된다.
export function buildShareUrl(nodes: AppNode[], edges: MappingEdge[]): string {
  const packed = JSON.stringify(packDoc(graphToDoc(nodes, edges) as PackDoc))
  const url = new URL(window.location.href)
  url.hash = ''
  url.searchParams.set(SHARE_PARAM, compressToEncodedURIComponent(packed))
  return url.toString()
}

// URL 쿼리(?g=...)에 그래프가 있으면 복원한다. 없거나 깨졌으면 null.
export function readGraphFromUrl(): {
  nodes: AppNode[]
  edges: MappingEdge[]
} | null {
  const value = new URLSearchParams(window.location.search).get(SHARE_PARAM)
  if (!value) return null
  const packedJson = decompressFromEncodedURIComponent(value)
  if (!packedJson) {
    console.warn('[lineage] URL 그래프 데이터를 해제하지 못했습니다.')
    return null
  }
  let packed: unknown
  try {
    packed = JSON.parse(packedJson)
  } catch {
    console.warn('[lineage] URL 그래프 데이터가 손상되었습니다.')
    return null
  }
  // 공유 시점 이후 그래프가 바뀌었을 수 있으므로 lenient — dangling when 절은 제거
  const res = graphFromDoc(unpackDoc(packed), 'lenient')
  if (!res.ok) {
    console.warn('[lineage] URL 그래프가 유효하지 않습니다:', res.errors)
    return null
  }
  return { nodes: res.nodes, edges: res.edges }
}

// 반영한 뒤 공유 쿼리를 주소에서 제거한다 (한 번 로드하면 주소는 깨끗하게).
export function clearShareParam(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(SHARE_PARAM)) return
  url.searchParams.delete(SHARE_PARAM)
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}
