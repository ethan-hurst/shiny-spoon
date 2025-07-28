/**
 * Development Guards Next.js Integration
 * Automatically adds the development toolbar in development mode
 */

'use client'

import { DevelopmentToolbar } from '../components/dev/development-toolbar'

export function DevGuardsProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DevelopmentToolbar />
    </>
  )
}