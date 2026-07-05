import { useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { KIND_META } from './entity-kind'
import { KINDS } from './code'
import { FieldTreeEditor } from './FieldTreeEditor'
import {
  buildRenames,
  collectLeafPaths,
  collectPaths,
  toDraft,
  toField,
  validate,
} from './field-draft'
import type { FieldChanges } from './EntityDialog'
import type { EntityKind, ProcessData } from './types'

// 변환/프로세스 노드(블랙박스) 생성·수정 모달.
// input(받기)·output(내보내기) 두 플랫 리스트를 나란히 편집한다.
// 핸들 경로가 in.<name>/out.<name> 한 단계라 중첩(object 하위)은 두지 않는다.
export function ProcessDialog({
  isNew,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  isNew: boolean
  initial: ProcessData | null
  // changes 의 경로는 핸들 경로(in./out. 접두 포함) 기준이다.
  onSave: (data: ProcessData, changes: FieldChanges) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<EntityKind>(initial?.kind ?? 'api')
  const [inputs, setInputs] = useState(() => toDraft(initial?.inputs ?? []))
  const [outputs, setOutputs] = useState(() => toDraft(initial?.outputs ?? []))
  // 열었을 때의 _k → 핸들 경로. 저장 시점과 비교해 개명을 알아낸다.
  const [origPaths] = useState(
    () => new Map([...collectPaths(inputs, 'in'), ...collectPaths(outputs, 'out')]),
  )
  const [error, setError] = useState<string | null>(null)
  // 삭제 버튼 2단계 확인 — 한 번 누르면 "정말 삭제" 로 바뀌고, 다시 누르면 삭제
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSave = () => {
    const nm = name.trim()
    if (!nm) return setError('프로세스 이름을 입력하세요')
    const ei = validate(inputs, 'input')
    if (ei) return setError(ei)
    const eo = validate(outputs, 'output')
    if (eo) return setError(eo)
    const nextPaths = new Map([
      ...collectPaths(inputs, 'in'),
      ...collectPaths(outputs, 'out'),
    ])
    onSave(
      {
        name: nm,
        kind,
        inputs: inputs.map(toField),
        outputs: outputs.map(toField),
      },
      {
        renames: buildRenames(origPaths, nextPaths),
        leafPaths: new Set([
          ...collectLeafPaths(inputs, 'in'),
          ...collectLeafPaths(outputs, 'out'),
        ]),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isNew ? '프로세스 생성' : '프로세스 수정'}</DialogTitle>
          <DialogDescription>
            입력을 받아 다른 출력을 내는 변환/프로세스 노드(블랙박스)입니다. 좌측
            input 은 받기만, 우측 output 은 내보내기만 합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-3">
          <Labeled label="이름" className="min-w-[180px] flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: RiskApi"
              className="h-9"
              autoFocus
            />
          </Labeled>
          <Labeled label="종류">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as EntityKind)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_META[k].label}
                </option>
              ))}
            </select>
          </Labeled>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
          <FieldTreeEditor
            title="input (받기)"
            addLabel="입력 추가"
            fields={inputs}
            setFields={setInputs}
            nested={false}
          />
          <FieldTreeEditor
            title="output (내보내기)"
            addLabel="출력 추가"
            fields={outputs}
            setFields={setOutputs}
            nested={false}
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          {onDelete && (
            <Button
              variant={confirmDelete ? 'destructive' : 'outline'}
              size="sm"
              className={cn(
                'sm:mr-auto',
                !confirmDelete && 'text-destructive hover:text-destructive',
              )}
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            >
              <Trash2 />
              {confirmDelete ? '정말 삭제 (연결 엣지 포함)' : '삭제'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button size="sm" onClick={handleSave}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Labeled({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
