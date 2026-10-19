import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Убрать внутренние отступы — когда содержимое само управляет ими (списки, таблицы). */
  flush?: boolean
}

export function Card({ title, action, children, className = '', flush = false }: CardProps) {
  const hasHead = title || action
  return (
    <div className={`min-w-0 rounded-[14px] border border-border-default bg-surface-secondary ${className}`}>
      {hasHead && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border-soft px-5 py-4">
          {title && <h3 className="text-sm font-semibold tracking-[-0.01em] text-text-primary">{title}</h3>}
          {action && <div className="ml-auto min-w-0 max-w-full">{action}</div>}
        </div>
      )}
      <div className={flush ? '' : `px-5 pb-5 ${hasHead ? 'pt-4' : 'pt-5'}`}>{children}</div>
    </div>
  )
}
