import { Braces, Database, Radio, Webhook, type LucideIcon } from 'lucide-react'
import type { EntityKind } from './types'

// 엔티티 종류별 표시 메타데이터 (노드 헤더 / 패널에서 공용)
export const KIND_META: Record<EntityKind, { label: string; icon: LucideIcon }> = {
  event: { label: 'kafka event', icon: Radio },
  api: { label: 'api response', icon: Webhook },
  db: { label: 'db record', icon: Database },
  etc: { label: '기타', icon: Braces }, // DTO 등 일반 데이터 구조
}
