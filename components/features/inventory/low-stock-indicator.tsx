'use client'

import { AlertCircle, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { calculateAvailableQuantity, getStockStatus } from '@/lib/inventory/calculations'

interface LowStockIndicatorProps {
  quantity: number
  reorderPoint: number
  reserved?: number
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function LowStockIndicator({
  quantity,
  reorderPoint,
  reserved = 0,
  className,
  showText = true,
  size = 'md',
}: LowStockIndicatorProps) {
  // Use utility function to calculate available quantity
  const availableQuantity = calculateAvailableQuantity({
    quantity,
    reserved_quantity: reserved
  })
  
  // Use utility function to get stock status
  const stockStatus = getStockStatus({
    quantity,
    reserved_quantity: reserved,
    reorder_point: reorderPoint
  })

  // Only show indicator for non-normal stock levels
  if (stockStatus === 'normal') {
    return null
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const getStatusConfig = () => {
    switch (stockStatus) {
      case 'out_of_stock':
        return {
          label: 'Out of Stock',
          variant: 'destructive' as const,
          icon: AlertCircle,
          tooltip: `No available inventory (${quantity} on hand, ${reserved} reserved)`,
        }
      case 'critical':
        return {
          label: 'Critical Stock',
          variant: 'destructive' as const,
          icon: TrendingDown,
          tooltip: `Only ${availableQuantity} available (reorder point: ${reorderPoint})`,
        }
      case 'low':
        return {
          label: 'Low Stock',
          variant: 'outline' as const,
          icon: AlertCircle,
          tooltip: `${availableQuantity} available (reorder point: ${reorderPoint})`,
        }
      default:
        return {
          label: 'In Stock',
          variant: 'secondary' as const,
          icon: AlertCircle,
          tooltip: `${availableQuantity} available`,
        }
    }
  }

  const status = getStatusConfig()
  const Icon = status.icon

  const content = (
    <Badge
      variant={status.variant}
      className={cn(
        'gap-1',
        size === 'sm' && 'text-xs py-0 px-1',
        size === 'lg' && 'text-sm py-1 px-3',
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {showText && <span>{status.label}</span>}
    </Badge>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <p>{status.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface StockStatusBadgeProps {
  quantity: number
  reorderPoint: number
  reserved?: number
  className?: string
}

export function StockStatusBadge({
  quantity,
  reorderPoint,
  reserved = 0,
  className,
}: StockStatusBadgeProps) {
  // Use utility functions for consistency
  const availableQuantity = calculateAvailableQuantity({
    quantity,
    reserved_quantity: reserved
  })
  
  const stockStatus = getStockStatus({
    quantity,
    reserved_quantity: reserved,
    reorder_point: reorderPoint
  })

  switch (stockStatus) {
    case 'out_of_stock':
      return (
        <Badge variant="destructive" className={className}>
          Out of Stock
        </Badge>
      )
    case 'critical':
      return (
        <Badge variant="destructive" className={className}>
          Critical ({availableQuantity})
        </Badge>
      )
    case 'low':
      return (
        <Badge variant="outline" className={className}>
          Low Stock ({availableQuantity})
        </Badge>
      )
    case 'normal':
    default:
      return (
        <Badge variant="secondary" className={className}>
          In Stock ({availableQuantity})
        </Badge>
      )
  }
}

interface StockLevelBarProps {
  quantity: number
  reorderPoint: number
  reserved?: number
  maxQuantity?: number
  className?: string
  showLabels?: boolean
}

export function StockLevelBar({
  quantity,
  reorderPoint,
  reserved = 0,
  maxQuantity,
  className,
  showLabels = false,
}: StockLevelBarProps) {
  // Use utility function for available quantity
  const availableQuantity = calculateAvailableQuantity({
    quantity,
    reserved_quantity: reserved
  })
  
  // Use utility function for stock status
  const stockStatus = getStockStatus({
    quantity,
    reserved_quantity: reserved,
    reorder_point: reorderPoint
  })
  
  const max = maxQuantity || Math.max(quantity * 1.5, reorderPoint * 2)
  
  const availablePercentage = Math.min((availableQuantity / max) * 100, 100)
  const reservedPercentage = Math.min((reserved / max) * 100, 100)
  const reorderPercentage = (reorderPoint / max) * 100

  const getBarColor = () => {
    switch (stockStatus) {
      case 'out_of_stock':
        return 'bg-red-500'
      case 'critical':
      case 'low':
        return 'bg-yellow-500'
      case 'normal':
      default:
        return 'bg-green-500'
    }
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="relative h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        {/* Reorder point indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-600 z-10"
          style={{ left: `${reorderPercentage}%` }}
          title={`Reorder point: ${reorderPoint}`}
        />
        
        {/* Reserved quantity */}
        {reserved > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-orange-300"
            style={{ 
              left: `${availablePercentage}%`,
              width: `${reservedPercentage}%` 
            }}
            title={`Reserved: ${reserved}`}
          />
        )}
        
        {/* Available quantity */}
        <div
          className={cn('absolute top-0 bottom-0 transition-all duration-300', getBarColor())}
          style={{ width: `${availablePercentage}%` }}
          title={`Available: ${availableQuantity}`}
        />
      </div>
      
      {showLabels && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-600 rounded-full" />
            Reorder: {reorderPoint}
          </span>
          <span>{max}</span>
        </div>
      )}
    </div>
  )
}