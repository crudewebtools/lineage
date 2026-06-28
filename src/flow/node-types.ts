import type { Node } from '@xyflow/react'
import type { EntityData, ProcessData } from './types'

// 표 형태 엔티티 노드 (필드별 좌=target / 우=source 핸들)
export type EntityNodeType = Node<EntityData, 'entity'>

// 변환/프로세스 노드 (왼쪽 input=target, 오른쪽 output=source)
export type ProcessNodeType = Node<ProcessData, 'process'>

// 캔버스에 올라가는 모든 노드의 유니온 (entity | process)
export type AppNode = EntityNodeType | ProcessNodeType
