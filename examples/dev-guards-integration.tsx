/**
 * Example: Adding Development Guards to your Next.js App Layout
 * 
 * This example shows how to integrate the development toolbar
 * for real-time violation monitoring in your application.
 */

import { DevGuardsProvider } from '@/lib/dev'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <DevGuardsProvider>
          <main className="min-h-screen">
            {children}
          </main>
        </DevGuardsProvider>
      </body>
    </html>
  )
}

/**
 * Alternative: Conditional inclusion based on environment
 */
export function ConditionalDevGuards({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'development') {
    return (
      <DevGuardsProvider>
        {children}
      </DevGuardsProvider>
    )
  }
  
  return <>{children}</>
}

/**
 * Example: Custom configuration
 */
import { quickStart } from '@/lib/dev'

// In your development startup script or next.config.js
if (process.env.NODE_ENV === 'development') {
  quickStart({
    enabled: true,
    verbose: true,
    guards: {
      organizationIsolation: true,
      rateLimiting: true,
      nPlusOneQuery: true
    }
  }).then(() => {
    console.log('🛡️ Development Guards active')
  })
}