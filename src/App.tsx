import { useMemo } from 'react'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import Flow from './flow/Flow'
import { graphFromDoc } from './flow/code'
import { InvalidPagePanel } from './pages/InvalidPagePanel'
import { PageSidebar } from './pages/PageSidebar'
import { usePages } from './pages/use-pages'

// 저장소 문제 안내 배너 문구 — 'disabled' 는 영구(메모리 전용), 'error' 는 재시도 중.
const STORAGE_NOTICE = {
  disabled:
    '브라우저 저장소(IndexedDB)를 사용할 수 없어 변경 사항이 저장되지 않습니다 — 이 탭을 닫으면 사라져요.',
  error: '변경 사항 저장에 실패했습니다 — 다음 편집·페이지 전환 때 다시 시도합니다.',
} as const

function App() {
  const pages = usePages()

  // 현재 페이지의 저장본(doc) → 그래프. lenient 모드로 검증한다 — 앱 조작(필드
  // 이름 변경·노드 삭제)으로 생긴 dangling when 참조는 제거하고 통과시켜,
  // 정상 편집으로 만든 페이지가 검증 실패로 잠기지 않게 한다.
  // 검증 실패 시 Flow 를 마운트하지 않고 안내 화면을 띄운다 — 빈 그래프로 열면
  // 마운트 직후 자동저장이 원본을 덮어쓰므로, 원본 보존을 위해 반드시 분기해야 한다.
  const doc = pages.current?.doc
  const graph = useMemo(() => {
    if (!doc) return null
    const res = graphFromDoc(doc, 'lenient')
    return res.ok
      ? ({ ok: true, nodes: res.nodes, edges: res.edges } as const)
      : ({ ok: false, errors: res.errors, doc } as const)
  }, [doc])

  if (!pages.ready || !pages.currentId || !graph) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        불러오는 중…
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      {pages.storage !== 'ok' && (
        <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <TriangleAlert className="size-3.5 shrink-0" />
          {STORAGE_NOTICE[pages.storage]}
        </div>
      )}
      <div
        className="relative flex min-h-0 flex-1"
        aria-busy={pages.importing}
      >
        <div className="flex min-h-0 flex-1" inert={pages.importing}>
          <PageSidebar
            pages={pages.pages}
            currentId={pages.currentId}
            onSelect={pages.select}
            onCreate={pages.create}
            onRename={pages.rename}
            onRemove={pages.remove}
            onExport={pages.exportPages}
            onImport={pages.importPages}
          />
          {/* key 리마운트로 페이지 전환 — 페이지 종속 UI 상태를 통째로 초기화 */}
          {graph.ok ? (
            <Flow
              key={pages.currentId}
              initialNodes={graph.nodes}
              initialEdges={graph.edges}
              onGraphChange={pages.saveGraph}
            />
          ) : (
            <InvalidPagePanel
              key={pages.currentId}
              errors={graph.errors}
              doc={graph.doc}
              onReset={() => pages.reset(pages.currentId!)}
            />
          )}
        </div>
        {pages.importing && (
          <div
            className="absolute inset-0 z-50 flex cursor-wait items-center justify-center bg-background/60 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm">
              <LoaderCircle className="size-4 animate-spin" />
              백업 가져오는 중…
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
