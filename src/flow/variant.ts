// ── 입력 변형(discriminated union) ────────────────────────────────────
// 같은 최종 DTO 라도, 특정 필드(discriminator) 값에 따라 입력 엔티티의 어떤
// 필드/object/엣지가 "있는지"가 갈린다. 좌상단 셀렉터로 값을 고르면, 그 변형에
// 없는 필드·엣지를 흐리게(dim) 표시한다 — 숨기지 않고 남겨 전체 구조를 비교하게.
import { fieldKey } from './highlight'
import type { AppNode } from './node-types'
import type { MappingEdge } from './edge-kind'
import type { Field } from './types'

// 그래프 안의 discriminator 하나 (엔티티 + 필드 경로 + 고를 수 있는 값들)
export type Discriminator = {
  nodeId: string
  nodeName: string
  path: string
  values: string[]
}

// (노드, discriminator 경로) 한 쌍을 식별하는 선택 상태 키
export const discKey = (nodeId: string, path: string): string =>
  `${nodeId}::${path}`

// 필드 트리를 경로와 함께 순회 (path 는 점으로 구분, 핸들 id 와 동일)
function walkFields(
  fields: Field[],
  prefix: string,
  fn: (f: Field, path: string) => void,
) {
  for (const f of fields) {
    const path = prefix ? `${prefix}.${f.name}` : f.name
    fn(f, path)
    if (f.children?.length) walkFields(f.children, path, fn)
  }
}

// 엔티티 노드들에서 discriminator 필드를 모은다 (enumValues 가 있어야 변형이 성립).
export function collectDiscriminators(nodes: AppNode[]): Discriminator[] {
  const out: Discriminator[] = []
  for (const n of nodes) {
    if (n.type !== 'entity') continue
    walkFields(n.data.fields, '', (f, path) => {
      if (f.discriminator && f.enumValues && f.enumValues.length) {
        out.push({
          nodeId: n.id,
          nodeName: n.data.name,
          path,
          values: f.enumValues,
        })
      }
    })
  }
  return out
}

// ── 변형 값 색 ────────────────────────────────────────────────────────
export type VariantColor = { badge: string; text: string }

// 값별 색 팔레트. Tailwind 는 소스의 "리터럴" 클래스만 인식하므로 동적 조합
// (`text-${c}-600`) 대신 완성된 클래스를 넉넉히 박아두고 인덱스로 골라 쓴다.
// 값이 팔레트보다 많으면 % 로 순환한다.
//  - badge: 필드 옆 배지(테두리+글자)   - text: 셀렉터 현재값 글자색
const VARIANT_PALETTE: VariantColor[] = [
  { badge: 'border-sky-500/40 text-sky-600', text: 'text-sky-600' },
  { badge: 'border-amber-500/40 text-amber-600', text: 'text-amber-600' },
  { badge: 'border-violet-500/40 text-violet-600', text: 'text-violet-600' },
  { badge: 'border-emerald-500/40 text-emerald-600', text: 'text-emerald-600' },
  { badge: 'border-rose-500/40 text-rose-600', text: 'text-rose-600' },
  { badge: 'border-cyan-500/40 text-cyan-600', text: 'text-cyan-600' },
  { badge: 'border-orange-500/40 text-orange-600', text: 'text-orange-600' },
  { badge: 'border-fuchsia-500/40 text-fuchsia-600', text: 'text-fuchsia-600' },
]

// 그래프의 모든 변형 값을 (discriminator 순서 → enumValues 순서) 로 안정적으로 모아
// 값 → 팔레트 슬롯을 매긴다. 같은 값은 어디서나 같은 색(등장 순서와 무관)이고,
// 한 discriminator 안의 값들은 팔레트 크기 안에선 서로 다른 색이 보장된다.
export function variantColors(
  discriminators: Discriminator[],
): Map<string, VariantColor> {
  const map = new Map<string, VariantColor>()
  let i = 0
  for (const d of discriminators) {
    for (const v of d.values) {
      if (map.has(v)) continue
      map.set(v, VARIANT_PALETTE[i % VARIANT_PALETTE.length])
      i++
    }
  }
  return map
}

// when(조건) 이 현재 활성 값 집합에 비춰 "있는가". when 이 없으면 항상 있음(공통).
export function matchWhen(
  when: string[] | undefined,
  active: ReadonlySet<string>,
): boolean {
  if (!when || when.length === 0) return true
  return when.some((v) => active.has(v))
}

// 현재 활성 변형 값(active)에서 "없는" 필드/엣지를 계산한다.
//  - 필드 : when 이 안 맞으면 dim. 조상이 dim 이면 하위도 모두 dim(object 통째 사라짐).
//  - 엣지 : 자기 when 이 안 맞거나, 양 끝 필드가 dim 이면 dim.
// 값 이름은 그래프 전역에서 비교한다(discriminator 가 여럿이면 값은 서로 구분되게 둘 것).
export function computeDimmed(
  nodes: AppNode[],
  edges: MappingEdge[],
  active: ReadonlySet<string>,
): { fields: Set<string>; edges: Set<string> } {
  const fields = new Set<string>()
  for (const n of nodes) {
    if (n.type !== 'entity') continue
    const mark = (list: Field[], prefix: string, parentDimmed: boolean) => {
      for (const f of list) {
        const path = prefix ? `${prefix}.${f.name}` : f.name
        const dimmed = parentDimmed || !matchWhen(f.when, active)
        if (dimmed) fields.add(fieldKey(n.id, path))
        if (f.children?.length) mark(f.children, path, dimmed)
      }
    }
    mark(n.data.fields, '', false)
  }

  const edgeIds = new Set<string>()
  for (const e of edges) {
    const ownDim = !matchWhen(e.data?.when, active)
    const srcDim = fields.has(fieldKey(e.source, e.sourceHandle ?? ''))
    const tgtDim = fields.has(fieldKey(e.target, e.targetHandle ?? ''))
    if (ownDim || srcDim || tgtDim) edgeIds.add(e.id)
  }
  return { fields, edges: edgeIds }
}
