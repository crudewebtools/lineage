import type { Edge } from '@xyflow/react'
import type { EntityNodeType } from './EntityNode'
import type { FieldMapping } from './types'

// 시나리오: 카프카 이벤트 수신 → API 조회 → DB 조회 → 외부 시스템으로 전송.
// 소스 3개(좌)의 필드들이 최종 엔티티(우)의 필드로 매핑된다.
export const initialNodes: EntityNodeType[] = [
  // ① 카프카로 들어오는 이벤트
  {
    id: 'orderEvent',
    type: 'entity',
    position: { x: 0, y: 0 },
    data: {
      name: 'OrderEvent',
      kind: 'event',
      fields: [
        { name: 'eventId', type: 'string', pk: true },
        { name: 'orderId', type: 'string' },
        { name: 'userId', type: 'string' },
        { name: 'items', type: 'array' },
        { name: 'occurredAt', type: 'timestamp' },
      ],
    },
  },
  // ② API 조회 응답
  {
    id: 'customerApi',
    type: 'entity',
    position: { x: 0, y: 250 },
    data: {
      name: 'CustomerApi',
      kind: 'api',
      fields: [
        { name: 'id', type: 'string', pk: true },
        { name: 'email', type: 'string' },
        { name: 'name', type: 'string' },
        {
          name: 'address',
          type: 'object',
          children: [
            { name: 'city', type: 'string' },
            { name: 'country', type: 'string' },
          ],
        },
        { name: 'vip', type: 'boolean' },
      ],
    },
  },
  // ③ DB 조회 결과
  {
    id: 'accountDb',
    type: 'entity',
    position: { x: 0, y: 530 },
    data: {
      name: 'AccountDb',
      kind: 'db',
      fields: [
        { name: 'account_id', type: 'string', pk: true },
        { name: 'user_id', type: 'string' },
        { name: 'plan', type: 'string' },
        { name: 'credit', type: 'number' },
        { name: 'region', type: 'string' },
      ],
    },
  },
  // ④ 외부 시스템으로 전송하는 최종 엔티티 (소스들의 조합, 슈퍼셋은 아님)
  {
    id: 'fulfillment',
    type: 'entity',
    position: { x: 560, y: 210 },
    data: {
      name: 'FulfillmentRequest',
      kind: 'output',
      fields: [
        { name: 'requestId', type: 'string', pk: true },
        {
          name: 'customer',
          type: 'object',
          children: [
            { name: 'id', type: 'string' },
            { name: 'email', type: 'string' },
            { name: 'city', type: 'string' },
          ],
        },
        {
          name: 'order',
          type: 'object',
          children: [
            { name: 'id', type: 'string' },
            { name: 'items', type: 'array' },
          ],
        },
        { name: 'plan', type: 'string' },
        { name: 'region', type: 'string' },
      ],
    },
  },
]

// ── 핵심: 필드 ↔ 필드 매핑 ────────────────────────────────────────────
export const mappings: FieldMapping[] = [
  { id: 'm1', source: 'orderEvent', sourceField: 'orderId', target: 'fulfillment', targetField: 'order.id' },
  { id: 'm2', source: 'orderEvent', sourceField: 'items', target: 'fulfillment', targetField: 'order.items' },
  { id: 'm3', source: 'customerApi', sourceField: 'id', target: 'fulfillment', targetField: 'customer.id' },
  { id: 'm4', source: 'customerApi', sourceField: 'email', target: 'fulfillment', targetField: 'customer.email' },
  { id: 'm5', source: 'customerApi', sourceField: 'address.city', target: 'fulfillment', targetField: 'customer.city' },
  { id: 'm6', source: 'accountDb', sourceField: 'plan', target: 'fulfillment', targetField: 'plan' },
  { id: 'm7', source: 'accountDb', sourceField: 'region', target: 'fulfillment', targetField: 'region' },
]

// 매핑을 React Flow 엣지로 변환 (핸들 id = 필드 경로)
export const initialEdges: Edge[] = mappings.map((m) => ({
  id: m.id,
  source: m.source,
  sourceHandle: m.sourceField,
  target: m.target,
  targetHandle: m.targetField,
  label: m.label,
}))
