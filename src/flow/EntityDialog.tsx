import { useMemo, useState, type ReactNode } from 'react'
import { GitBranch, Trash2 } from 'lucide-react'
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
  anyVariant,
  buildRenames,
  collectDraftDiscOptions,
  collectLeafPaths,
  collectPaths,
  draftsToFields,
  toDraft,
  validate,
} from './field-draft'
import { SELF_NODE } from './variant'
import type { EntityData, EntityKind } from './types'

// 저장 시 필드 편집 결과 요약 — 부모(Flow)가 참조 갱신·엣지 정리에 쓴다.
//  - renames  : 바뀐 필드 경로(옛 → 새). when.disc·엣지 핸들·접힘 상태 갱신용.
//  - leafPaths: 저장 후 연결 가능한(리프) 경로 전체. 개명을 반영해도 여기 없는
//               핸들의 엣지는 삭제·object 전환으로 무효 → 제거 대상.
export type FieldChanges = {
  renames: ReadonlyMap<string, string>
  leafPaths: ReadonlySet<string>
}

export function EntityDialog({
  isNew,
  initial,
  nodeId,
  onSave,
  onDelete,
  onClose,
}: {
  isNew: boolean
  initial: EntityData | null
  /** 수정 모드의 노드 id. 생성 모드는 null — 자기 참조는 $self 로 담고 저장 시 치환 */
  nodeId: string | null
  onSave: (data: EntityData, changes: FieldChanges) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const selfId = nodeId ?? SELF_NODE
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<EntityKind>(initial?.kind ?? 'etc')
  // draft 의 when 은 discriminator 행의 _k(정체성)를 참조하므로, 편집 중 개명·
  // 일시적 이름 충돌을 추적할 필요가 없다 — setFields 는 평범한 setState.
  const [fields, setFields] = useState(() =>
    toDraft(initial?.fields ?? [], nodeId ?? undefined),
  )
  // 열었을 때의 _k → 경로. 저장 시점 경로와 비교해 개명을 알아낸다(엣지 핸들·접힘 갱신용).
  const [origPaths] = useState(() => collectPaths(fields))
  const [error, setError] = useState<string | null>(null)
  // 삭제 버튼 2단계 확인 — 한 번 누르면 "정말 삭제" 로 바뀌고, 다시 누르면 삭제
  const [confirmDelete, setConfirmDelete] = useState(false)

  // when 선택지 — 입력 변형은 엔터티 내부 개념이므로 "자기 discriminator" 만.
  // 아직 저장 전이라도 draft 에서 실시간으로 모은다.
  const discOptions = useMemo(
    () => collectDraftDiscOptions(fields, selfId, name.trim() || '이 엔터티'),
    [fields, selfId, name],
  )

  const handleSave = () => {
    const nm = name.trim()
    if (!nm) return setError('엔터티 이름을 입력하세요')
    const e = validate(fields, '최상위')
    if (e) return setError(e)
    onSave(
      // draftsToFields 가 when(discK)을 최종 경로로 역번역하고, 무효해진
      // 참조(해제·삭제·object 하위 폐기·빠진 enum 값)를 정리한다.
      { name: nm, kind, fields: draftsToFields(fields, selfId) },
      {
        renames: buildRenames(origPaths, collectPaths(fields)),
        leafPaths: collectLeafPaths(fields),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? '엔터티 생성' : '엔터티 수정'}</DialogTitle>
          <DialogDescription>
            이름·종류와 필드를 구성합니다. object 타입은 내부에 하위 필드를 추가할
            수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-3">
          <Labeled label="이름" className="min-w-[180px] flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: OrderEvent"
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

        <FieldTreeEditor
          title="필드"
          addLabel="필드 추가"
          fields={fields}
          setFields={setFields}
          discOptions={discOptions}
        />

        {anyVariant(fields) && (
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            <GitBranch className="mr-1 inline size-3 text-sky-500" />
            행의 분기 아이콘으로 입력 변형(분기 기준·조건부 존재)을 설정합니다.
            필드 이름을 바꾸면 이를 참조하는 when 조건·매핑도 함께 갱신됩니다.
          </p>
        )}

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
