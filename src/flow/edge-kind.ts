import type { Edge } from '@xyflow/react'
import type { MappingKind } from './types'

// 엣지에 매핑 종류(kind)와 조건부 변형(when)을 data 로 실어 둔다
//  - kind: 클릭 토글 시 현재 종류를 알 수 있음
//  - when: 활성 변형 값이 이 목록일 때만 "있는" 엣지 (없으면 항상)
export type MappingEdge = Edge<{ kind: MappingKind; when?: string[] }>

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
