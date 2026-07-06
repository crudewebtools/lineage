import { useState } from 'react'
import { ChevronDown, ChevronRight, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  discKey,
  valueKey,
  type Discriminator,
  type VariantColor,
} from './variant'

// 좌상단 변형 셀렉터 — discriminator 마다 드롭다운 하나.
// 값을 바꾸면 그 변형에 없는 필드·엣지가 캔버스에서 흐려진다.
// discriminator 가 많으면 길게 늘어지므로 우상단 표시 패널처럼 헤더로 접을 수
// 있고, 본문은 스크롤된다. discriminator 가 하나도 없으면 렌더하지 않는다.
export function VariantControl({
  discriminators,
  selections,
  colors,
  onChange,
}: {
  discriminators: Discriminator[]
  /** 검증된 활성 선택(Flow 의 activeVariants) — 삭제된 enum 값은 이미 걸러져 있다 */
  selections: ReadonlyMap<string, string>
  colors: ReadonlyMap<string, VariantColor>
  onChange: (key: string, value: string) => void
}) {
  const [open, setOpen] = useState(true)
  if (!discriminators.length) return null

  return (
    <div className="w-60 overflow-hidden rounded-md border border-border bg-card/90 text-xs shadow-sm backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={open ? '목록 접기' : '목록 펴기'}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-accent/50"
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        <GitBranch className="size-3.5 shrink-0" />
        <span>입력 변형</span>
        <span className="ml-auto tabular-nums text-[11px]">
          {discriminators.length}
        </span>
      </button>

      {open && (
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto border-t border-border p-2">
          {discriminators.map((d) => {
            const key = discKey(d.nodeId, d.path)
            const value = selections.get(key) ?? d.values[0]
            return (
              <label key={key} className="flex items-center gap-1.5">
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {d.nodeName}.{d.path}
                </span>
                <select
                  value={value}
                  onChange={(e) => onChange(key, e.target.value)}
                  className={cn(
                    'ml-auto shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-medium focus:outline-none focus:ring-1 focus:ring-ring',
                    // 현재 값의 색으로 물들여 필드 배지와 눈으로 연결되게 한다
                    colors.get(valueKey(key, value))?.text ?? 'text-foreground',
                  )}
                >
                  {d.values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
