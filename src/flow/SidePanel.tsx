import { useState, type Dispatch, type SetStateAction } from 'react'
import {
  Check,
  ChevronLeft,
  Code2,
  Link2,
  PanelRightClose,
  PanelRightOpen,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CodeEditor } from './CodeEditor'
import { buildShareUrl } from './share'
import type { AppNode } from './node-types'
import type { MappingEdge } from './edge-kind'

// 엔터티 추가·수정은 캔버스 모달(EntityDialog)로 옮겼고, 여기엔 코드 도구만 남는다.
type View = 'menu' | 'code'

const FEATURES: {
  id: Exclude<View, 'menu'>
  label: string
  desc: string
  icon: LucideIcon
  ready: boolean
}[] = [
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
  nodes: AppNode[]
  setNodes: Dispatch<SetStateAction<AppNode[]>>
  edges: MappingEdge[]
  setEdges: Dispatch<SetStateAction<MappingEdge[]>>
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [view, setView] = useState<View>('menu')
  const [copied, setCopied] = useState(false)

  // 현재 그래프를 ?g=... 쿼리가 담긴 풀 URL 로 만들어 클립보드에 복사한다.
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(nodes, edges))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      console.warn('[lineage] 클립보드 복사에 실패했습니다.')
    }
  }

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
          title={copied ? '복사됨!' : '공유 링크 복사 (?g=... 포함 URL)'}
          onClick={copyLink}
        >
          {copied ? (
            <Check className="size-4 text-emerald-500" />
          ) : (
            <Link2 className="size-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title="패널 접기"
          onClick={() => setCollapsed(true)}
        >
          <PanelRightClose className="size-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {view === 'menu' && <Menu onOpen={setView} />}
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
