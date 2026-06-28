import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string'
import { FIELD_TYPES, KINDS, graphFromDoc } from './code'
import type { AppNode } from './node-types'
import type { MappingEdge } from './edge-kind'
import type { EntityKind, Field, FieldMapping } from './types'

// 그래프(테이블 + 엣지) 구조를 URL 해시에 싣는다.
// 압축(lz-string) 전에 "키 없는 튜플 배열"로 패킹해 페이로드를 줄인다 →
// 반복되던 "id"/"sourceField"/"type" 같은 키와 따옴표·중괄호가 사라져 URL 이 짧아진다.
const HASH_PREFIX = '#g='
// 패킹 포맷 버전. v2 에서 processes 추가, v3 에서 변형(discriminator/enumValues/when)
// 추가. 언패킹은 구버전(v1·v2)도 그대로 지원한다(새 항목은 모두 끝쪽 선택 슬롯).
const PACK_VERSION = 3

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
// mapping→ [id, source, sourceField, target, targetField, kindIdx?, label?, when?]
// doc    → [version, entities, processes, mappings]
//
// 끝쪽 선택 슬롯(children/enumValues/when, label/when)은 "비면 뒤에서부터 잘라낸다".
// → 대부분의 필드·매핑은 기존(v2)과 동일한 길이로 패킹돼 URL 이 짧게 유지된다.
function trimTail(slots: unknown[]): unknown[] {
  const t = [...slots]
  while (t.length && !t[t.length - 1]) t.pop()
  return t
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
    f.when?.length ? f.when : 0,
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
    // kind/label/when 은 끝쪽 선택 항목 — 뒤쪽 빈 칸을 잘라 위치 기반으로 담는다.
    const tail = trimTail([kindIdx, m.label ?? 0, m.when?.length ? m.when : 0])
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
  if (Array.isArray(when)) f.when = when
  return f
}

function unpackDoc(arr: unknown): unknown {
  if (!Array.isArray(arr)) return null
  const version = arr[0]
  // v1: [v, entities, mappings] / v2: [v, entities, processes, mappings]
  const entities = Array.isArray(arr[1]) ? arr[1] : []
  const processes = version !== 1 && Array.isArray(arr[2]) ? arr[2] : []
  const mappingsArr = version === 1 ? arr[2] : arr[3]
  const mappings = Array.isArray(mappingsArr) ? mappingsArr : []
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
      if (Array.isArray(a[7])) obj.when = a[7]
      return obj
    }),
  }
}

// ── URL 해시 ↔ 그래프 ─────────────────────────────────────────────────
// 위치 없는 keyed JSON(docJson)을 패킹·압축해 해시 문자열로 만든다.
export function encodeGraphDoc(docJson: string): string {
  const doc = JSON.parse(docJson) as PackDoc
  return HASH_PREFIX + compressToEncodedURIComponent(JSON.stringify(packDoc(doc)))
}

// 현재 URL 해시에서 그래프를 복원한다. 해시가 없거나 깨졌으면 null.
export function readGraphFromHash(): {
  nodes: AppNode[]
  edges: MappingEdge[]
} | null {
  const hash = window.location.hash
  if (!hash.startsWith(HASH_PREFIX)) return null
  const packedJson = decompressFromEncodedURIComponent(
    hash.slice(HASH_PREFIX.length),
  )
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
  const res = graphFromDoc(unpackDoc(packed))
  if (!res.ok) {
    console.warn('[lineage] URL 그래프가 유효하지 않습니다:', res.errors)
    return null
  }
  return { nodes: res.nodes, edges: res.edges }
}
