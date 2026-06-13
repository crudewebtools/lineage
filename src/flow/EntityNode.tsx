import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { KeyRound, Link2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { EntityData, Field } from './types'

export type EntityNodeType = Node<EntityData, 'entity'>

const KIND_LABEL: Record<EntityData['kind'], string> = {
  table: 'table',
  collection: 'collection',
  document: 'document',
}

// overflow-hidden 부모에 가려지지 않도록 핸들을 모서리 "안쪽"에 붙인다.
// (기본 react-flow 핸들은 모서리 바깥으로 50% 튀어나와 클리핑됨)
const handleStyle = {
  width: 9,
  height: 9,
  background: 'var(--primary)',
  border: '2px solid var(--background)',
  transform: 'translateY(-50%)',
}

function FieldRow({ field, depth }: { field: Field; depth: number }) {
  const children = field.children ?? []
  return (
    <>
      <div
        className="relative flex items-center gap-2 border-t border-border/60 py-1.5 pr-3 text-xs hover:bg-accent/40"
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        {field.pk && <KeyRound className="size-3 shrink-0 text-amber-500" />}
        {field.ref && !field.pk && (
          <Link2 className="size-3 shrink-0 text-primary" />
        )}
        <span className="font-medium">{field.name}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {field.type}
          {field.nullable ? '?' : ''}
        </span>

        {/* 참조 필드 → 연결선 출발 핸들 (행 오른쪽) */}
        {field.ref && (
          <Handle
            type="source"
            position={Position.Right}
            id={field.name}
            style={handleStyle}
          />
        )}
      </div>

      {children.map((child) => (
        <FieldRow key={child.name} field={child} depth={depth + 1} />
      ))}
    </>
  )
}

export function EntityNode({ data }: NodeProps<EntityNodeType>) {
  return (
    <div className="min-w-[210px] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-md">
      {/* 헤더: 엔티티 이름 + 종류 */}
      <div className="relative flex items-center gap-2 bg-muted/60 px-3 py-2">
        <span className="text-sm font-semibold">{data.name}</span>
        <Badge
          variant="outline"
          className="ml-auto bg-background/60 text-[10px] font-normal"
        >
          {KIND_LABEL[data.kind]}
        </Badge>

        {/* 연결선 도착 핸들 (헤더 왼쪽) */}
        <Handle type="target" position={Position.Left} style={handleStyle} />
      </div>

      {/* 필드 목록 */}
      <div className="py-0.5">
        {data.fields.map((field) => (
          <FieldRow key={field.name} field={field} depth={0} />
        ))}
      </div>
    </div>
  )
}
