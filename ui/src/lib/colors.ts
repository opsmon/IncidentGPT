/**
 * Recharts принимает цвета строкой в пропах fill/stroke, поэтому классы Tailwind
 * туда не годятся. Читаем те же токены из :root — один источник правды с index.css,
 * никаких хекс-литералов по компонентам.
 */
// Значения дублируют токены из index.css. Нужны как запасной вариант: если
// getComputedStyle вернёт пусто (стили ещё не применились), Recharts получит
// пустую заливку и нарисует график без столбцов и линий.
const fallback: Record<string, string> = {
  '--color-severity-critical': '#FF5F52',
  '--color-severity-warning': '#F5A623',
  '--color-severity-info': '#4C9AFF',
  '--color-severity-unknown': '#9AA9BC',
  '--color-accent': '#5EEAD4',
  '--color-status-resolved': '#54D99D',
  '--color-border-soft': '#243348',
  '--color-text-muted': '#94A6BF',
  '--color-surface-tertiary': '#1B2A3C',
  '--color-border-default': '#304157',
}

function token(name: string): string {
  if (typeof window !== 'undefined') {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    if (v) return v
  }
  return fallback[name] ?? '#5EEAD4'
}

export const chartColors = {
  get critical() { return token('--color-severity-critical') },
  get warning() { return token('--color-severity-warning') },
  get info() { return token('--color-severity-info') },
  get unknown() { return token('--color-severity-unknown') },
  get accent() { return token('--color-accent') },
  get resolved() { return token('--color-status-resolved') },
  get grid() { return token('--color-border-soft') },
  get axis() { return token('--color-text-muted') },
  get surface() { return token('--color-surface-tertiary') },
  get border() { return token('--color-border-default') },
}

/** Единый стиль тултипа Recharts во всех графиках. */
export const tooltipStyle = {
  background: 'var(--color-surface-tertiary)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  fontSize: 12,
  padding: '8px 10px',
  boxShadow: '0 10px 30px #000a',
} as const

export const axisTick = { fill: 'var(--color-text-muted)', fontSize: 11 } as const
