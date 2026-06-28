import type { AppNode, EntityNodeType, ProcessNodeType } from './node-types'
import { edgeKindProps, type MappingEdge } from './edge-kind'
import type {
  EntityKind,
  Field,
  FieldMapping,
  FieldType,
  MappingKind,
} from './types'

// ── 코드(JSON) 표현 ───────────────────────────────────────────────────
// 그래프 전체를 { entities, mappings } 한 덩어리로 직렬화한다.
type CodeEntity = {
  id: string
  name: string
  kind: EntityKind
  position?: { x: number; y: number }
  fields: Field[]
  collapsed?: string[]
}
// 변환/프로세스 노드 — inputs/outputs (블랙박스). 핸들 경로는 in.<>/out.<>.
type CodeProcess = {
  id: string
  name: string
  kind: EntityKind
  position?: { x: number; y: number }
  inputs: Field[]
  outputs: Field[]
}
type CodeDoc = {
  entities: CodeEntity[]
  processes?: CodeProcess[]
  mappings: FieldMapping[]
}

// 주의: 아래 두 배열의 순서는 URL 패킹(share.ts)의 enum 인덱스로 쓰인다.
// 항목을 끼워넣거나 재배열하면 기존 공유 URL 이 깨진다 — 추가는 항상 끝에만.
export const FIELD_TYPES: FieldType[] = [
  'uuid',
  'string',
  'number',
  'boolean',
  'timestamp',
  'object',
  'json',
]
export const KINDS: EntityKind[] = ['event', 'api', 'db', 'etc']
const MAPPING_KINDS: MappingKind[] = ['keep', 'transform']

// ── 그래프 → 코드 ─────────────────────────────────────────────────────
// position/collapsed 포함 여부를 옵션으로 고른다.
// 코드 패널은 둘 다 포함하고, URL 공유는 둘 다 빼서 "테이블 + 엣지" 구조만 작게 담는다.
export type DocOptions = { position?: boolean; collapsed?: boolean }

export function graphToDoc(
  nodes: AppNode[],
  edges: MappingEdge[],
  opts: DocOptions = {},
): CodeDoc {
  const pos = (n: AppNode) =>
    opts.position
      ? { position: { x: Math.round(n.position.x), y: Math.round(n.position.y) } }
      : {}
  const entities = nodes
    .filter((n): n is EntityNodeType => n.type === 'entity')
    .map((n) => {
      const e: CodeEntity = {
        id: n.id,
        name: n.data.name,
        kind: n.data.kind,
        ...pos(n),
        fields: n.data.fields,
      }
      if (opts.collapsed && n.data.collapsed?.length)
        e.collapsed = n.data.collapsed
      return e
    })
  const processes = nodes
    .filter((n): n is ProcessNodeType => n.type === 'process')
    .map((n) => ({
      id: n.id,
      name: n.data.name,
      kind: n.data.kind,
      ...pos(n),
      inputs: n.data.inputs,
      outputs: n.data.outputs,
    }))
  const mappings = edges.map((e) => {
    const m: FieldMapping = {
      id: e.id,
      source: e.source,
      sourceField: e.sourceHandle ?? '',
      target: e.target,
      targetField: e.targetHandle ?? '',
    }
    if (e.data?.kind && e.data.kind !== 'keep') m.kind = e.data.kind
    if (typeof e.label === 'string' && e.label) m.label = e.label
    return m
  })
  return { entities, processes, mappings }
}

export function graphToCode(
  nodes: AppNode[],
  edges: MappingEdge[],
): string {
  return JSON.stringify(
    graphToDoc(nodes, edges, { position: true, collapsed: true }),
    null,
    2,
  )
}

// ── 코드 → 그래프 (검증 포함) ─────────────────────────────────────────
export type ParseResult =
  | { ok: true; nodes: AppNode[]; edges: MappingEdge[] }
  | { ok: false; errors: string[] }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function codeToGraph(text: string): ParseResult {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`JSON 파싱 오류: ${(e as Error).message}`] }
  }
  return graphFromDoc(doc)
}

// 이미 파싱된 문서 객체를 검증하고 노드/엣지로 빌드한다.
// (코드 패널의 JSON, URL 의 패킹 해제 결과 둘 다 이 함수를 거친다)
export function graphFromDoc(doc: unknown): ParseResult {
  const errors: string[] = []
  if (!isRecord(doc)) {
    return { ok: false, errors: ['최상위는 { entities, mappings } 객체여야 합니다.'] }
  }
  if (!Array.isArray(doc.entities)) errors.push('entities 는 배열이어야 합니다.')
  if (!Array.isArray(doc.mappings)) errors.push('mappings 는 배열이어야 합니다.')
  if (errors.length) return { ok: false, errors }

  const entities = doc.entities as unknown[]
  const mappings = doc.mappings as unknown[]
  // processes 는 선택 (구버전 문서엔 없을 수 있다)
  const processes = Array.isArray(doc.processes) ? (doc.processes as unknown[]) : []

  // 엔티티/프로세스 검증 — id 집합(노드 전체 공유)과 노드별 (전체경로 / 리프경로) 집합.
  const ids = new Set<string>()
  const allPaths = new Map<string, Set<string>>()
  const leafPaths = new Map<string, Set<string>>()

  entities.forEach((raw, i) => {
    const where = `entities[${i}]`
    if (!isRecord(raw)) {
      errors.push(`${where} 는 객체여야 합니다.`)
      return
    }
    const id = raw.id
    if (typeof id !== 'string' || !id) errors.push(`${where}.id 가 필요합니다(문자열).`)
    else if (ids.has(id)) errors.push(`엔티티 id 중복: "${id}"`)
    else ids.add(id)

    if (typeof raw.name !== 'string' || !raw.name)
      errors.push(`${where}.name 이 필요합니다.`)
    if (!KINDS.includes(raw.kind as EntityKind))
      errors.push(`${where}.kind 는 ${KINDS.join(' | ')} 중 하나여야 합니다.`)

    if (raw.position != null) {
      const p = raw.position
      if (!isRecord(p) || typeof p.x !== 'number' || typeof p.y !== 'number')
        errors.push(`${where}.position 은 { x:number, y:number } 여야 합니다.`)
    }
    if (raw.collapsed != null && !isStringArray(raw.collapsed))
      errors.push(`${where}.collapsed 는 문자열 배열이어야 합니다.`)

    const all = new Set<string>()
    const leaf = new Set<string>()
    if (!Array.isArray(raw.fields)) errors.push(`${where}.fields 는 배열이어야 합니다.`)
    else validateFields(raw.fields, `${where}.fields`, '', errors, all, leaf)
    if (typeof id === 'string') {
      allPaths.set(id, all)
      leafPaths.set(id, leaf)
    }
  })

  // 프로세스 노드 검증 — id 는 엔티티와 같은 공간(중복 금지),
  // 핸들 경로는 입력 in.<>, 출력 out.<> 로 등록한다.
  processes.forEach((raw, i) => {
    const where = `processes[${i}]`
    if (!isRecord(raw)) {
      errors.push(`${where} 는 객체여야 합니다.`)
      return
    }
    const id = raw.id
    if (typeof id !== 'string' || !id) errors.push(`${where}.id 가 필요합니다(문자열).`)
    else if (ids.has(id)) errors.push(`노드 id 중복: "${id}"`)
    else ids.add(id)

    if (typeof raw.name !== 'string' || !raw.name)
      errors.push(`${where}.name 이 필요합니다.`)
    if (!KINDS.includes(raw.kind as EntityKind))
      errors.push(`${where}.kind 는 ${KINDS.join(' | ')} 중 하나여야 합니다.`)
    if (raw.position != null) {
      const p = raw.position
      if (!isRecord(p) || typeof p.x !== 'number' || typeof p.y !== 'number')
        errors.push(`${where}.position 은 { x:number, y:number } 여야 합니다.`)
    }

    const all = new Set<string>()
    const leaf = new Set<string>()
    if (!Array.isArray(raw.inputs))
      errors.push(`${where}.inputs 는 배열이어야 합니다.`)
    else validateFields(raw.inputs, `${where}.inputs`, 'in', errors, all, leaf)
    if (!Array.isArray(raw.outputs))
      errors.push(`${where}.outputs 는 배열이어야 합니다.`)
    else validateFields(raw.outputs, `${where}.outputs`, 'out', errors, all, leaf)
    if (typeof id === 'string') {
      allPaths.set(id, all)
      leafPaths.set(id, leaf)
    }
  })

  // 매핑 검증 — id 유일성, 노드 참조, 필드 경로 존재 + 리프 여부.
  const mids = new Set<string>()
  mappings.forEach((raw, i) => {
    const where = `mappings[${i}]`
    if (!isRecord(raw)) {
      errors.push(`${where} 는 객체여야 합니다.`)
      return
    }
    const mid = raw.id
    if (typeof mid !== 'string' || !mid) errors.push(`${where}.id 가 필요합니다.`)
    else if (mids.has(mid)) errors.push(`매핑 id 중복: "${mid}"`)
    else mids.add(mid)

    checkEndpoint(raw, 'source', 'sourceField', where, ids, allPaths, leafPaths, errors)
    checkEndpoint(raw, 'target', 'targetField', where, ids, allPaths, leafPaths, errors)

    if (raw.kind != null && !MAPPING_KINDS.includes(raw.kind as MappingKind))
      errors.push(`${where}.kind 는 keep | transform 이어야 합니다.`)
    if (raw.label != null && typeof raw.label !== 'string')
      errors.push(`${where}.label 은 문자열이어야 합니다.`)
  })

  if (errors.length) return { ok: false, errors }

  // 검증 통과 → 타입 단언 후 그래프로 변환
  const valid = doc as CodeDoc
  const entityNodes: AppNode[] = valid.entities.map((ent, i) => ({
    id: ent.id,
    type: 'entity',
    position: ent.position ?? { x: 0, y: i * 120 },
    data: {
      name: ent.name,
      kind: ent.kind,
      fields: ent.fields,
      ...(ent.collapsed?.length ? { collapsed: ent.collapsed } : {}),
    },
  }))
  const processNodes: AppNode[] = (valid.processes ?? []).map((p, i) => ({
    id: p.id,
    type: 'process',
    position: p.position ?? { x: 340, y: 120 + i * 160 },
    data: {
      name: p.name,
      kind: p.kind,
      inputs: p.inputs,
      outputs: p.outputs,
    },
  }))
  const nodes: AppNode[] = [...entityNodes, ...processNodes]
  const edges: MappingEdge[] = valid.mappings.map((m) => ({
    id: m.id,
    source: m.source,
    sourceHandle: m.sourceField,
    target: m.target,
    targetHandle: m.targetField,
    ...(m.label ? { label: m.label } : {}),
    ...edgeKindProps(m.kind ?? 'keep'),
  }))
  return { ok: true, nodes, edges }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

// 필드 트리를 재귀 검증하며 전체 경로(all)와 리프 경로(leaf)를 모은다.
function validateFields(
  fields: unknown[],
  where: string,
  prefix: string,
  errors: string[],
  all: Set<string>,
  leaf: Set<string>,
) {
  fields.forEach((raw, i) => {
    const w = `${where}[${i}]`
    if (!isRecord(raw)) {
      errors.push(`${w} 는 객체여야 합니다.`)
      return
    }
    const name = raw.name
    if (typeof name !== 'string' || !name) {
      errors.push(`${w}.name 이 필요합니다.`)
      return
    }
    const path = prefix ? `${prefix}.${name}` : name
    if (all.has(path)) errors.push(`필드 경로 중복: "${path}"`)
    all.add(path)
    if (raw.type !== 'object') leaf.add(path)
    if (!FIELD_TYPES.includes(raw.type as FieldType))
      errors.push(`${w}.type 는 ${FIELD_TYPES.join(' | ')} 중 하나여야 합니다.`)
    if (raw.children != null) {
      if (!Array.isArray(raw.children))
        errors.push(`${w}.children 는 배열이어야 합니다.`)
      else validateFields(raw.children, `${w}.children`, path, errors, all, leaf)
    }
  })
}

// 매핑 한쪽 끝(source/target) 검증: 엔티티 존재 → 필드 경로 존재 → 리프 여부.
function checkEndpoint(
  raw: Record<string, unknown>,
  entKey: 'source' | 'target',
  fieldKey: 'sourceField' | 'targetField',
  where: string,
  ids: Set<string>,
  allPaths: Map<string, Set<string>>,
  leafPaths: Map<string, Set<string>>,
  errors: string[],
) {
  const ent = raw[entKey]
  const field = raw[fieldKey]
  if (typeof ent !== 'string' || !ent) {
    errors.push(`${where}.${entKey} 가 필요합니다.`)
    return
  }
  if (typeof field !== 'string' || !field) {
    errors.push(`${where}.${fieldKey} 가 필요합니다.`)
    return
  }
  if (!ids.has(ent)) {
    errors.push(`${where}.${entKey} "${ent}" 엔티티가 없습니다.`)
    return
  }
  const all = allPaths.get(ent)
  const leaf = leafPaths.get(ent)
  if (all && !all.has(field)) {
    errors.push(`${where}.${fieldKey} "${field}" 경로가 "${ent}" 에 없습니다.`)
  } else if (leaf && !leaf.has(field)) {
    errors.push(
      `${where}.${fieldKey} "${field}" 는 컨테이너(object)라 매핑할 수 없습니다(리프 필드만).`,
    )
  }
}
