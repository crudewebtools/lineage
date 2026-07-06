// ── 입력 변형(discriminated union) ────────────────────────────────────
// 같은 최종 DTO 라도, 특정 필드(discriminator) 값에 따라 입력 엔티티의 어떤
// 필드/object/엣지가 "있는지"가 갈린다. 좌상단 셀렉터로 값을 고르면, 그 변형에
// 없는 필드·엣지를 흐리게(dim) 표시한다 — 숨기지 않고 남겨 전체 구조를 비교하게.
// when 은 절 배열(절 사이 AND, 절 안 values 는 OR)이고, 각 절은 disc 키로
// 자기 discriminator 를 명시한다 — 값 이름이 discriminator 끼리 겹쳐도 안전.
import { fieldKey } from './highlight'
import type { AppNode } from './node-types'
import type { MappingEdge } from './edge-kind'
import type { Field, When } from './types'

// 그래프 안의 discriminator 하나 (엔티티 + 필드 경로 + 고를 수 있는 값들)
export type Discriminator = {
  nodeId: string
  nodeName: string
  path: string
  values: string[]
}

// (노드, discriminator 경로) 한 쌍을 식별하는 키 — when 절의 disc 도 이 형식.
export const discKey = (nodeId: string, path: string): string =>
  `${nodeId}::${path}`

// (discriminator, 값) 한 쌍의 색 조회 키
export const valueKey = (disc: string, value: string): string =>
  `${disc}::${value}`

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

// (discriminator, 값) 쌍마다 팔레트 슬롯을 매긴다. 키는 valueKey(disc, 값).
// 팔레트 인덱스는 "엔터티마다 0부터" 리셋한다 — 변형이 엔터티 내부 개념이라
// 색의 역할도 엔터티 안에서의 구분이고, 무엇보다 자기 엔터티 목록만 보는
// 모달(팝오버)과 그래프 전체를 보는 캔버스가 같은 색을 배정하게 된다.
// 한 엔터티 안의 값들은 팔레트 크기 안에선 서로 다른 색이 보장된다.
export function variantColors(
  discriminators: Discriminator[],
): Map<string, VariantColor> {
  const map = new Map<string, VariantColor>()
  let i = 0
  let lastNode: string | null = null
  for (const d of discriminators) {
    if (d.nodeId !== lastNode) {
      i = 0
      lastNode = d.nodeId
    }
    const dk = discKey(d.nodeId, d.path)
    for (const v of d.values) {
      map.set(valueKey(dk, v), VARIANT_PALETTE[i % VARIANT_PALETTE.length])
      i++
    }
  }
  return map
}

// when(조건) 이 현재 선택(disc 키 → 값)에 비춰 "있는가".
// 절 사이는 AND, 절 안 values 는 OR. when 이 없으면 항상 있음(공통).
// 절이 가리키는 discriminator 가 그래프에 없으면(삭제됨 등) 그 절은 무시한다
// — 편집 도중 조건부 필드가 통째로 흐려져 버리지 않게 관대하게 처리.
export function matchWhen(
  when: When | undefined,
  active: ReadonlyMap<string, string>,
): boolean {
  if (!when || when.length === 0) return true
  return when.every((c) => {
    const cur = active.get(c.disc)
    return cur === undefined || c.values.includes(cur)
  })
}

// ── 모달 편집 지원 ────────────────────────────────────────────────────
// 새 엔터티는 노드 id 가 저장 시점에 만들어지므로, 모달에서 자기 discriminator 를
// 참조하는 when 은 disc 를 "$self::경로" 로 임시로 담는다. 실제 id 의 허용 문자
// (영문·숫자·_·-)에 '$' 가 없어 진짜 노드 id 와 충돌하지 않는다.
export const SELF_NODE = '$self'

// 저장 직전 "$self::" 참조를 실제 노드 id 로 치환한 새 필드 트리를 만든다.
export function assignSelfDiscs(fields: Field[], id: string): Field[] {
  const prefix = `${SELF_NODE}::`
  const fix = (list: Field[]): Field[] =>
    list.map((f) => ({
      ...f,
      ...(f.when
        ? {
            when: f.when.map((c) =>
              c.disc.startsWith(prefix)
                ? { ...c, disc: `${id}::${c.disc.slice(prefix.length)}` }
                : c,
            ),
          }
        : {}),
      ...(f.children?.length ? { children: fix(f.children) } : {}),
    }))
  return fix(fields)
}

// 현재 변형 선택(active: disc 키 → 값)에서 "없는" 필드/엣지를 계산한다.
//  - 필드 : when 이 안 맞으면 dim. 조상이 dim 이면 하위도 모두 dim(object 통째 사라짐).
//  - 엣지 : 양 끝 필드 중 하나라도 dim 이면 dim (엣지 자체 조건은 없다).
export function computeDimmed(
  nodes: AppNode[],
  edges: MappingEdge[],
  active: ReadonlyMap<string, string>,
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
    const srcDim = fields.has(fieldKey(e.source, e.sourceHandle ?? ''))
    const tgtDim = fields.has(fieldKey(e.target, e.targetHandle ?? ''))
    if (srcDim || tgtDim) edgeIds.add(e.id)
  }
  return { fields, edges: edgeIds }
}
