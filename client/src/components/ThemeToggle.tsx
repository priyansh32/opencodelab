import { type Theme } from '@/hooks/useTheme'

interface ThemeToggleProps {
  theme: Theme
  onToggle: () => void
}

export const ThemeToggle = ({ theme, onToggle }: ThemeToggleProps) => {
  return (
    <button
      type='button'
      className='theme-toggle'
      onClick={onToggle}
      aria-label='Toggle color theme'
    >
      <span className='theme-toggle__icon' aria-hidden='true'>
        {theme === 'dark' ? '◐' : '◒'}
      </span>
      <span className='theme-toggle__label'>
        {theme === 'dark' ? 'Dark' : 'Light'}
      </span>
    </button>
  )
}
