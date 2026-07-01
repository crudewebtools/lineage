import { GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { discKey, type Discriminator, type VariantColor } from './variant'

// 좌상단 변형 셀렉터 — discriminator 마다 드롭다운 하나.
// 값을 바꾸면 그 변형에 없는 필드·엣지가 캔버스에서 흐려진다.
// discriminator 가 하나도 없으면 아무것도 렌더하지 않는다(깔끔한 캔버스).
export function VariantControl({
  discriminators,
  selections,
  colors,
  onChange,
}: {
  discriminators: Discriminator[]
  selections: Record<string, string>
  colors: ReadonlyMap<string, VariantColor>
  onChange: (key: string, value: string) => void
}) {
  if (!discriminators.length) return null
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card/90 p-2 text-xs shadow-sm backdrop-blur">
      <div className="flex items-center gap-1 font-medium text-muted-foreground">
        <GitBranch className="size-3" />
        입력 변형
      </div>
      {discriminators.map((d) => {
        const key = discKey(d.nodeId, d.path)
        const value = selections[key] ?? d.values[0]
        return (
          <label key={key} className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted-foreground">
              {d.nodeName}.{d.path}
            </span>
            <select
              value={value}
              onChange={(e) => onChange(key, e.target.value)}
              className={cn(
                'ml-auto rounded border border-border bg-background px-1.5 py-0.5 font-medium focus:outline-none focus:ring-1 focus:ring-ring',
                // 현재 값의 색으로 물들여 필드 배지와 눈으로 연결되게 한다
                colors.get(value)?.text ?? 'text-foreground',
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
  )
}
