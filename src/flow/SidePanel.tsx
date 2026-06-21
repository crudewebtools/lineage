import { useState, type Dispatch, type SetStateAction } from 'react'
import {
  Boxes,
  ChevronLeft,
  Code2,
  PanelRightClose,
  PanelRightOpen,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EntityEditor } from './EntityEditor'
import { CodeEditor } from './CodeEditor'
import type { EntityNodeType } from './EntityNode'
import type { MappingEdge } from './edge-kind'

type View = 'menu' | 'entities' | 'code'

const FEATURES: {
  id: Exclude<View, 'menu'>
  label: string
  desc: string
  icon: LucideIcon
  ready: boolean
}[] = [
  { id: 'entities', label: '엔터티', desc: '추가 · 수정', icon: Boxes, ready: true },
  {
    id: 'code',
    label: '코드',
    desc: '전체 JSON 편집 · 적용',
    icon: Code2,
    ready: true,
  },
]

export function SidePanel({
  nodes,
  setNodes,
  edges,
  setEdges,
}: {
  nodes: EntityNodeType[]
  setNodes: Dispatch<SetStateAction<EntityNodeType[]>>
  edges: MappingEdge[]
  setEdges: Dispatch<SetStateAction<MappingEdge[]>>
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [view, setView] = useState<View>('menu')

  if (collapsed) {
    return (
      <aside className="flex h-full w-10 shrink-0 flex-col items-center border-l border-border bg-card py-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="패널 펼치기"
          onClick={() => setCollapsed(false)}
        >
          <PanelRightOpen className="size-4" />
        </Button>
      </aside>
    )
  }

  const active = FEATURES.find((f) => f.id === view)

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <header className="flex items-center gap-1 border-b border-border px-2 py-2">
        {view !== 'menu' && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title="메뉴로"
            onClick={() => setView('menu')}
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}
        <span className="px-1 text-sm font-semibold">
          {view === 'menu' ? '도구' : active?.label}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          title="패널 접기"
          onClick={() => setCollapsed(true)}
        >
          <PanelRightClose className="size-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {view === 'menu' && <Menu onOpen={setView} />}
        {view === 'entities' && (
          <EntityEditor nodes={nodes} setNodes={setNodes} />
        )}
        {view === 'code' && (
          <CodeEditor
            nodes={nodes}
            setNodes={setNodes}
            edges={edges}
            setEdges={setEdges}
          />
        )}
      </div>
    </aside>
  )
}

function Menu({ onOpen }: { onOpen: (v: View) => void }) {
  return (
    <div className="flex flex-col gap-1.5 p-2">
      {FEATURES.map((f) => {
        const Icon = f.icon
        return (
          <button
            key={f.id}
            type="button"
            disabled={!f.ready}
            onClick={() => f.ready && onOpen(f.id)}
            className={cn(
              'flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left transition-colors',
              f.ready
                ? 'hover:bg-accent'
                : 'cursor-not-allowed opacity-50',
            )}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex flex-col">
              <span className="text-sm font-medium">
                {f.label}
                {!f.ready && ' (준비 중)'}
              </span>
              <span className="text-xs text-muted-foreground">{f.desc}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
