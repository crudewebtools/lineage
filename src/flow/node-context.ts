import { createContext } from 'react'
import type { VariantColor } from './variant'

// 비어 있는 하이라이트 집합(안정된 참조) — 호버 안 했을 때 불필요한 리렌더 방지.
export const EMPTY_HIGHLIGHT: ReadonlySet<string> = new Set()
// 변형 값 → 색 (호버·변형이 없을 때의 안정된 빈 참조)
export const EMPTY_VARIANT_COLORS: ReadonlyMap<string, VariantColor> = new Map()

// 노드(EntityNode·ProcessNode) → 캔버스(Flow) 로 올려보내는 공용 통로.
//  - onToggleCollapse: object 필드 접기/펴기 (EntityNode 만 사용)
//  - onFieldHover    : 필드 호버 시작/끝 알림 (계보 하이라이트용)
//  - onEditEntity    : 엔터티 수정 모달 열기 (EntityNode 헤더의 ✏️)
//  - onEditProcess   : 프로세스 수정 모달 열기 (ProcessNode 헤더의 ✏️)
//  - onSelectVariant : when 배지 클릭 → 그 (disc, 값) 변형으로 전환
//  - highlightedFields: 강조할 필드 키(fieldKey) 집합
//  - dimmedFields    : 현재 변형에서 "없는" 필드 키 집합 (흐리게 표시)
//  - variantColors   : 변형 값 → 배지 색 (when 배지 색 구분용)
// 컴포넌트 파일과 분리해 Fast Refresh(react-refresh) 규칙을 지킨다.
export const NodeContext = createContext<{
  onToggleCollapse: (nodeId: string, path: string) => void
  onFieldHover: (nodeId: string, path: string, entering: boolean) => void
  onEditEntity: (nodeId: string) => void
  onEditProcess: (nodeId: string) => void
  onSelectVariant: (disc: string, value: string) => void
  highlightedFields: ReadonlySet<string>
  dimmedFields: ReadonlySet<string>
  variantColors: ReadonlyMap<string, VariantColor>
}>({
  onToggleCollapse: () => {},
  onFieldHover: () => {},
  onEditEntity: () => {},
  onEditProcess: () => {},
  onSelectVariant: () => {},
  highlightedFields: EMPTY_HIGHLIGHT,
  dimmedFields: EMPTY_HIGHLIGHT,
  variantColors: EMPTY_VARIANT_COLORS,
})
