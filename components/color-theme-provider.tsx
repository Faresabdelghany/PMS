'use client'

import * as React from 'react'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type ColorTheme = 'default' | 'forest' | 'ocean' | 'sunset' | 'rose' | 'supabase' | 'chatgpt' | 'midnight' | 'lavender' | 'ember' | 'mint' | 'slate'

export const COLOR_THEMES: { value: ColorTheme; label: string; description: string }[] = [
  { value: 'default', label: 'Default', description: 'Blue and purple tones' },
  { value: 'forest', label: 'Forest', description: 'Natural green tones' },
  { value: 'ocean', label: 'Ocean', description: 'Cool blue and teal' },
  { value: 'sunset', label: 'Sunset', description: 'Warm orange tones' },
  { value: 'rose', label: 'Rose', description: 'Soft pink tones' },
  { value: 'supabase', label: 'Supabase', description: 'Supabase brand green' },
  { value: 'chatgpt', label: 'ChatGPT', description: 'OpenAI style violet & orange' },
  { value: 'midnight', label: 'Midnight', description: 'Deep indigo and navy' },
  { value: 'lavender', label: 'Lavender', description: 'Soft purple tones' },
  { value: 'ember', label: 'Ember', description: 'Deep red and crimson' },
  { value: 'mint', label: 'Mint', description: 'Fresh mint and cyan' },
  { value: 'slate', label: 'Slate', description: 'Professional gray' },
]

type ColorThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: ColorTheme
  storageKey?: string
}

type ColorThemeProviderState = {
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}

const initialState: ColorThemeProviderState = {
  colorTheme: 'default',
  setColorTheme: () => null,
}

const ColorThemeProviderContext = createContext<ColorThemeProviderState>(initialState)

// Helper to get initial theme - reads from localStorage if available
function getInitialTheme(storageKey: string, defaultTheme: ColorTheme): ColorTheme {
  if (typeof globalThis.window === 'undefined') return defaultTheme
  try {
    const stored = localStorage.getItem(storageKey) as ColorTheme | null
    if (stored && COLOR_THEMES.some(t => t.value === stored)) {
      return stored
    }
  } catch {
    // localStorage might be unavailable
  }
  return defaultTheme
}

export function ColorThemeProvider({
  children,
  defaultTheme = 'default',
  storageKey = 'color-theme',
  ...props
}: ColorThemeProviderProps) {
  // Initialize with localStorage value to avoid flash
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() =>
    getInitialTheme(storageKey, defaultTheme)
  )
  const [mounted, setMounted] = useState(false)

  // Mark as mounted (for SSR hydration safety)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Apply theme to document when it changes
  useEffect(() => {
    if (!mounted) return

    const root = window.document.documentElement

    // Remove all color theme attributes first
    if (colorTheme === 'default') {
      delete root.dataset.colorTheme
    } else {
      root.dataset.colorTheme = colorTheme
    }
  }, [colorTheme, mounted])

  const setColorTheme = useCallback((theme: ColorTheme) => {
    localStorage.setItem(storageKey, theme)
    setColorThemeState(theme)
  }, [storageKey])

  const value = {
    colorTheme,
    setColorTheme,
  }

  return (
    <ColorThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ColorThemeProviderContext.Provider>
  )
}

export const useColorTheme = () => {
  const context = useContext(ColorThemeProviderContext)

  if (context === undefined)
    throw new Error('useColorTheme must be used within a ColorThemeProvider')

  return context
}
