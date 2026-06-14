import { ChevronLeft, ChevronRight, KeyRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KIND_META } from './entity-kind'
import type { EntityNodeType } from './EntityNode'
import type { EntityData, Field } from './types'

// 중첩 필드까지 모두 합한 개수
function countFields(fields: Field[]): number {
  return fields.reduce(
    (sum, f) => sum + 1 + (f.children ? countFields(f.children) : 0),
    0,
  )
}

type EntityPanelProps = {
  nodes: EntityNodeType[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClear: () => void
}

export function EntityPanel({
  nodes,
  selectedId,
  onSelect,
  onClear,
}: EntityPanelProps) {
  const selected = nodes.find((n) => n.id === selectedId)

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      {selected ? (
        <EntityDetail data={selected.data} onBack={onClear} />
      ) : (
        <EntityList nodes={nodes} onSelect={onSelect} />
      )}
    </aside>
  )
}

// 목록 뷰
function EntityList({
  nodes,
  onSelect,
}: {
  nodes: EntityNodeType[]
  onSelect: (id: string) => void
}) {
  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Entities</h2>
        <Badge variant="secondary" className="text-[10px]">
          {nodes.length}
        </Badge>
      </header>
      <div className="flex-1 overflow-y-auto p-2">
        {nodes.map((node) => {
          const meta = KIND_META[node.data.kind]
          const Icon = meta.icon
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node.id)}
              className="group flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left hover:bg-accent"
            >
              <span className="flex w-full items-center gap-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">
                  {node.data.name}
                </span>
                <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
              </span>
              <span className="pl-6 text-xs text-muted-foreground">
                {meta.label} · {countFields(node.data.fields)} fields
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}

// 상세 뷰 — 필드명 + 타입 (중첩은 indent)
function EntityDetail({
  data,
  onBack,
}: {
  data: EntityData
  onBack: () => void
}) {
  const meta = KIND_META[data.kind]
  const Icon = meta.icon
  return (
    <>
      <header className="border-b border-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-1 h-7 gap-1 px-2 text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
          Entities
        </Button>
        <div className="flex items-center gap-2 px-2 pb-1">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{data.name}</span>
          <Badge variant="outline" className="ml-auto text-[10px] font-normal">
            {meta.label}
          </Badge>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Fields · {countFields(data.fields)}
        </p>
        {data.fields.map((field) => (
          <PanelFieldRow key={field.name} field={field} depth={0} />
        ))}
      </div>
    </>
  )
}

function PanelFieldRow({ field, depth }: { field: Field; depth: number }) {
  const children = field.children ?? []
  return (
    <>
      <div
        className="flex items-center gap-2 rounded-sm py-1 pr-2 hover:bg-accent/50"
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {field.pk && <KeyRound className="size-3 shrink-0 text-amber-500" />}
        <span className="truncate text-sm">{field.name}</span>
        <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
          {field.type}
          {field.nullable ? '?' : ''}
        </span>
      </div>
      {children.map((child) => (
        <PanelFieldRow key={child.name} field={child} depth={depth + 1} />
      ))}
    </>
  )
}
