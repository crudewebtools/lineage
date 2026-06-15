import { cn } from '@/lib/utils'
import type { MappingKind } from './types'

const OPTIONS: { kind: MappingKind; label: string; dash: boolean }[] = [
  { kind: 'keep', label: '유지', dash: false },
  { kind: 'transform', label: '가공', dash: true },
]

// 새로 그릴 엣지의 종류(유지/가공)를 고르는 토글. 미니 라인이 범례 역할도 한다.
export function EdgeKindControl({
  value,
  onChange,
}: {
  value: MappingKind
  onChange: (kind: MappingKind) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card/90 p-1 text-xs shadow-sm backdrop-blur">
      <span className="px-1 text-muted-foreground">새 엣지</span>
      {OPTIONS.map((o) => (
        <button
          key={o.kind}
          type="button"
          onClick={() => onChange(o.kind)}
          className={cn(
            'flex items-center gap-1.5 rounded px-2 py-1 transition-colors',
            value === o.kind
              ? 'bg-accent font-medium text-foreground'
              : 'text-muted-foreground hover:bg-accent/50',
          )}
        >
          <svg width="22" height="6" viewBox="0 0 22 6" className="shrink-0">
            <line
              x1="0"
              y1="3"
              x2="22"
              y2="3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray={o.dash ? '4 3' : undefined}
            />
          </svg>
          {o.label}
        </button>
      ))}
    </div>
  )
}
