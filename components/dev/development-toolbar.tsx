'use client'

/**
 * Development Toolbar - Real-time display of violations with quick fixes
 * Only renders in development mode
 */

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, Check, X, Settings, Zap, ExternalLink, Minimize2, Maximize2 } from 'lucide-react'

interface Violation {
  id: string
  type: 'security' | 'performance' | 'quality'
  severity: 'error' | 'warning' | 'info'
  message: string
  file: string
  line: number
  column: number
  quickFix?: boolean
  suggestion?: string
}

interface Stats {
  bundleSize: number
  queryCount: number
  renderTime: number
  violationCount: number
  errorCount: number
}

interface WebSocketMessage {
  type: string
  data?: any
  timestamp?: number
}

export function DevelopmentToolbar() {
  const [violations, setViolations] = useState<Violation[]>([])
  const [isMinimized, setIsMinimized] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [stats, setStats] = useState<Stats>({
    bundleSize: 0,
    queryCount: 0,
    renderTime: 0,
    violationCount: 0,
    errorCount: 0
  })
  const [ws, setWs] = useState<WebSocket | null>(null)

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const connectWebSocket = useCallback(() => {
    try {
      const websocket = new WebSocket('ws://localhost:3001')
      
      websocket.onopen = () => {
        setIsConnected(true)
        setWs(websocket)
        console.log('🔗 Connected to development guards')
      }
      
      websocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          
          switch (message.type) {
            case 'violations':
              setViolations(message.data.violations || [])
              break
              
            case 'stats':
              setStats(message.data)
              break
              
            case 'fix-applied':
              // Remove the fixed violation
              setViolations(prev => 
                prev.filter(v => v.id !== message.data.violationId)
              )
              break
              
            case 'pong':
              // Keep-alive response
              break
              
            default:
              console.log('📨 Unknown message type:', message.type)
          }
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error)
        }
      }
      
      websocket.onclose = () => {
        setIsConnected(false)
        setWs(null)
        console.log('🔌 Disconnected from development guards')
        
        // Attempt to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000)
      }
      
      websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
      }
      
    } catch (error) {
      console.error('❌ Failed to connect to development guards:', error)
      setTimeout(connectWebSocket, 5000)
    }
  }, [])

  useEffect(() => {
    connectWebSocket()
    
    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [connectWebSocket])

  // Send ping every 30 seconds to keep connection alive
  useEffect(() => {
    if (!ws || !isConnected) return
    
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
    
    return () => clearInterval(interval)
  }, [ws, isConnected])

  const applyQuickFix = (violationId: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'apply-fix',
        data: { violationId }
      }))
    }
  }

  const dismissViolation = (violationId: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'dismiss-violation',
        data: { violationId }
      }))
    }
    
    // Remove from local state immediately
    setViolations(prev => prev.filter(v => v.id !== violationId))
  }

  const openInVSCode = (file: string, line: number) => {
    // Try to open in VS Code
    const url = `vscode://file/${file}:${line}`
    window.open(url, '_blank')
  }

  const errorCount = violations.filter(v => v.severity === 'error').length
  const warningCount = violations.filter(v => v.severity === 'warning').length
  const infoCount = violations.filter(v => v.severity === 'info').length

  // Minimized state
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-full shadow-lg font-medium text-sm transition-colors
            ${errorCount > 0 ? 'bg-red-600 text-white hover:bg-red-700' : 
              warningCount > 0 ? 'bg-yellow-600 text-white hover:bg-yellow-700' : 
              'bg-green-600 text-white hover:bg-green-700'}
          `}
        >
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-white' : 'bg-gray-400'}`} />
          
          {errorCount > 0 && <X className="w-4 h-4" />}
          {errorCount === 0 && warningCount > 0 && <AlertTriangle className="w-4 h-4" />}
          {errorCount === 0 && warningCount === 0 && <Check className="w-4 h-4" />}
          
          {errorCount + warningCount + infoCount || '0'}
          
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>
    )
  }

  // Full toolbar
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white shadow-2xl z-50 border-t border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="font-semibold">Dev Guards</span>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <X className="w-3 h-3 text-red-400" />
              {errorCount}
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-yellow-400" />
              {warningCount}
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-blue-400" />
              {infoCount}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-400 flex items-center gap-3">
            <span>Bundle: {(stats.bundleSize / 1024).toFixed(1)}KB</span>
            <span>Queries: {stats.queryCount}</span>
            <span>Render: {stats.renderTime}ms</span>
          </div>
          
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-white transition-colors"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Violations List */}
      {violations.length > 0 && (
        <div className="max-h-80 overflow-y-auto">
          {violations.map((violation) => (
            <div
              key={violation.id}
              className="flex items-start justify-between px-4 py-3 border-b border-gray-700 hover:bg-gray-800 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-1">
                  {violation.severity === 'error' && <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                  {violation.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />}
                  {violation.severity === 'info' && <AlertTriangle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight">{violation.message}</p>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`
                        px-2 py-1 rounded text-xs font-medium
                        ${violation.type === 'security' ? 'bg-red-800 text-red-200' :
                          violation.type === 'performance' ? 'bg-yellow-800 text-yellow-200' :
                          'bg-blue-800 text-blue-200'}
                      `}>
                        {violation.type}
                      </span>
                      
                      <span className="text-xs text-gray-400 truncate">
                        {violation.file.replace(process.cwd(), '')}:{violation.line}
                      </span>
                    </div>
                    
                    {violation.suggestion && (
                      <p className="text-xs text-gray-400 mt-1 leading-tight">
                        💡 {violation.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {violation.quickFix && (
                  <button
                    onClick={() => applyQuickFix(violation.id)}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
                    title="Apply quick fix"
                  >
                    <Zap className="w-3 h-3" />
                    Fix
                  </button>
                )}
                
                <button
                  onClick={() => openInVSCode(violation.file, violation.line)}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
                  title="Open in VS Code"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open
                </button>
                
                <button
                  onClick={() => dismissViolation(violation.id)}
                  className="text-gray-400 hover:text-red-400 transition-colors p-1"
                  title="Dismiss violation"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Empty state */}
      {violations.length === 0 && isConnected && (
        <div className="px-4 py-8 text-center text-gray-400">
          <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
          <p className="text-sm">No violations detected</p>
          <p className="text-xs">Keep up the great work! 🎉</p>
        </div>
      )}
      
      {/* Disconnected state */}
      {!isConnected && (
        <div className="px-4 py-8 text-center text-gray-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
          <p className="text-sm">Development guards disconnected</p>
          <p className="text-xs">Attempting to reconnect...</p>
        </div>
      )}
    </div>
  )
}