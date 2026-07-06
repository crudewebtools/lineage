import { cn } from '@/lib/utils'
import { discKey, valueKey, type VariantColor } from './variant'
import type { DraftDiscOption, DraftWhenClause } from './field-draft'

// when(조건 절) 편집 코어 — discriminator 별 값 토글 그룹.
// 같은 그룹 안은 OR(values), 여러 그룹에 걸치면 AND(절 추가), 모두 해제 = 공통.
// 입력 변형은 엔터티 내부 개념이라 discOptions 는 "자기 엔터티" 것만 온다.
// 절은 discriminator 행의 _k(정체성)로 이어져 있어 개명·일시적 이름 충돌과
// 무관하게 항상 올바른 필드를 가리킨다. 모델과 1:1 이라 invalid 한 when
// (없는 disc·없는 값·빈 절)을 만들 수 없다.
// colors 는 호출자가 "필터 전 전체 목록" 으로 계산해 넘긴다 — 여기서(필터된
// 목록으로) 다시 계산하면 자기 자신이 빠진 만큼 인덱스가 밀려 캔버스와 어긋난다.
export function WhenPicker({
  when,
  discOptions,
  colors,
  onChange,
}: {
  when: DraftWhenClause[] | undefined
  discOptions: DraftDiscOption[]
  colors: ReadonlyMap<string, VariantColor>
  onChange: (when: DraftWhenClause[] | undefined) => void
}) {
  // 토글 — 현재 체크 상태를 뒤집고, 절을 discOptions 순서로 재구성한다.
  // (목록에 없는 discK 의 절은 유령 — 저장 변환에서도 정리되므로 여기서도 버린다)
  const toggle = (opt: DraftDiscOption, value: string) => {
    const checked = new Map(
      (when ?? []).map((c) => [c.discK, new Set(c.values)]),
    )
    const set = checked.get(opt.k) ?? new Set<string>()
    if (set.has(value)) set.delete(value)
    else set.add(value)
    checked.set(opt.k, set)
    const next: DraftWhenClause[] = []
    for (const o of discOptions) {
      const vals = o.values.filter((v) => checked.get(o.k)?.has(v))
      if (vals.length) next.push({ discK: o.k, values: vals })
    }
    onChange(next.length ? next : undefined)
  }

  const isChecked = (opt: DraftDiscOption, value: string) =>
    when?.some((c) => c.discK === opt.k && c.values.includes(value)) ?? false

  if (!discOptions.length)
    return (
      <p className="text-[10px] text-muted-foreground">
        이 엔터티에 분기 기준(discriminator) 필드가 없습니다.
      </p>
    )

  return (
    <>
      {discOptions.map((opt) => (
        <div key={opt.k} className="flex flex-wrap items-center gap-1">
          <span className="font-mono text-[10px] text-muted-foreground">
            {opt.nodeName}.{opt.path}
          </span>
          {opt.values.map((v) => {
            const on = isChecked(opt, v)
            const color = colors.get(
              valueKey(discKey(opt.nodeId, opt.path), v),
            )?.badge
            return (
              <button
                key={v}
                type="button"
                onClick={() => toggle(opt, v)}
                className={cn(
                  'rounded border px-1.5 py-0.5 font-mono text-[10px]',
                  on
                    ? (color ?? 'border-sky-500/40 text-sky-600')
                    : 'border-border/60 text-muted-foreground/50 hover:text-foreground',
                )}
              >
                {v}
              </button>
            )
          })}
        </div>
      ))}
    </>
  )
}
