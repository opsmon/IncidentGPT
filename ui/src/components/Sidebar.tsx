import { NavLink } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Bell,
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  Plug,
  Settings,
  BookOpen,
  ArrowUpRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Item {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  count?: number
}
interface SidebarProps {
  activeIncidents?: number
  warnings?: number
  mobile?: boolean
  onNavigate?: () => void
}

export function Sidebar({ activeIncidents, warnings, mobile = false, onNavigate }: SidebarProps) {
  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Рабочее пространство',
      items: [
        { to: '/', label: 'Обзор', icon: LayoutDashboard, end: true },
        { to: '/incidents', label: 'Инциденты', icon: AlertTriangle, count: activeIncidents },
        { to: '/alerts', label: 'Поток алертов', icon: Bell },
      ],
    },
    {
      title: 'Наблюдение',
      items: [
        { to: '/analytics', label: 'Аналитика', icon: BarChart3 },
        { to: '/predictions', label: 'Прогнозы', icon: TrendingUp, count: warnings },
      ],
    },
    {
      title: 'Настройки',
      items: [
        { to: '/settings/integrations', label: 'Интеграции', icon: Plug },
        { to: '/settings/llm', label: 'Модель AI', icon: Settings },
      ],
    },
  ]

  return (
    <aside
      className={
        mobile
          ? 'flex min-h-full flex-col bg-surface-secondary p-5'
          : 'sticky top-0 hidden h-dvh w-[244px] shrink-0 flex-col border-r border-border-soft bg-surface-secondary p-5 lg:flex'
      }
    >
      <NavLink to="/" onClick={onNavigate} className="mb-8 flex items-center gap-3 rounded-lg">
        <span className="grid size-10 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
          <Activity size={23} strokeWidth={1.8} />
        </span>
        <span>
          <span className="block text-[17px] font-semibold tracking-tight">IncidentGPT</span>
          <span className="text-[11px] text-text-muted">Контекст. Решение. Опыт.</span>
        </span>
      </NavLink>
      <nav aria-label="Основная навигация" className="min-h-0 space-y-7 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.12em] text-text-muted">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ${isActive ? 'bg-accent/10 text-accent ring-1 ring-inset ring-accent/15' : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'}`
                  }
                >
                  <item.icon size={17} strokeWidth={1.7} aria-hidden="true" />
                  {item.label}
                  {item.count != null && item.count > 0 && (
                    <span className="tnum ml-auto rounded-md bg-surface-primary/60 px-2 py-0.5 text-[11px]">
                      {item.count}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <NavLink
        to="/help"
        onClick={onNavigate}
        className={({ isActive }) =>
          `mt-auto rounded-xl border p-4 text-sm transition-colors ${isActive ? 'border-accent/40 bg-accent/10' : 'border-border-default bg-surface-primary/40 hover:border-accent/40'}`
        }
      >
        <span className="mb-3 flex items-center justify-between text-accent">
          <BookOpen size={18} />
          <ArrowUpRight size={14} />
        </span>
        <span className="block font-medium">Руководство дежурного</span>
        <span className="mt-1 block text-xs leading-relaxed text-text-muted">
          От первого алерта до передачи смены.
        </span>
      </NavLink>
    </aside>
  )
}
