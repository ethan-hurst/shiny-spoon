'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function OrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Orders error:', error)
  }, [error])

  return (
    <div className="container mx-auto py-8">
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Orders</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>{error.message || 'Failed to load orders. Please try again.'}</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={reset}>
              Try again
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (window.location.href = '/')}
            >
              Go to Dashboard
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
