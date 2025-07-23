'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export default function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // After mounting, we have access to the theme
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    // Render nothing on the server and until the theme is mounted
    return null
  }

  return (
    <div>
      {theme === 'dark' ? (
        <Button
          variant="ghost"
          className="hover:bg-inherit border-zinc-900 bg-[#0c0c0d]"
          size="icon"
          onClick={() => setTheme('light')}
          aria-label="Switch to light theme"
        >
          <Sun className="w-5 h-5" aria-hidden="true" />
          <span className="sr-only">Switch to light theme</span>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-inherit border-zinc-100 bg-inherit"
          onClick={() => setTheme('dark')}
          aria-label="Switch to dark theme"
        >
          <Moon className="w-5 h-5" aria-hidden="true" />
          <span className="sr-only">Switch to dark theme</span>
        </Button>
      )}
    </div>
  )
}
