import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { KeyRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { KIND_META } from './entity-kind'
import type { EntityData, Field } from './types'

export type EntityNodeType = Node<EntityData, 'entity'>

// 모든 필드 행이 양쪽에 핸들을 가진다(좌=target, 우=source).
// overflow-hidden 부모에 가려지지 않도록 X 이동 없이 모서리 안쪽에 붙인다.
const handleStyle = {
  width: 8,
  height: 8,
  background: 'var(--muted-foreground)',
  border: '2px solid var(--background)',
  transform: 'translateY(-50%)',
}

function FieldRow({
  field,
  depth,
  path,
}: {
  field: Field
  depth: number
  /** 필드 경로 — 핸들 id 로 쓰여 필드 단위 연결을 가능하게 한다 */
  path: string
}) {
  const children = field.children ?? []
  return (
    <>
      <div
        className="relative flex items-center gap-2 border-t border-border/60 py-1.5 pr-3 text-xs hover:bg-accent/40"
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        {/* 도착 핸들 (왼쪽) */}
        <Handle type="target" position={Position.Left} id={path} style={handleStyle} />

        {field.pk && <KeyRound className="size-3 shrink-0 text-amber-500" />}
        <span className="font-medium">{field.name}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {field.type}
          {field.nullable ? '?' : ''}
        </span>

        {/* 출발 핸들 (오른쪽) */}
        <Handle type="source" position={Position.Right} id={path} style={handleStyle} />
      </div>

      {children.map((child) => (
        <FieldRow
          key={child.name}
          field={child}
          depth={depth + 1}
          path={`${path}.${child.name}`}
        />
      ))}
    </>
  )
}

export function EntityNode({ data }: NodeProps<EntityNodeType>) {
  const meta = KIND_META[data.kind]
  const Icon = meta.icon
  return (
    <div className="min-w-[220px] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-md">
      {/* 헤더: 종류 아이콘 + 엔티티 이름 + 종류 라벨 */}
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

      {/* 필드 목록 */}
      <div className="py-0.5">
        {data.fields.map((field) => (
          <FieldRow key={field.name} field={field} depth={0} path={field.name} />
        ))}
      </div>
    </div>
  )
}
