import type { AppNode } from './node-types'

// 엔터티 이름 → 노드 id 슬러그(중복이면 _2, _3 …). 핸들·매핑 참조의 기준 id.
export function uniqueId(name: string, nodes: AppNode[]): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'entity'
  const ids = new Set(nodes.map((n) => n.id))
  if (!ids.has(base)) return base
  let i = 2
  while (ids.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

// 새 엔터티를 살짝 어긋나게 배치 (겹치지 않게 계단식)
export function nextEntityPos(nodes: AppNode[]) {
  return { x: 320, y: 40 + (nodes.length % 6) * 70 }
}
