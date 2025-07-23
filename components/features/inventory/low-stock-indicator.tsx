'use client'

import { AlertCircle, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

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
  const availableQuantity = quantity - reserved
  const isOutOfStock = availableQuantity <= 0
  const isLowStock = availableQuantity > 0 && availableQuantity <= reorderPoint
  const isCriticalStock = availableQuantity > 0 && availableQuantity <= Math.ceil(reorderPoint * 0.5)

  if (!isOutOfStock && !isLowStock) {
    return null
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const getStockStatus = () => {
    if (isOutOfStock) {
      return {
        label: 'Out of Stock',
        variant: 'destructive' as const,
        icon: AlertCircle,
        tooltip: `No available inventory (${quantity} on hand, ${reserved} reserved)`,
      }
    }
    if (isCriticalStock) {
      return {
        label: 'Critical Stock',
        variant: 'destructive' as const,
        icon: TrendingDown,
        tooltip: `Only ${availableQuantity} available (reorder point: ${reorderPoint})`,
      }
    }
    return {
      label: 'Low Stock',
      variant: 'outline' as const,
      icon: AlertCircle,
      tooltip: `${availableQuantity} available (reorder point: ${reorderPoint})`,
    }
  }

  const status = getStockStatus()
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
  const availableQuantity = quantity - reserved

  if (availableQuantity <= 0) {
    return (
      <Badge variant="destructive" className={className}>
        Out of Stock
      </Badge>
    )
  }

  if (availableQuantity <= Math.ceil(reorderPoint * 0.5)) {
    return (
      <Badge variant="destructive" className={className}>
        Critical ({availableQuantity})
      </Badge>
    )
  }

  if (availableQuantity <= reorderPoint) {
    return (
      <Badge variant="outline" className={className}>
        Low Stock ({availableQuantity})
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className={className}>
      In Stock ({availableQuantity})
    </Badge>
  )
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
  const availableQuantity = quantity - reserved
  const max = maxQuantity || Math.max(quantity * 1.5, reorderPoint * 2)
  
  const availablePercentage = Math.min((availableQuantity / max) * 100, 100)
  const reservedPercentage = Math.min((reserved / max) * 100, 100)
  const reorderPercentage = (reorderPoint / max) * 100

  const getBarColor = () => {
    if (availableQuantity <= 0) return 'bg-red-500'
    if (availableQuantity <= reorderPoint) return 'bg-yellow-500'
    return 'bg-green-500'
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