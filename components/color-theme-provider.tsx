'use client'

import * as React from 'react'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type ColorTheme = 'default' | 'forest' | 'ocean' | 'sunset' | 'rose' | 'supabase' | 'chatgpt'

export const COLOR_THEMES: { value: ColorTheme; label: string; description: string }[] = [
  { value: 'default', label: 'Default', description: 'Blue and purple tones' },
  { value: 'forest', label: 'Forest', description: 'Natural green tones' },
  { value: 'ocean', label: 'Ocean', description: 'Cool blue and teal' },
  { value: 'sunset', label: 'Sunset', description: 'Warm orange tones' },
  { value: 'rose', label: 'Rose', description: 'Soft pink tones' },
  { value: 'supabase', label: 'Supabase', description: 'Supabase brand green' },
  { value: 'chatgpt', label: 'ChatGPT', description: 'OpenAI style violet & orange' },
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

export function ColorThemeProvider({
  children,
  defaultTheme = 'default',
  storageKey = 'color-theme',
  ...props
}: ColorThemeProviderProps) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(defaultTheme)
  const [mounted, setMounted] = useState(false)

  // Load theme from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as ColorTheme | null
    if (stored && COLOR_THEMES.some(t => t.value === stored)) {
      setColorThemeState(stored)
    }
    setMounted(true)
  }, [storageKey])

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return

    const root = window.document.documentElement

    // Remove all color theme attributes first
    if (colorTheme === 'default') {
      root.removeAttribute('data-color-theme')
    } else {
      root.setAttribute('data-color-theme', colorTheme)
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
