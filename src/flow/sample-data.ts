import type { Edge } from '@xyflow/react'
import type { EntityNodeType } from './EntityNode'

// 샘플 스키마: 관계형 테이블 3개 + NoSQL 컬렉션 1개(중첩 필드 포함).
// events.props 처럼 깊어지는 필드는 indent 로 표현된다.
export const initialNodes: EntityNodeType[] = [
  {
    id: 'users',
    type: 'entity',
    position: { x: 0, y: 0 },
    data: {
      name: 'users',
      kind: 'table',
      fields: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'email', type: 'string' },
        { name: 'display_name', type: 'string', nullable: true },
        { name: 'created_at', type: 'timestamp' },
      ],
    },
  },
  {
    id: 'products',
    type: 'entity',
    position: { x: 0, y: 280 },
    data: {
      name: 'products',
      kind: 'table',
      fields: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'name', type: 'string' },
        { name: 'price', type: 'number' },
        { name: 'in_stock', type: 'boolean' },
        { name: 'tags', type: 'array' },
      ],
    },
  },
  {
    id: 'orders',
    type: 'entity',
    position: { x: 360, y: 70 },
    data: {
      name: 'orders',
      kind: 'table',
      fields: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'user_id', type: 'uuid', ref: 'users' },
        { name: 'product_id', type: 'uuid', ref: 'products' },
        { name: 'quantity', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'timestamp' },
      ],
    },
  },
  {
    id: 'events',
    type: 'entity',
    position: { x: 740, y: 30 },
    data: {
      name: 'events',
      kind: 'collection',
      fields: [
        { name: '_id', type: 'string', pk: true },
        { name: 'user_id', type: 'string', ref: 'users' },
        { name: 'name', type: 'string' },
        {
          name: 'props',
          type: 'object',
          children: [
            { name: 'source', type: 'string' },
            {
              name: 'session',
              type: 'object',
              children: [
                { name: 'device', type: 'string' },
                { name: 'os', type: 'string' },
              ],
            },
          ],
        },
        { name: 'ts', type: 'timestamp' },
      ],
    },
  },
]

// type / markerEnd 는 Flow.tsx 의 defaultEdgeOptions 에서 일괄 지정 (default = 베지어)
const edge = (id: string, source: string, sourceHandle: string, target: string): Edge => ({
  id,
  source,
  sourceHandle,
  target,
})

export const initialEdges: Edge[] = [
  edge('orders_user', 'orders', 'user_id', 'users'),
  edge('orders_product', 'orders', 'product_id', 'products'),
  edge('events_user', 'events', 'user_id', 'users'),
]
