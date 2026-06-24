import type { MappingEdge } from './edge-kind'
import type { Field } from './types'

// (노드, 필드경로) 한 쌍을 식별하는 키. 엔티티 id 는 슬러그라 공백이 없어 안전.
export function fieldKey(nodeId: string, path: string): string {
  return `${nodeId} ${path}`
}

export type HoveredField = { nodeId: string; path: string }

// 경로로 필드를 찾아간다 (예: 'customer.address' → address 필드)
function findField(fields: Field[], path: string): Field | undefined {
  let cur: Field | undefined
  let list = fields
  for (const part of path.split('.')) {
    cur = list.find((f) => f.name === part)
    if (!cur) return undefined
    list = cur.children ?? []
  }
  return cur
}

function collectDescendants(field: Field, basePath: string, out: string[]) {
  out.push(basePath)
  for (const c of field.children ?? []) {
    collectDescendants(c, `${basePath}.${c.name}`, out)
  }
}

// 호버한 필드의 시드 경로들. (null = 강조 없음)
//  - 리프        : 자기 하나
//  - object 접힘 : 자기 + 모든 하위 경로 → 접혀서 안 보이는 리프들의 연결(롤업 엣지)을 강조
//  - object 펼침 : null — 하위 리프를 직접 호버하면 되므로 컨테이너 호버로는 강조하지 않는다
export function hoverSeeds(
  hovered: HoveredField,
  fields: Field[],
  collapsedPaths: string[],
): HoveredField[] | null {
  const field = findField(fields, hovered.path)
  if (!field) return [hovered]
  if (field.type === 'object') {
    if (!collapsedPaths.includes(hovered.path)) return null
    const paths: string[] = []
    collectDescendants(field, hovered.path, paths)
    return paths.map((path) => ({ nodeId: hovered.nodeId, path }))
  }
  return [hovered]
}

// 시드 필드들에서 엣지를 따라 **양방향으로** 도달하는 모든 필드·엣지를 모은다.
// A.x → B.y → C.z 처럼 연결이 이어지면 끝까지 전파된다(연결 컴포넌트 전체).
export function computeHighlight(
  seeds: HoveredField[],
  edges: MappingEdge[],
): { fields: Set<string>; edges: Set<string> } {
  const fields = new Set<string>()
  const edgeIds = new Set<string>()
  const queue: HoveredField[] = []
  for (const s of seeds) {
    const k = fieldKey(s.nodeId, s.path)
    if (!fields.has(k)) {
      fields.add(k)
      queue.push(s)
    }
  }

  while (queue.length) {
    const cur = queue.shift()!
    for (const e of edges) {
      const isSrc = e.source === cur.nodeId && e.sourceHandle === cur.path
      const isTgt = e.target === cur.nodeId && e.targetHandle === cur.path
      if (!isSrc && !isTgt) continue
      edgeIds.add(e.id)
      const other: HoveredField = isSrc
        ? { nodeId: e.target, path: e.targetHandle ?? '' }
        : { nodeId: e.source, path: e.sourceHandle ?? '' }
      const k = fieldKey(other.nodeId, other.path)
      if (!fields.has(k)) {
        fields.add(k)
        queue.push(other)
      }
    }
  }
  return { fields, edges: edgeIds }
}
