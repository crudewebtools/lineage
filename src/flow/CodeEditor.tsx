import { useState, type Dispatch, type SetStateAction } from 'react'
import { AlertCircle, Check, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EntityNodeType } from './EntityNode'
import type { MappingEdge } from './edge-kind'
import { codeToGraph, graphToCode } from './code'

// 그래프 전체를 JSON 으로 편집한다. 실시간이 아니라 "적용" 을 눌러야 반영되고,
// 반영 전에 codeToGraph 로 검증한다 (구조 / 종류 / 엔티티·필드 참조).
export function CodeEditor({
  nodes,
  edges,
  setNodes,
  setEdges,
}: {
  nodes: EntityNodeType[]
  setNodes: Dispatch<SetStateAction<EntityNodeType[]>>
  edges: MappingEdge[]
  setEdges: Dispatch<SetStateAction<MappingEdge[]>>
}) {
  // 마운트 시점의 그래프 스냅샷을 코드로 적재 (이후 캔버스 변경은 자동 반영 안 함)
  const [text, setText] = useState(() => graphToCode(nodes, edges))
  const [errors, setErrors] = useState<string[]>([])
  const [applied, setApplied] = useState(false)

  const edit = (next: string) => {
    setText(next)
    setApplied(false)
    if (errors.length) setErrors([])
  }

  const apply = () => {
    const res = codeToGraph(text)
    if (!res.ok) {
      setErrors(res.errors)
      setApplied(false)
      return
    }
    setErrors([])
    setNodes(res.nodes)
    setEdges(res.edges)
    setApplied(true)
  }

  const reload = () => {
    setText(graphToCode(nodes, edges))
    setErrors([])
    setApplied(false)
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <p className="text-xs leading-relaxed text-muted-foreground">
        그래프 전체를 JSON 으로 편집합니다. <b className="text-foreground">적용</b> 을
        눌러야 반영되며, 반영 전 검증을 거칩니다.
      </p>

      <textarea
        value={text}
        onChange={(e) => edit(e.target.value)}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none rounded-md border border-input bg-transparent p-2 font-mono text-[11px] leading-relaxed outline-none focus:ring-1 focus:ring-ring"
      />

      {errors.length > 0 && (
        <div className="max-h-44 shrink-0 overflow-y-auto rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          <p className="mb-1 flex items-center gap-1 font-medium">
            <AlertCircle className="size-3.5" />
            검증 실패 ({errors.length})
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {applied && (
        <p className="flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs text-emerald-600">
          <Check className="size-3.5" />
          반영되었습니다.
        </p>
      )}

      <div className="flex shrink-0 gap-2">
        <Button size="sm" className="flex-1 gap-1" onClick={apply}>
          <Play className="size-3.5" />
          적용
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={reload}
          title="현재 캔버스 상태를 다시 불러옵니다"
        >
          <RotateCcw className="size-3.5" />
          되돌리기
        </Button>
      </div>
    </div>
  )
}
