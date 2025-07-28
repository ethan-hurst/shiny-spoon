/**
 * Development Guards - Real-time development monitoring and quality enforcement
 * 
 * This module provides:
 * - Real-time file watching with AST analysis
 * - Security guards (organization isolation, rate limiting, auth)
 * - Performance guards (N+1 queries, bundle size, memory leaks)
 * - Quality guards (TypeScript strict mode, error handling, test coverage)
 * - Browser development toolbar with quick fixes
 * - Pre-commit quality gates
 */

// Core services
export { DevGuardsService, getDevGuards, startDevGuards, stopDevGuards } from './dev-guards-service'
export { FileWatcherService } from './file-watcher'
export { DevGuardWebSocketServer } from './websocket-server'

// Base classes
export { BaseGuard } from './base-guard'
export { analyze, isSystemFile, type AST, type Violation } from './ast-analyzer'

// Security guards
export { OrganizationIsolationGuard } from './guards/organization-isolation'
export { RateLimitingGuard } from './guards/rate-limiting'

// Performance guards
export { NPlusOneQueryGuard } from './guards/n-plus-one-query'

// Quality guards  
export { ErrorHandlingGuard } from './guards/error-handling'

// UI components
export { DevelopmentToolbar } from '../../components/dev/development-toolbar'
export { DevGuardsProvider } from './dev-guards-provider'

// Types
export interface DevGuardsConfig {
  enabled?: boolean
  websocketPort?: number
  fileWatcher?: {
    enabled?: boolean
    watchPaths?: string[]
    ignorePaths?: string[]
    debounceMs?: number
    verbose?: boolean
  }
  guards?: {
    organizationIsolation?: boolean
    rateLimiting?: boolean
    nPlusOneQuery?: boolean
  }
  verbose?: boolean
}

// Environment variable configuration
export const DEV_GUARDS_CONFIG: DevGuardsConfig = {
  enabled: process.env.DEV_GUARDS === 'true' || process.env.NODE_ENV === 'development',
  websocketPort: parseInt(process.env.DEV_GUARDS_PORT || '3001'),
  verbose: process.env.DEV_GUARDS_VERBOSE === 'true',
  guards: {
    organizationIsolation: process.env.DEV_GUARDS_ORG_ISOLATION !== 'false',
    rateLimiting: process.env.DEV_GUARDS_RATE_LIMITING !== 'false',
    nPlusOneQuery: process.env.DEV_GUARDS_N_PLUS_ONE !== 'false',
    errorHandling: process.env.DEV_GUARDS_ERROR_HANDLING !== 'false'
  }
}

/**
 * Quick start function for development guards
 */
export async function quickStart(config?: Partial<DevGuardsConfig>) {
  const mergedConfig = { ...DEV_GUARDS_CONFIG, ...config }
  
  if (!mergedConfig.enabled) {
    console.log('🛡️  Development guards disabled')
    return null
  }
  
  try {
    const devGuards = await startDevGuards(mergedConfig)
    
    console.log('🚀 Development Guards Quick Start Complete!')
    console.log('📱 Add <DevGuardsProvider> to your app layout to see the toolbar')
    console.log('🔗 WebSocket server running on port', mergedConfig.websocketPort)
    
    return devGuards
  } catch (error) {
    console.error('❌ Failed to start development guards:', error)
    return null
  }
}