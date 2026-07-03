import { useCallback, useEffect, useRef, useState } from 'react'
import { graphToDoc, type CodeDoc } from '../flow/code'
import { readGraphFromUrl, clearShareParam } from '../flow/share'
import { initialNodes as sampleNodes, initialEdges as sampleEdges } from '../flow/sample-data'
import {
  deletePage,
  listPages,
  putPage,
  readLastPageId,
  writeLastPageId,
  type PageRecord,
} from './db'
import type { AppNode } from '../flow/node-types'
import type { MappingEdge } from '../flow/edge-kind'

// 페이지 생명주기 전담 훅 — 목록·현재 페이지·CRUD·디바운스 자동저장.
// 그래프 자체(nodes/edges)는 Flow 가 들고 있고, 여기는 저장본(doc)만 관리한다.
//
// 재시도 모델: 실패한 쓰기는 페이지별로 pendingDocs/pendingDeletes 에 보관하고
// 다음 flush(디바운스 만료·페이지 전환·탭 이탈) 때 다시 시도한다. 실패 시 자동
// 타이머 재시도는 하지 않는다 — 저장소가 죽은 환경에서 무한 실패 루프가 되므로,
// 재시도는 항상 사용자 활동에 얹는다.

// 저장소 상태 — 'disabled' 는 IndexedDB 자체를 못 여는 경우(메모리 전용 모드),
// 'error' 는 쓰기 실패(재시도 대기). 둘 다 App 이 배너로 알린다.
export type StorageStatus = 'ok' | 'error' | 'disabled'

const DOC_OPTS = { position: true, collapsed: true } as const
const SAVE_DEBOUNCE_MS = 400

function emptyDoc(): CodeDoc {
  return { entities: [], processes: [], mappings: [] }
}

// 디스크에 확정된 내용의 비교 키 — 이름 변경도 저장 대상이므로 name 을 포함한다.
// (doc 만 비교하면 rename 실패가 "이미 저장됨"으로 오판돼 재시도에서 빠진다)
function savedKey(name: string, doc: CodeDoc): string {
  return JSON.stringify([name, doc])
}

// 이미 있는 이름과 겹치지 않게 "이름", "이름 2", "이름 3"… 을 고른다
function uniqueName(base: string, pages: PageRecord[]): string {
  const names = new Set(pages.map((p) => p.name))
  if (!names.has(base)) return base
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`
}

function makeRecord(name: string, doc: CodeDoc): PageRecord {
  const now = Date.now()
  return { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now, doc }
}

export function usePages() {
  const [ready, setReady] = useState(false)
  const [pages, setPages] = useState<PageRecord[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [storage, setStorage] = useState<StorageStatus>('ok')
  // IndexedDB 를 못 여는 환경 — 이후 모든 디스크 쓰기를 건너뛴다
  const disabled = useRef(false)
  // 콜백들이 최신 상태를 보도록 ref 미러를 함께 유지한다
  const pagesRef = useRef<PageRecord[]>([])
  const currentIdRef = useRef<string | null>(null)
  // 기록 대기 중인 doc — 디바운스 대기분과 실패 재시도분을 페이지별로 함께 담는다
  const pendingDocs = useRef(new Map<string, CodeDoc>())
  // 실패한 삭제 — 세션 내에서 flush 때마다 재시도한다
  const pendingDeletes = useRef(new Set<string>())
  const timer = useRef<number | null>(null)
  // 페이지별로 디스크에 기록이 "확인된" 내용(savedKey) — 중복 저장 스킵과
  // 실패 재시도 판단의 기준. 쓰기가 실패하면 갱신하지 않아 다음 flush 가 재시도가 된다.
  const lastSaved = useRef(new Map<string, string>())

  const applyPages = useCallback((next: PageRecord[]) => {
    pagesRef.current = next
    setPages(next)
  }, [])

  const selectInternal = useCallback((id: string) => {
    currentIdRef.current = id
    setCurrentId(id)
    writeLastPageId(id)
  }, [])

  const clearTimer = () => {
    if (timer.current != null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  // 오류 배너는 미처리 실패분이 전부 비었을 때만 내린다 —
  // 쓰기 하나 성공했다고 내리면 다른 페이지의 실패가 숨겨진다.
  const maybeClearError = useCallback(() => {
    setStorage((s) =>
      s === 'error' &&
      pendingDocs.current.size === 0 &&
      pendingDeletes.current.size === 0
        ? 'ok'
        : s,
    )
  }, [])

  // 레코드를 디스크에 기록한다. 실패해도 앱은 계속 동작한다 —
  // 배너로 알리고, 실패분은 pendingDocs 에 남겨 다음 flush 때 재시도한다.
  const persist = useCallback(
    (rec: PageRecord) => {
      const key = savedKey(rec.name, rec.doc)
      if (disabled.current) {
        // 메모리 전용 모드 — 중복 flush 를 막기 위한 표시로만 기록
        lastSaved.current.set(rec.id, key)
        return
      }
      putPage(rec).then(
        () => {
          lastSaved.current.set(rec.id, key)
          maybeClearError()
        },
        (e: unknown) => {
          console.warn('[lineage] 페이지 저장에 실패했습니다:', e)
          // 더 새로운 편집이 대기 중이 아니면 재시도 대상으로 되돌린다
          if (!pendingDocs.current.has(rec.id))
            pendingDocs.current.set(rec.id, rec.doc)
          setStorage((s) => (s === 'disabled' ? s : 'error'))
        },
      )
    },
    [maybeClearError],
  )

  // 대기 중인 저장·삭제를 즉시 처리한다 (디바운스 만료·페이지 전환·탭 이탈·종료 시)
  const flush = useCallback(() => {
    clearTimer()
    // 실패했던 삭제 재시도
    for (const id of [...pendingDeletes.current]) {
      deletePage(id).then(
        () => {
          pendingDeletes.current.delete(id)
          maybeClearError()
        },
        (e: unknown) => {
          console.warn('[lineage] 페이지 삭제를 기록하지 못했습니다:', e)
          setStorage((s) => (s === 'disabled' ? s : 'error'))
        },
      )
    }
    // 대기 doc 을 최신 레코드(이름 포함)에 얹어 기록한다
    const updates = new Map<string, PageRecord>()
    for (const [id, doc] of pendingDocs.current) {
      const rec = pagesRef.current.find((r) => r.id === id)
      if (!rec) continue // 저장 전에 삭제된 페이지
      if (lastSaved.current.get(id) === savedKey(rec.name, doc)) continue // 이미 기록됨
      updates.set(id, { ...rec, doc, updatedAt: Date.now() })
    }
    pendingDocs.current.clear()
    if (updates.size === 0) {
      // 기록할 게 남지 않았다 — 실패분이 다 해소된 경우일 수 있으니 배너를 재평가
      maybeClearError()
      return
    }
    applyPages(pagesRef.current.map((r) => updates.get(r.id) ?? r))
    for (const next of updates.values()) persist(next)
  }, [applyPages, persist, maybeClearError])

  // Flow 의 onGraphChange 훅업 — 디바운스 자동저장.
  const saveGraph = useCallback(
    (nodes: AppNode[], edges: MappingEdge[]) => {
      const id = currentIdRef.current
      if (!id) return
      const rec = pagesRef.current.find((r) => r.id === id)
      if (!rec) return
      const doc = graphToDoc(nodes, edges, DOC_OPTS)
      // 기록된 저장본과 같으면(마운트 직후, 편집 후 되돌림 등) 이 페이지 대기분 취소.
      // 타이머는 그대로 둔다 — 다른 페이지의 재시도분이 기다리고 있을 수 있다.
      //
      // 알려진 레이스(수용): D1 의 putPage 가 "진행 중"일 때 사용자가 D0(=lastSaved)과
      // 정확히 같은 상태로 되돌리면 여기서 대기분이 취소되고, 직후 D1 쓰기가 완료되면
      // 디스크=D1 / 화면=D0 불일치가 남는다. 다만 성립하려면 디바운스 만료 후
      // put 완료까지의 ms 단위 창 안에서 (undo 기능도 없이) 수동으로 바이트 단위
      // 동일 상태를 만들어야 하고, 이후 아무 노드/엣지 변경에서든 saveGraph 가
      // 다시 발화해 자가 치유된다. confirmed/inFlight/desired 3단 추적은 이 앱
      // 규모에 과해서 의도적으로 넣지 않았다.
      if (lastSaved.current.get(id) === savedKey(rec.name, doc)) {
        pendingDocs.current.delete(id)
        return
      }
      pendingDocs.current.set(id, doc)
      clearTimer()
      timer.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  const select = useCallback(
    (id: string) => {
      if (id === currentIdRef.current) return
      flush()
      selectInternal(id)
    },
    [flush, selectInternal],
  )

  const create = useCallback(() => {
    flush()
    const rec = makeRecord(uniqueName('새 페이지', pagesRef.current), emptyDoc())
    applyPages([...pagesRef.current, rec])
    selectInternal(rec.id)
    persist(rec)
  }, [flush, applyPages, selectInternal, persist])

  const rename = useCallback(
    (id: string, name: string) => {
      const rec = pagesRef.current.find((r) => r.id === id)
      if (!rec || rec.name === name) return
      const next = { ...rec, name, updatedAt: Date.now() }
      applyPages(pagesRef.current.map((r) => (r.id === id ? next : r)))
      persist(next)
    },
    [applyPages, persist],
  )

  // 페이지를 빈 doc 으로 초기화 — 검증 실패한 저장본을 사용자가 명시적으로 버릴 때만.
  // (자동으로 호출되는 곳은 없다 — InvalidPagePanel 의 버튼이 유일한 진입점)
  const reset = useCallback(
    (id: string) => {
      const rec = pagesRef.current.find((r) => r.id === id)
      if (!rec) return
      const next = { ...rec, doc: emptyDoc(), updatedAt: Date.now() }
      applyPages(pagesRef.current.map((r) => (r.id === id ? next : r)))
      persist(next)
    },
    [applyPages, persist],
  )

  const remove = useCallback(
    (id: string) => {
      // 지우려는 페이지의 대기분은 버린다
      pendingDocs.current.delete(id)
      lastSaved.current.delete(id)
      const idx = pagesRef.current.findIndex((r) => r.id === id)
      if (idx < 0) return
      let rest = pagesRef.current.filter((r) => r.id !== id)
      if (!disabled.current)
        deletePage(id).catch((e: unknown) => {
          console.warn(
            '[lineage] 페이지 삭제를 기록하지 못했습니다 — 다음 flush 때 재시도:',
            e,
          )
          pendingDeletes.current.add(id)
          setStorage((s) => (s === 'disabled' ? s : 'error'))
        })
      // 마지막 하나를 지우면 빈 페이지를 자동 생성한다
      if (rest.length === 0) {
        const rec = makeRecord('새 페이지', emptyDoc())
        rest = [rec]
        persist(rec)
      }
      applyPages(rest)
      if (currentIdRef.current === id)
        selectInternal(rest[Math.min(idx, rest.length - 1)].id)
    },
    [applyPages, selectInternal, persist],
  )

  // 초기 로드 — StrictMode 이중 실행 가드.
  // IndexedDB 를 못 열면 멈추는 대신 메모리 전용으로 계속 동작한다(배너로 안내).
  // 공유 링크(?g=...)는 항상 "새 페이지로 가져오기" — 기존 페이지를 덮지 않는다.
  const initRan = useRef(false)
  useEffect(() => {
    if (initRan.current) return
    initRan.current = true
    void (async () => {
      let list: PageRecord[] = []
      try {
        list = await listPages()
      } catch (e) {
        console.warn(
          '[lineage] IndexedDB 를 사용할 수 없습니다 — 메모리 전용 모드로 동작합니다:',
          e,
        )
        disabled.current = true
        setStorage('disabled')
      }
      for (const rec of list)
        lastSaved.current.set(rec.id, savedKey(rec.name, rec.doc))

      let selectId: string | null = null
      const shared = readGraphFromUrl()
      if (shared) {
        const rec = makeRecord(
          uniqueName('가져온 페이지', list),
          graphToDoc(shared.nodes, shared.edges, DOC_OPTS),
        )
        persist(rec)
        list = [...list, rec]
        selectId = rec.id
        clearShareParam()
      }
      // 첫 실행(저장된 페이지 없음) → 샘플 데이터로 첫 페이지를 만든다
      if (list.length === 0) {
        const rec = makeRecord('샘플', graphToDoc(sampleNodes, sampleEdges, DOC_OPTS))
        persist(rec)
        list = [rec]
      }
      if (!selectId) {
        const last = readLastPageId()
        selectId = list.some((r) => r.id === last) ? last! : list[0].id
      }
      pagesRef.current = list
      setPages(list)
      selectInternal(selectId)
      setReady(true)
    })()
  }, [selectInternal, persist])

  // 탭 이탈·종료 시 대기 중인 저장을 흘리지 않는다 (best effort)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flush])

  const current = pages.find((r) => r.id === currentId) ?? null
  return {
    ready,
    pages,
    currentId,
    current,
    storage,
    select,
    create,
    rename,
    remove,
    reset,
    saveGraph,
  }
}
