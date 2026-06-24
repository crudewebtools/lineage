import type { Node } from '@xyflow/react'
import type { EntityNodeType } from './EntityNode'
import type { ProcessData } from './types'

// 변환/프로세스 노드 (왼쪽 input=target, 오른쪽 output=source)
export type ProcessNodeType = Node<ProcessData, 'process'>

// 캔버스에 올라가는 모든 노드의 유니온 (entity | process)
export type AppNode = EntityNodeType | ProcessNodeType
