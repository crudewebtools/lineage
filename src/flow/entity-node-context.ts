import { createContext } from 'react'

// object 필드 접기/펴기 토글을 노드(EntityNode) → 캔버스(Flow)로 올려보내는 통로.
// 컴포넌트 파일과 분리해 Fast Refresh(react-refresh) 규칙을 지킨다.
export const EntityNodeContext = createContext<{
  onToggleCollapse: (nodeId: string, path: string) => void
}>({ onToggleCollapse: () => {} })
