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
