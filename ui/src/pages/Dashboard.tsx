import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  Clock3,
  Sparkles,
  Radio,
  BookOpen,
} from 'lucide-react'
import { Card } from '@/components/ui/Card.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { KPICard } from '@/components/KPICard.tsx'
import { SeverityBadge, StatusBadge } from '@/components/ui/Badge.tsx'
import { Skeleton } from '@/components/ui/Skeleton.tsx'
import { useDashboardStats, useActiveIncidents } from '@/hooks/useDashboard.ts'
import { formatTime, timeAgo, formatDuration } from '@/lib/time.ts'

const severityOrder = { critical: 0, warning: 1, info: 2, unknown: 3 }

export function Dashboard() {
  const statsQuery = useDashboardStats()
  const activeQuery = useActiveIncidents()
  const { data: stats, isLoading: statsLoading, isError: statsError } = statsQuery
  const { data: active = [], isLoading: activeLoading, isError: activeError } = activeQuery
  const oldest =
    !activeError && active.length
      ? Math.max(
          ...active.map((i) =>
            Math.max(0, Math.floor((Date.now() - new Date(i.created_at).getTime()) / 1000)),
          ),
        )
      : null
  const prioritized = [...active].sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      Date.parse(a.created_at) - Date.parse(b.created_at),
  )
  const refreshing = statsQuery.isFetching || activeQuery.isFetching
  const spark = stats?.alerts_sparkline ?? []
  const surge = spark.length > 1 && spark[spark.length - 1] > spark[spark.length - 2] * 1.5
  return (
    <div>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="page-eyebrow">Центр реагирования</p>
          <h1 className="page-title">Обзор дежурства</h1>
          <p className="page-description">Что требует внимания сейчас — и с чего начать разбор.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-text-muted xl:block">
            {statsError
              ? 'Обновление не удалось'
              : statsQuery.dataUpdatedAt
                ? `Обновлено в ${formatTime(new Date(statsQuery.dataUpdatedAt).toISOString())}`
                : 'Получаем данные…'}
          </span>
          <Button
            variant="secondary"
            disabled={refreshing}
            onClick={() => {
              void statsQuery.refetch()
              void activeQuery.refetch()
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Обновить
          </Button>
        </div>
      </div>
      {statsError && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-severity-critical/30 bg-severity-critical/5 px-5 py-4 text-sm text-text-secondary"
        >
          Метрики недоступны. Текущее состояние неизвестно; повторите загрузку или проверьте доступ.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          icon={<AlertTriangle size={17} />}
          label="Активные инциденты"
          value={statsError ? '—' : (stats?.active_incidents ?? 0)}
          hint={
            statsError
              ? 'данные недоступны'
              : stats?.active_critical
                ? `${stats.active_critical} с critical`
                : 'critical не обнаружены'
          }
          tone={statsError ? 'mute' : stats?.active_critical ? 'bad' : 'good'}
          loading={statsLoading}
        />
        <KPICard
          icon={<Clock3 size={17} />}
          label="Дольше в текущей выборке"
          value={oldest !== null ? formatDuration(oldest) : '—'}
          hint={
            activeError
              ? 'список недоступен'
              : oldest !== null
                ? 'с момента регистрации'
                : 'активных в выборке нет'
          }
          tone={oldest !== null && oldest > 1800 ? 'warn' : 'mute'}
          loading={activeLoading}
        />
        <KPICard
          icon={<Sparkles size={17} />}
          label="Обработка анализа AI"
          value={
            !statsError && stats?.avg_analysis_time_sec != null
              ? formatDuration(stats.avg_analysis_time_sec)
              : '—'
          }
          hint={
            !statsError && stats?.avg_analysis_time_sec != null
              ? 'от начала до завершения обработки'
              : 'нет доступного измерения'
          }
          tone="mute"
          loading={statsLoading}
        />
        <KPICard
          icon={<Radio size={17} />}
          label="Алертов за сутки"
          value={statsError ? '—' : (stats?.alerts_today ?? 0)}
          hint={
            statsError
              ? 'данные недоступны'
              : surge
                ? 'рост между последними точками'
                : 'входящий поток Alertmanager'
          }
          tone={surge && !statsError ? 'warn' : 'mute'}
          sparkline={statsError ? undefined : spark}
          loading={statsLoading}
        />
      </div>
      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card
          title="Требуют внимания"
          action={
            <Link
              to="/incidents?status=active"
              className="inline-flex min-h-9 items-center gap-2 text-xs text-accent hover:underline"
            >
              Вся очередь
              <ArrowUpRight size={14} />
            </Link>
          }
        >
          <p className="mb-4 text-xs leading-relaxed text-text-muted">
            До 10 активных инцидентов. В этой выборке — сначала по критичности, затем по времени регистрации.
          </p>
          {activeError ? (
            <div
              role="alert"
              className="rounded-lg border border-severity-critical/25 p-5 text-sm text-text-secondary"
            >
              Список недоступен. Нельзя подтвердить отсутствие инцидентов.
              <Button variant="secondary" className="mt-3" size="sm" onClick={() => activeQuery.refetch()}>
                Повторить
              </Button>
            </div>
          ) : activeLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : prioritized.length === 0 ? (
            <div className="py-10 text-center">
              <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-status-resolved/10 text-status-resolved">
                <CheckCircle2 size={24} />
              </span>
              <p className="font-medium">Активных инцидентов нет</p>
              <p className="mt-2 text-sm text-text-muted">
                Посмотрите историю или проверьте входящие алерты.
              </p>
              <Link to="/alerts" className="mt-5 inline-flex items-center gap-2 text-sm text-accent">
                Открыть поток алертов
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border-soft">
              {prioritized.map((incident) => (
                <Link
                  key={incident.id}
                  to={`/incidents/${encodeURIComponent(incident.id)}`}
                  className="group -mx-2 block rounded-lg px-2 py-4 transition-colors hover:bg-surface-tertiary/60"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={incident.severity} />
                    <StatusBadge status={incident.status} />
                    <span className="tnum ml-auto text-[11px] text-text-muted">
                      {timeAgo(incident.created_at)}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <h2 className="break-words text-sm font-medium group-hover:text-accent">
                      {incident.title}
                    </h2>
                    <ArrowUpRight size={15} className="ml-auto shrink-0 text-text-muted" />
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-text-muted">
                    {incident.id} · {incident.namespace || 'namespace неизвестен'} · {incident.alert_count}{' '}
                    алерт.
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <div className="space-y-5">
          <Card title="Рабочий порядок">
            <ol className="space-y-5">
              {[
                {
                  title: 'Примите инцидент',
                  description: 'Оцените критичность и назначьте ответственного.',
                  to: '/incidents?status=active',
                },
                {
                  title: 'Сверьте факты',
                  description: 'Сравните алерты, изменения и доказательства анализа.',
                  to: '/help#investigate',
                },
                {
                  title: 'Сохраните решение',
                  description: 'Подтвердите восстановление и подготовьте передачу смены.',
                  to: '/help#resolve',
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="tnum flex size-6 shrink-0 items-center justify-center rounded-full border border-border-default text-[11px] text-accent">
                    {index + 1}
                  </span>
                  <div>
                    <Link to={step.to} className="text-[13px] font-medium hover:text-accent">
                      {step.title}
                    </Link>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-5">
            <BookOpen size={19} className="mb-3 text-accent" />
            <h2 className="text-sm font-medium">Первое дежурство?</h2>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              Короткое руководство объяснит статусы, проверки и работу с решениями.
            </p>
            <Link to="/help" className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-accent">
              Открыть руководство
              <ArrowRight size={13} />
            </Link>
          </div>
          <p className="px-1 text-[11px] leading-relaxed text-text-muted">
            AI предлагает гипотезы. Причину и восстановление подтверждает инженер.
          </p>
        </div>
      </div>
    </div>
  )
}
