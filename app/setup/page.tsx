'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function SetupPage() {
  const router = useRouter()

  useEffect(() => {
    // After a delay, try to redirect to the dashboard.
    // This gives the backend trigger time to create the user profile.
    const timer = setTimeout(() => {
      router.replace('/')
    }, 5000) // 5-second delay

    // Clean up the timer if the component unmounts.
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Setting up your account</CardTitle>
          <CardDescription>
            We're preparing your TruthSource workspace. This should only take a moment.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm text-muted-foreground">Finalizing your profile...</span>
          </div>
          
          <div className="space-y-2 text-sm text-muted-foreground mb-6">
            <p>• Creating your organization</p>
            <p>• Applying initial settings</p>
            <p>• Redirecting you to the dashboard...</p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={() => router.replace('/')} 
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            If you are not redirected automatically, please click the button above.
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 