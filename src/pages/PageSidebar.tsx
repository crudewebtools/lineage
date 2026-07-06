import { useRef, useState } from 'react'
import {
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { PageRecord } from './db'
import type { ImportMode, ImportResult } from './use-pages'

// 왼쪽 사이드바 — 페이지(그래프 하나 = 페이지 하나) 목록.
// 오른쪽 SidePanel 과 대칭 패턴: 접으면 아이콘 바, 펼치면 목록.
export function PageSidebar({
  pages,
  currentId,
  onSelect,
  onCreate,
  onRename,
  onRemove,
  onExport,
  onImport,
}: {
  pages: PageRecord[]
  currentId: string
  onSelect: (id: string) => void
  onCreate: () => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
  onExport: () => void
  onImport: (file: File, mode: ImportMode) => Promise<ImportResult>
}) {
  const [collapsed, setCollapsed] = useState(false)
  // 인라인 이름 변경 중인 페이지 (null = 없음)
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(
    null,
  )
  // 가져오기 팝오버 열림 상태 + 파일 선택 대기 중인 방식
  const [importOpen, setImportOpen] = useState(false)
  const pendingMode = useRef<ImportMode>('merge')
  const fileInput = useRef<HTMLInputElement>(null)

  const commitRename = () => {
    if (!editing) return
    const name = editing.draft.trim()
    if (name) onRename(editing.id, name)
    setEditing(null)
  }

  // 방식을 고르면 파일 선택창을 연다. 덮어쓰기는 파괴적이라 먼저 확인받는다.
  const pickFile = (mode: ImportMode) => {
    if (
      mode === 'overwrite' &&
      !window.confirm(
        '모든 페이지를 파일 내용으로 덮어씁니다 — 현재 페이지는 사라집니다. 계속할까요?',
      )
    )
      return
    setImportOpen(false)
    pendingMode.current = mode
    fileInput.current?.click()
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일 재선택도 change 가 발화하도록 초기화
    if (!file) return
    const res = await onImport(file, pendingMode.current)
    if (res.ok) {
      const extra = res.skipped ? ` (건너뜀 ${res.skipped}개)` : ''
      window.alert(`${res.imported}개 페이지를 가져왔습니다${extra}.`)
    } else {
      const msg = {
        read: '파일을 읽지 못했습니다.',
        format: '올바른 lineage 백업 파일이 아닙니다.',
        empty: '가져올 페이지가 없습니다.',
        storage: '저장소에 쓰지 못했습니다.',
        busy: '이미 가져오기가 진행 중입니다.',
      }[res.reason]
      window.alert(msg)
    }
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
          title="모든 페이지 내보내기"
          onClick={onExport}
        >
          <Download className="size-4" />
        </Button>
        <Popover open={importOpen} onOpenChange={setImportOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="백업 파일 가져오기"
            >
              <Upload className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-1.5">
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => pickFile('merge')}
            >
              <span className="font-medium">병합으로 가져오기</span>
              <span className="block text-xs text-muted-foreground">
                현재 페이지는 그대로, 뒤에 추가
              </span>
            </button>
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => pickFile('overwrite')}
            >
              <span className="font-medium">덮어쓰기로 가져오기</span>
              <span className="block text-xs text-muted-foreground">
                기존 페이지를 전부 교체
              </span>
            </button>
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title="패널 접기"
          onClick={() => setCollapsed(true)}
        >
          <PanelLeftClose className="size-4" />
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onFileChange}
        />
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
