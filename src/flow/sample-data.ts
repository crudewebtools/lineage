import { edgeKindProps, type MappingEdge } from './edge-kind'
import type { AppNode } from './node-types'
import type { FieldMapping } from './types'

// 시나리오: 카프카 이벤트 수신 → API 조회 → DB 조회 → 외부 시스템으로 전송.
// 소스 3개(좌)의 필드들이 최종 엔티티(우)의 필드로 매핑된다.
export const initialNodes: AppNode[] = [
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
        // 분기 기준(discriminator). 값에 따라 아래 paymentId / cancellation 유무가 갈린다.
        {
          name: 'status',
          type: 'string',
          discriminator: true,
          enumValues: ['NORMAL', 'CANCELED'],
        },
        // 두 번째 분기 기준 — when 절을 AND 로 조합할 수 있다 (아래 pushToken 참고)
        {
          name: 'channel',
          type: 'string',
          discriminator: true,
          enumValues: ['APP', 'WEB'],
        },
        {
          name: 'items',
          type: 'object',
          array: true,
          children: [
            { name: 'productId', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'quantity', type: 'number' },
            { name: 'price', type: 'number' },
            { name: 'discount', type: 'number', nullable: true },
          ],
        },
        // NORMAL 일 때만 결제 정보가 함께 온다
        {
          name: 'paymentId',
          type: 'string',
          when: [{ disc: 'orderEvent::status', values: ['NORMAL'] }],
        },
        // CANCELED 일 때만 취소 정보(object 통째)가 함께 온다
        {
          name: 'cancellation',
          type: 'object',
          when: [{ disc: 'orderEvent::status', values: ['CANCELED'] }],
          children: [
            { name: 'reason', type: 'string' },
            { name: 'refunded', type: 'boolean' },
          ],
        },
        // AND 조합 — 취소이면서(status=CANCELED) 앱 채널(channel=APP)일 때만
        // 취소 푸시 알림 토큰이 함께 온다
        {
          name: 'pushToken',
          type: 'string',
          when: [
            { disc: 'orderEvent::status', values: ['CANCELED'] },
            { disc: 'orderEvent::channel', values: ['APP'] },
          ],
        },
        { name: 'occurredAt', type: 'timestamp' },
      ],
    },
  },
  // ② API 조회 응답
  {
    id: 'customerApi',
    type: 'entity',
    position: { x: 0, y: 380 },
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
    position: { x: 0, y: 670 },
    data: {
      name: 'AccountDb',
      kind: 'db',
      fields: [
        { name: 'account_id', type: 'string', pk: true },
        { name: 'user_id', type: 'string' },
        { name: 'plan', type: 'string' },
        { name: 'credit', type: 'number', nullable: true },
        { name: 'region', type: 'string' },
      ],
    },
  },
  // ④ 외부 시스템으로 전송하는 최종 엔티티 (소스들의 조합, 슈퍼셋은 아님)
  {
    id: 'fulfillment',
    type: 'entity',
    position: { x: 560, y: 250 },
    data: {
      name: 'FulfillmentRequest',
      kind: 'etc',
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
            {
              name: 'items',
              type: 'object',
              array: true,
              children: [
                { name: 'productId', type: 'string' },
                { name: 'name', type: 'string' },
                { name: 'quantity', type: 'number' },
              ],
            },
          ],
        },
        { name: 'plan', type: 'string' },
        { name: 'region', type: 'string' },
        { name: 'paymentId', type: 'string', nullable: true },
        { name: 'riskScore', type: 'number', nullable: true },
      ],
    },
  },
  // ⑤ 외부 위험도 평가 API — 입력(orderId, userId)을 받아 출력(riskScore, flaggedAt)을 낸다.
  //    왼쪽 input 은 받기만(target), 오른쪽 output 은 내보내기만(source). 내부는 블랙박스.
  {
    id: 'riskApi',
    type: 'process',
    position: { x: 250, y: 640 },
    data: {
      name: 'RiskApi',
      kind: 'api',
      inputs: [
        { name: 'orderId', type: 'string' },
        { name: 'userId', type: 'string' },
      ],
      outputs: [
        { name: 'riskScore', type: 'number' },
        { name: 'flaggedAt', type: 'timestamp' },
      ],
    },
  },
]

// ── 핵심: 필드 ↔ 필드 매핑 ────────────────────────────────────────────
export const mappings: FieldMapping[] = [
  // OrderEvent → FulfillmentRequest.order
  { id: 'm1', source: 'orderEvent', sourceField: 'orderId', target: 'fulfillment', targetField: 'order.id' },
  // items(object[]) 끼리 컨테이너 단위로 잇지 않고, 리프 필드 단위로 매핑한다
  { id: 'm2', source: 'orderEvent', sourceField: 'items.productId', target: 'fulfillment', targetField: 'order.items.productId' },
  { id: 'm3', source: 'orderEvent', sourceField: 'items.name', target: 'fulfillment', targetField: 'order.items.name' },
  { id: 'm4', source: 'orderEvent', sourceField: 'items.quantity', target: 'fulfillment', targetField: 'order.items.quantity' },
  // CustomerApi → FulfillmentRequest.customer
  { id: 'm5', source: 'customerApi', sourceField: 'id', target: 'fulfillment', targetField: 'customer.id' },
  { id: 'm6', source: 'customerApi', sourceField: 'email', target: 'fulfillment', targetField: 'customer.email', kind: 'transform', label: '소문자 정규화' },
  { id: 'm7', source: 'customerApi', sourceField: 'address.city', target: 'fulfillment', targetField: 'customer.city' },
  // AccountDb → FulfillmentRequest
  { id: 'm8', source: 'accountDb', sourceField: 'plan', target: 'fulfillment', targetField: 'plan' },
  { id: 'm9', source: 'accountDb', sourceField: 'region', target: 'fulfillment', targetField: 'region' },
  // 조건부 매핑 — NORMAL 일 때만 결제 정보가 흘러간다 (CANCELED 면 양 끝이 흐려짐)
  { id: 'm10', source: 'orderEvent', sourceField: 'paymentId', target: 'fulfillment', targetField: 'paymentId', when: [{ disc: 'orderEvent::status', values: ['NORMAL'] }] },
  // OrderEvent → RiskApi(input) / RiskApi(output) → FulfillmentRequest (외부 API 를 거치는 흐름)
  { id: 'p1', source: 'orderEvent', sourceField: 'orderId', target: 'riskApi', targetField: 'in.orderId' },
  { id: 'p2', source: 'orderEvent', sourceField: 'userId', target: 'riskApi', targetField: 'in.userId' },
  { id: 'p3', source: 'riskApi', sourceField: 'out.riskScore', target: 'fulfillment', targetField: 'riskScore', kind: 'transform' },
]

// 매핑을 React Flow 엣지로 변환 (핸들 id = 필드 경로)
export const initialEdges: MappingEdge[] = mappings.map((m) => {
  const kind = m.kind ?? 'keep'
  return {
    id: m.id,
    source: m.source,
    sourceHandle: m.sourceField,
    target: m.target,
    targetHandle: m.targetField,
    label: m.label,
    style: edgeKindProps(kind).style,
    data: { kind, ...(m.when?.length ? { when: m.when } : {}) },
  }
})
