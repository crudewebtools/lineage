import { useState } from 'react'
import {
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { PageRecord } from './db'

// 왼쪽 사이드바 — 페이지(그래프 하나 = 페이지 하나) 목록.
// 오른쪽 SidePanel 과 대칭 패턴: 접으면 아이콘 바, 펼치면 목록.
export function PageSidebar({
  pages,
  currentId,
  onSelect,
  onCreate,
  onRename,
  onRemove,
}: {
  pages: PageRecord[]
  currentId: string
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  // 인라인 이름 변경 중인 페이지 (null = 없음)
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(
    null,
  )

  const commitRename = () => {
    if (!editing) return
    const name = editing.draft.trim()
    if (name) onRename(editing.id, name)
    setEditing(null)
  }

  if (collapsed) {
    return (
      <aside className="flex h-full w-10 shrink-0 flex-col items-center border-r border-border bg-card py-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="페이지 목록 펼치기"
          onClick={() => setCollapsed(false)}
        >
          <PanelLeftOpen className="size-4" />
        </Button>
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-card">
      <header className="flex items-center gap-1 border-b border-border px-2 py-2">
        <span className="px-1 text-sm font-semibold">페이지</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          title="새 페이지"
          onClick={onCreate}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title="패널 접기"
          onClick={() => setCollapsed(true)}
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-1.5">
        {pages.map((p) =>
          editing?.id === p.id ? (
            <Input
              key={p.id}
              autoFocus
              value={editing.draft}
              className="h-8 text-sm"
              onChange={(e) => setEditing({ id: p.id, draft: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setEditing(null)
              }}
              onBlur={commitRename}
            />
          ) : (
            <div
              key={p.id}
              className={cn(
                'group flex items-center rounded-md',
                p.id === currentId ? 'bg-accent' : 'hover:bg-accent/50',
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm"
                title={p.name}
                onClick={() => onSelect(p.id)}
              >
                {p.name}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
                title="이름 변경"
                onClick={() => setEditing({ id: p.id, draft: p.name })}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="mr-1 size-6 shrink-0 opacity-0 group-hover:opacity-100"
                title="삭제"
                onClick={() => {
                  if (window.confirm(`"${p.name}" 페이지를 삭제할까요?`))
                    onRemove(p.id)
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ),
        )}
      </div>
    </aside>
  )
}
