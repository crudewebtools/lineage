import { useContext } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { EntityNodeContext } from './entity-node-context'
import { fieldKey } from './highlight'
import { KIND_META } from './entity-kind'
import type { ProcessNodeType } from './node-types'
import type { Field } from './types'

const handleStyle = {
  width: 8,
  height: 8,
  background: 'var(--muted-foreground)',
  border: '2px solid var(--background)',
  transform: 'translateY(-50%)',
}

// input/output 한 행. side 로 핸들 방향이 갈린다.
//  - in  : 왼쪽 target 핸들 (받기만). 핸들 id = `in.<name>`
//  - out : 오른쪽 source 핸들 (내보내기만). 핸들 id = `out.<name>`
function IoRow({
  nodeId,
  side,
  field,
}: {
  nodeId: string
  side: 'in' | 'out'
  field: Field
}) {
  const { onFieldHover, highlightedFields } = useContext(EntityNodeContext)
  const path = `${side}.${field.name}`
  const isHighlighted = highlightedFields.has(fieldKey(nodeId, path))
  return (
    <div
      className={cn(
        'relative flex items-center gap-2 border-t border-border/60 py-1.5 text-xs hover:bg-accent/40',
        // 핸들이 노드 바깥 가장자리에 앵커되도록 패딩은 행에 준다(내용만 안쪽으로 밀림)
        side === 'in' ? 'pl-3 pr-2' : 'pl-2 pr-3',
      )}
      onMouseEnter={() => onFieldHover(nodeId, path, true)}
      onMouseLeave={() => onFieldHover(nodeId, path, false)}
    >
      {side === 'in' && (
        <Handle type="target" position={Position.Left} id={path} style={handleStyle} />
      )}
      <span
        className={cn('font-medium', isHighlighted && 'font-bold text-foreground')}
      >
        {field.name}
      </span>
      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
        {field.type}
        {field.array ? '[]' : ''}
        {field.nullable ? '?' : ''}
      </span>
      {side === 'out' && (
        <Handle type="source" position={Position.Right} id={path} style={handleStyle} />
      )}
    </div>
  )
}

export function ProcessNode({ id, data }: NodeProps<ProcessNodeType>) {
  const meta = KIND_META[data.kind]
  const Icon = meta.icon
  return (
    <div className="min-w-[300px] overflow-hidden rounded-lg border border-dashed border-border bg-card text-card-foreground shadow-md">
      {/* 헤더: 종류 아이콘 + 이름 + 종류 라벨 */}
      <div className="flex items-center gap-2 bg-muted/60 px-3 py-2">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold">{data.name}</span>
        <Badge
          variant="outline"
          className="ml-auto bg-background/60 text-[10px] font-normal"
        >
          {meta.label}
        </Badge>
      </div>

      {/* 좌(input) / 우(output) 2단 — 가운데 점선으로 블랙박스 경계 */}
      <div className="grid grid-cols-2">
        <div className="border-r border-dashed border-border/70">
          <div className="px-3 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            input
          </div>
          <div className="pb-0.5">
            {data.inputs.map((f) => (
              <IoRow key={f.name} nodeId={id} side="in" field={f} />
            ))}
            {data.inputs.length === 0 && (
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground/60">
                —
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="px-3 pt-1.5 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            output
          </div>
          <div className="pb-0.5">
            {data.outputs.map((f) => (
              <IoRow key={f.name} nodeId={id} side="out" field={f} />
            ))}
            {data.outputs.length === 0 && (
              <div className="px-3 py-1.5 text-right text-[10px] text-muted-foreground/60">
                —
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
