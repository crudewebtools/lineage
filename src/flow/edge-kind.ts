import type { Edge } from '@xyflow/react'
import type { MappingKind } from './types'

// 엣지에 매핑 종류(kind)를 data 로 실어 둔다 → 클릭 토글 시 현재 종류를 알 수 있음
export type MappingEdge = Edge<{ kind: MappingKind }>

// transform(가공) 엣지의 점선 패턴
export const EDGE_DASH = '6 4'

// 매핑 종류에 따른 엣지 시각 속성 (data.kind + 점선 여부)
export function edgeKindProps(
  kind: MappingKind,
): Pick<MappingEdge, 'data' | 'style'> {
  return {
    data: { kind },
    style: kind === 'transform' ? { strokeDasharray: EDGE_DASH } : undefined,
  }
}
