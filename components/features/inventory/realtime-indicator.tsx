'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, AlertCircle, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RealtimeConnectionManager } from '@/lib/realtime/connection-manager'
import { ConnectionStatus, ConnectionQuality } from '@/lib/realtime/types'

export function RealtimeIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>({
    state: 'disconnected',
    latency: 0,
    lastConnected: null,
    reconnectAttempts: 0,
    quality: 'poor'
  })
  const [isReceivingUpdates, setIsReceivingUpdates] = useState(false)

  useEffect(() => {
    const manager = RealtimeConnectionManager.getInstance()
    
    // Subscribe to connection status updates
    const unsubscribe = manager.subscribe('realtime-indicator', (newStatus) => {
      setStatus(newStatus)
    })

    // Start connection
    manager.connect()

    return () => {
      unsubscribe()
    }
  }, [])

  // Simulate receiving updates with pulse animation
  useEffect(() => {
    if (status.state === 'connected') {
      const timeouts: ReturnType<typeof setTimeout>[] = []
      const interval = setInterval(() => {
        setIsReceivingUpdates(true)
        const timeoutId = setTimeout(() => setIsReceivingUpdates(false), 1000)
        timeouts.push(timeoutId)
      }, 5000)

      return () => {
        clearInterval(interval)
        timeouts.forEach(clearTimeout)
      }
    }
  }, [status.state])

  const getStatusIcon = () => {
    switch (status.state) {
      case 'connected':
        return <Wifi className="h-4 w-4" />
      case 'connecting':
        return <Activity className="h-4 w-4 animate-pulse" />
      case 'disconnected':
        return <WifiOff className="h-4 w-4" />
      case 'error':
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getStatusColor = () => {
    if (status.state !== 'connected') {
      return status.state === 'error' ? 'text-red-500' : 'text-yellow-500'
    }

    switch (status.quality) {
      case 'excellent':
        return 'text-green-500'
      case 'good':
        return 'text-green-400'
      case 'fair':
        return 'text-yellow-500'
      case 'poor':
        return 'text-red-500'
    }
  }

  const getStatusText = () => {
    if (status.state !== 'connected') {
      return status.state === 'connecting' 
        ? 'Connecting...' 
        : status.state === 'error'
        ? 'Connection Error'
        : 'Offline'
    }

    return `${status.quality.charAt(0).toUpperCase() + status.quality.slice(1)} Connection`
  }

  const getTooltipContent = () => {
    const manager = RealtimeConnectionManager.getInstance()
    const metrics = manager.getConnectionQuality()
    const healthScore = manager.getHealthScore()
    const recommendations = manager.getRecommendations()

    return (
      <div className="space-y-2 text-sm">
        <div className="font-semibold">{getStatusText()}</div>
        
        {status.state === 'connected' && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latency:</span>
                <span>{status.latency}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stability:</span>
                <span>{Math.round(metrics.stability)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Health Score:</span>
                <span>{healthScore}/100</span>
              </div>
            </div>
          </>
        )}

        {status.state === 'connecting' && status.reconnectAttempts > 0 && (
          <div className="text-muted-foreground">
            Reconnection attempt {status.reconnectAttempts}
          </div>
        )}

        {status.error && (
          <div className="text-red-500 text-xs">
            {status.error}
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="border-t pt-2 space-y-1">
            <div className="font-semibold text-xs">Recommendations:</div>
            {recommendations.map((rec, index) => (
              <div key={index} className="text-xs text-muted-foreground">
                • {rec}
              </div>
            ))}
          </div>
        )}

        {status.lastConnected && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            Last connected: {new Date(status.lastConnected).toLocaleTimeString()}
          </div>
        )}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200",
              "hover:bg-accent hover:text-accent-foreground",
              getStatusColor(),
              isReceivingUpdates && "animate-pulse"
            )}
          >
            {getStatusIcon()}
            <span className="text-xs font-medium hidden sm:inline">
              {status.state === 'connected' ? status.quality : status.state}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}