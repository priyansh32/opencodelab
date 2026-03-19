import { useEffect, useMemo, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'opencodelab.client.theme.v1'

const getInitialTheme = (): Theme => {
  const storedTheme = localStorage.getItem(STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useTheme = (): {
  theme: Theme
  isDark: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
} => {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const isDark = useMemo(() => theme === 'dark', [theme])

  const toggleTheme = (): void => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme
  }
}
