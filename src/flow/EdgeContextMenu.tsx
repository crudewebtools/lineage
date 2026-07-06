import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import type { MappingEdge } from './edge-kind'
import type { MappingKind } from './types'

const TYPE_OPTIONS: { kind: MappingKind; label: string; dash: boolean }[] = [
  { kind: 'keep', label: '유지 (실선)', dash: false },
  { kind: 'transform', label: '가공 (점선)', dash: true },
]

// 엣지 클릭 시 뜨는 컨텍스트 메뉴 — 라벨 수정 · 타입 변경 · 삭제.
// (엣지에는 when 이 없다 — 조건부 필드에 걸린 엣지는 끝 필드를 따라 흐려진다)
// 편집 중에는 떠 있고, 삭제·바깥 클릭·Esc 로 닫힌다.
// 위치는 렌더 후 실제 크기를 재서 스스로 잡는다 — 아래 공간이 모자라면 커서
// 위로 뒤집고(flip) 그래도 넘치면 컨테이너 안으로 클램프한다.
export function EdgeContextMenu({
  edge,
  x,
  y,
  onChangeKind,
  onChangeLabel,
  onDelete,
  onClose,
}: {
  edge: MappingEdge
  x: number
  y: number
  onChangeKind: (kind: MappingKind) => void
  onChangeLabel: (label: string) => void
  onDelete: () => void
  onClose: () => void
}) {
  const currentKind = edge.data?.kind ?? 'keep'
  const label = typeof edge.label === 'string' ? edge.label : ''

  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: y, left: x })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 렌더 직후(페인트 전) 실제 크기를 재서 위치 확정 — 깜빡임 없음.
  // 메뉴 내용(라벨·타입·삭제)의 높이는 열려 있는 동안 변하지 않으므로
  // 커서 좌표가 바뀔 때만 다시 계산한다.
  useLayoutEffect(() => {
    const el = ref.current
    const pane = el?.offsetParent as HTMLElement | null
    if (!el || !pane) return
    const menuW = el.offsetWidth
    const menuH = el.offsetHeight
    // 아래가 모자라면 커서 위로 뒤집고, 위도 모자라면 아래쪽 기준으로 클램프
    let top = y
    if (y + menuH > pane.clientHeight)
      top = y - menuH >= 0 ? y - menuH : Math.max(0, pane.clientHeight - menuH)
    const left = Math.max(0, Math.min(x, pane.clientWidth - menuW))
    setPos({ top, left })
  }, [x, y])

  return (
    <div
      ref={ref}
      className="absolute z-50 w-64 overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-md"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 라벨 수정 */}
      <div className="px-2 py-2">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          라벨
        </span>
        <input
          autoFocus
          value={label}
          onChange={(e) => onChangeLabel(e.target.value)}
          onKeyDown={(e) => {
            // IME 조합 확정용 Enter 는 무시 — 한글 라벨 입력 중 메뉴가 닫히는 것 방지
            if (e.nativeEvent.isComposing) return
            if (e.key === 'Enter') onClose()
          }}
          placeholder="라벨 입력…"
          className="h-7 w-full rounded border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="h-px bg-border" />

      {/* 타입 변경 */}
      <div className="px-1 py-1">
        <span className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          타입
        </span>
        {TYPE_OPTIONS.map((o) => (
          <button
            key={o.kind}
            type="button"
            onClick={() => onChangeKind(o.kind)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
          >
            <svg
              width="20"
              height="6"
              viewBox="0 0 20 6"
              className="shrink-0 text-muted-foreground"
            >
              <line
                x1="0"
                y1="3"
                x2="20"
                y2="3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray={o.dash ? '4 3' : undefined}
              />
            </svg>
            <span className="flex-1">{o.label}</span>
            {currentKind === o.kind && <Check className="size-3.5 text-foreground" />}
          </button>
        ))}
      </div>

      <div className="h-px bg-border" />

      {/* 삭제 */}
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-3.5" />
        삭제
      </button>
    </div>
  )
}
