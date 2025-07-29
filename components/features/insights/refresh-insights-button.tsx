// components/features/insights/refresh-insights-button.tsx
'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { generateInsights } from '@/app/actions/ai-insights'

interface RefreshInsightsButtonProps {
  organizationId: string
}

export function RefreshInsightsButton({ organizationId }: RefreshInsightsButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      const result = await generateInsights(organizationId)
      
      if (result.success) {
        toast.success(`Generated ${result.data?.insights || 0} new insights`)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to generate insights')
      }
    } catch (error) {
      toast.error('Failed to generate insights')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button 
      variant="outline" 
      onClick={handleRefresh}
      disabled={isLoading}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Generating...' : 'Refresh Insights'}
    </Button>
  )
}