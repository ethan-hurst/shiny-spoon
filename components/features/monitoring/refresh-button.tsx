'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface RefreshButtonProps {
  className?: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

/**
 * Renders a button that reloads the current page when clicked.
 *
 * Optionally accepts custom styling, variant, and size props for appearance customization.
 */
export function RefreshButton({ className, variant = 'outline', size = 'sm' }: RefreshButtonProps) {
  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <Button 
      className={className} 
      variant={variant} 
      size={size}
      onClick={handleRefresh}
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      Refresh Page
    </Button>
  )
}