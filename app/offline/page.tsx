import { Metadata } from 'next'
import { WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Offline - Inventory Management',
  description: 'You are currently offline',
}

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <div className="rounded-full bg-muted p-6">
            <WifiOff className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>
        
        <h1 className="mb-4 text-3xl font-bold">You're Offline</h1>
        
        <p className="mb-8 text-muted-foreground">
          It looks like you've lost your internet connection. 
          Please check your connection and try again.
        </p>
        
        <div className="space-y-4">
          <Button
            onClick={() => window.location.reload()}
            className="w-full"
            size="lg"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          
          <div className="text-sm text-muted-foreground">
            <p>While offline, you can still:</p>
            <ul className="mt-2 space-y-1">
              <li>• View cached data</li>
              <li>• Access recently viewed pages</li>
              <li>• Queue actions for when you're back online</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}