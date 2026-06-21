import { EDGE_DASH, type MappingEdge } from './edge-kind'
import type { EntityNodeType } from './EntityNode'

// 경로의 조상 prefix 중 collapsed 에 든 가장 얕은 것(= 화면에 보이는 컨테이너)을 돌려준다.
// 예: 'order.items.productId' 에서 collapsed={'order.items'} → 'order.items'
//     collapsed={'order'} → 'order'  (둘 다면 더 얕은 'order')
function collapsedAncestor(path: string, collapsed: Set<string>): string | null {
  const parts = path.split('.')
  let prefix = ''
  for (const part of parts) {
    prefix = prefix ? `${prefix}.${part}` : part
    if (collapsed.has(prefix)) return prefix
  }
  return null
}

// 접힌 컨테이너 하위로 오가던 엣지를 컨테이너 핸들로 롤업하고 점선 처리한다.
// 원본 매핑(id/data.kind/label)은 그대로 두므로 펼치면 자동 복원된다.
// - 도착지가 접히면: 화살표가 컨테이너로 들어간다 (targetHandle → 컨테이너)
// - 출발지가 접히면: 컨테이너에서 화살표가 나온다 (sourceHandle → 컨테이너)
export function rerouteCollapsedEdges(
  edges: MappingEdge[],
  nodes: EntityNodeType[],
): MappingEdge[] {
  const collapsedByNode = new Map<string, Set<string>>()
  for (const n of nodes) {
    const c = n.data.collapsed
    if (c && c.length) collapsedByNode.set(n.id, new Set(c))
  }
  if (collapsedByNode.size === 0) return edges

  return edges.map((e) => {
    const srcSet = collapsedByNode.get(e.source)
    const tgtSet = collapsedByNode.get(e.target)
    const newSrc =
      srcSet && e.sourceHandle ? collapsedAncestor(e.sourceHandle, srcSet) : null
    const newTgt =
      tgtSet && e.targetHandle ? collapsedAncestor(e.targetHandle, tgtSet) : null
    if (!newSrc && !newTgt) return e
    return {
      ...e,
      sourceHandle: newSrc ?? e.sourceHandle,
      targetHandle: newTgt ?? e.targetHandle,
      // 롤업된 엣지는 의미상 "컨테이너로 뭉뚱그려진 연결" → 점선
      style: { ...e.style, strokeDasharray: EDGE_DASH },
    }
  })
}
