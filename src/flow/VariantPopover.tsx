import { useMemo, useState } from 'react'
import { GitBranch, Plus, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { WhenPicker } from './WhenPicker'
import { variantColors } from './variant'
import type { DraftDiscOption, DraftField } from './field-draft'

// 필드행의 입력 변형 설정 팝오버 (엔터티 모달 전용).
//  - 분기 기준: discriminator 토글 + enumValues 칩 (1개 이상·중복 불가)
//  - 조건부 존재: WhenPicker(discriminator 별 값 토글 — 그룹 안 OR·그룹 간 AND)
// when 절은 discriminator 행의 _k 로 이어져 있어 개명 추적이 필요 없다.
export function VariantPopover({
  field: f,
  discOptions,
  onPatch,
}: {
  field: DraftField
  discOptions: DraftDiscOption[]
  onPatch: (patch: Partial<DraftField>) => void
}) {
  const [valueInput, setValueInput] = useState('')
  const active = Boolean(f.discriminator || f.when?.length)
  // 자기 자신이 discriminator 여도 자기 존재 조건으로는 못 쓴다 — 다른 값을
  // 고르면 분기 기준 필드 자체가 사라지는 모순이 생기기 때문. _k 비교라
  // 이름이 무엇이든(일시적 중복 포함) 정확히 자기 행만 빠진다.
  const whenOptions = discOptions.filter((d) => d.k !== f._k)
  // 색은 "필터 전 전체 목록" 기준 — 자기 자신을 뺀 목록으로 계산하면 뒤쪽
  // discriminator 의 팔레트 인덱스가 밀려 캔버스 배지 색과 어긋난다.
  const colors = useMemo(() => variantColors(discOptions), [discOptions])

  const addValue = () => {
    const v = valueInput.trim()
    if (!v) return
    const cur = f.enumValues ?? []
    if (!cur.includes(v)) onPatch({ enumValues: [...cur, v] })
    setValueInput('')
  }
  const removeValue = (v: string) => {
    const next = (f.enumValues ?? []).filter((x) => x !== v)
    onPatch({ enumValues: next.length ? next : undefined })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="입력 변형 설정 (분기 기준 · 조건부 존재)"
          className="p-1"
        >
          <GitBranch
            className={cn(
              'size-3.5',
              active ? 'text-sky-500' : 'text-muted-foreground/40',
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-3 text-xs">
        {/* ── 분기 기준 (discriminator) ── */}
        <div className="flex flex-col gap-1.5">
          <label className="flex cursor-pointer items-center gap-1.5 font-medium">
            <input
              type="checkbox"
              checked={Boolean(f.discriminator)}
              onChange={(e) =>
                onPatch({ discriminator: e.target.checked || undefined })
              }
            />
            분기 기준 (discriminator)
          </label>
          <p className="text-[10px] leading-snug text-muted-foreground">
            이 필드 값에 따라 다른 필드·엣지의 유무가 갈립니다.
          </p>
          {f.discriminator && (
            <>
              <div className="flex flex-wrap gap-1">
                {(f.enumValues ?? []).map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 font-mono"
                  >
                    {v}
                    <button
                      type="button"
                      title="값 삭제"
                      onClick={() => removeValue(v)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {!f.enumValues?.length && (
                  <span className="text-[10px] text-muted-foreground">
                    값을 1개 이상 추가하세요
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <Input
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  onKeyDown={(e) => {
                    // IME 조합 확정용 Enter 는 무시 — 조합 중간 값이 추가되는 것 방지
                    if (e.nativeEvent.isComposing) return
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addValue()
                    }
                  }}
                  placeholder="값 입력 후 Enter (예: NORMAL)"
                  className="h-7 flex-1 text-xs"
                />
                <button
                  type="button"
                  title="값 추가"
                  onClick={addValue}
                  className="rounded border border-border px-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── 조건부 존재 (when) ── */}
        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2">
          <span className="font-medium">조건부 존재 (when)</span>
          <p className="text-[10px] leading-snug text-muted-foreground">
            체크한 값일 때만 이 필드가 존재합니다. 같은 줄 안은 OR, 줄이 여러
            개면 AND. 모두 해제하면 모든 변형 공통.
          </p>
          <WhenPicker
            when={f.when}
            discOptions={whenOptions}
            colors={colors}
            onChange={(when) => onPatch({ when })}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
