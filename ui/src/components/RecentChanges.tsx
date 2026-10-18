import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get, ApiError } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/time'

type Change = {
 event_id: string; workload: string; revision?: string; source: string; event_type: string
 source_timestamp?: string; observed_timestamp: string; source_url?: string
 summary: string; images?: string[]; previous_images?: string[]; relevance_reason: string
}
type Timeline = {
 items: Change[]; status: string; next_offset: number | null; first_symptom_at?: string
 coverage: { status: string; started_at: string; interval_started_at: string; last_success?: string } | null
}
export function RecentChanges({ incidentId }: { incidentId: string }) {
 const [offset, setOffset] = useState(0)
 const [source, setSource] = useState('')
 const query = useQuery({queryKey: ['incident-changes', incidentId, offset], queryFn: () => get<Timeline>(`/incidents/${encodeURIComponent(incidentId)}/changes?offset=${offset}&limit=25`), retry: false})
 const data = query.data
 const filtered = data?.items.filter(e => !source || e.source === source) ?? []
 return <Card className="mt-3.5" title="Недавние изменения">
  <p className="mb-3 text-xs text-text-muted">Близость по времени — повод проверить изменение, а не доказательство причины.</p>
  {query.isPending ? <p>Загрузка изменений…</p> : query.isError ? <p role="alert" className="text-xs text-severity-critical">{query.error instanceof ApiError && [401, 403].includes(query.error.status) ? 'Нет доступа к истории изменений.' : 'История изменений недоступна. Это не означает отсутствие изменений.'}</p> : data && <>
   <p className="mb-3 text-xs text-text-secondary">{data.status === 'disabled' ? 'Сбор изменений выключен.' : data.status !== 'available' ? 'Идентификатор кластера, workload или время первого симптома неизвестны.' : data.coverage ? `Сбор: ${data.coverage.status}. Текущий интервал наблюдения с ${formatDate(data.coverage.interval_started_at)}. Последний успешный опрос: ${data.coverage.last_success ? formatDate(data.coverage.last_success) : 'неизвестно'}.` : 'Покрытие сбора неизвестно.'} История до установки коллектора и изменения между опросами могут отсутствовать.</p>
   {data.status === 'available' && <>
    <label className="text-xs">Источник <select className="ml-2 rounded bg-surface-tertiary p-1" value={source} onChange={e => setSource(e.target.value)}><option value="">Все на странице</option><option value="kubernetes">Kubernetes</option><option value="argocd">Argo CD</option><option value="ci">CI</option></select></label>
    {data.items.length === 0 ? <p className="mt-3 text-xs">В этом окне нет записанных изменений. Полнота истории не гарантирована.</p> : filtered.map(e => <div className="mt-3 border-t border-border-soft pt-3 text-xs" key={e.event_id}>
     <p className="font-semibold">{e.workload} · {e.revision || 'revision неизвестна'} · {e.source} · {e.event_type}</p>
     <p className="mt-1 text-text-secondary">Время источника: {e.source_timestamp ? formatDate(e.source_timestamp) : 'неизвестно'} · Наблюдение: {formatDate(e.observed_timestamp)}</p>
     {e.images && <p className="mt-1 break-all">Образы: {e.images.join(', ')}</p>}
     {e.previous_images && e.previous_images.length > 0 && <p className="mt-1 break-all">Предыдущие: {e.previous_images.join(', ')}</p>}
     <p className="mt-1 text-text-muted">{e.relevance_reason}</p>
     {e.source_url && <a className="mt-1 inline-block text-accent" href={e.source_url} target="_blank" rel="noopener noreferrer">Исходная revision</a>}
    </div>)}
    {data.items.length > 0 && filtered.length === 0 && <p className="mt-3 text-xs">На этой странице нет изменений выбранного источника.</p>}
    <div className="mt-3 flex gap-2"><Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Назад</Button><Button variant="secondary" size="sm" disabled={data.next_offset === null} onClick={() => setOffset(data.next_offset ?? offset)}>Далее</Button></div>
   </>}
  </>}
 </Card>
}
