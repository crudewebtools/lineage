import { useState } from 'react'
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KIND_META } from './entity-kind'
import type { AppNode } from './node-types'

// 우상단 표시 패널 — 노드(엔터티/프로세스) 목록에서 눈 아이콘으로 숨기기/보이기.
// 목록이 길어질 수 있어 헤더로 접을 수 있고, 본문은 스크롤된다.
// 노드를 숨겨도 데이터는 그대로 두고 화면에서만 가린다(연결 엣지도 함께 사라진다).
export function NodeVisibilityPanel({
  nodes,
  onToggle,
  onShowAll,
}: {
  nodes: AppNode[]
  onToggle: (id: string) => void
  onShowAll: () => void
}) {
  const [open, setOpen] = useState(true)
  if (!nodes.length) return null

  const hiddenCount = nodes.filter((n) => n.hidden).length
  const visibleCount = nodes.length - hiddenCount

  return (
    <div className="w-52 overflow-hidden rounded-md border border-border bg-card/90 text-xs shadow-sm backdrop-blur">
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
        <Eye className="size-3.5 shrink-0" />
        <span>표시</span>
        <span className="ml-auto tabular-nums text-[11px]">
          {visibleCount}/{nodes.length}
        </span>
      </button>

      {open && (
        <div className="border-t border-border">
          <ul className="max-h-64 overflow-y-auto py-1">
            {nodes.map((n) => {
              const Icon = KIND_META[n.data.kind].icon
              const isHidden = !!n.hidden
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(n.id)}
                    title={isHidden ? '보이기' : '숨기기'}
                    className={cn(
                      'flex w-full items-center gap-1.5 px-2 py-1 text-left transition-colors hover:bg-accent/60',
                      isHidden && 'opacity-45',
                    )}
                  >
                    <Icon className="size-3 shrink-0 text-muted-foreground" />
                    <span className={cn('truncate', isHidden && 'line-through')}>
                      {n.data.name}
                    </span>
                    {n.type === 'process' && (
                      <span className="shrink-0 rounded bg-muted px-1 text-[9px] text-muted-foreground">
                        P
                      </span>
                    )}
                    {isHidden ? (
                      <EyeOff className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Eye className="ml-auto size-3.5 shrink-0 text-muted-foreground/70" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={onShowAll}
              className="flex w-full items-center justify-center gap-1 border-t border-border py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent/60"
            >
              <Eye className="size-3" /> 모두 보이기 ({hiddenCount})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
