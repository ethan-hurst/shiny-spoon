/**
 * File Watcher Service - Real-time monitoring of TypeScript/JavaScript files
 * Detects changes and runs development guards automatically
 */

import chokidar from 'chokidar'
import path from 'path'
import { AST, analyze, isSystemFile, Violation } from './ast-analyzer'
import { BaseGuard } from './base-guard'

export interface FileWatcherOptions {
  enabled?: boolean
  watchPaths?: string[]
  ignorePaths?: string[]
  debounceMs?: number
  verbose?: boolean
}

export interface GuardStats {
  totalFiles: number
  processedFiles: number
  violations: number
  errors: number
  lastRun: Date | null
}

export class FileWatcherService {
  private watcher: chokidar.FSWatcher | null = null
  private guards: BaseGuard[] = []
  private options: Required<FileWatcherOptions>
  private stats: GuardStats
  private onViolationsCallback?: (violations: Violation[], filePath: string) => void
  private processingQueue: Map<string, NodeJS.Timeout> = new Map()

  constructor(options: FileWatcherOptions = {}) {
    this.options = {
      enabled: options.enabled ?? (process.env.NODE_ENV === 'development'),
      watchPaths: options.watchPaths ?? [
        'app/**/*.{ts,tsx,js,jsx}',
        'lib/**/*.{ts,tsx,js,jsx}',
        'components/**/*.{ts,tsx,js,jsx}',
        'hooks/**/*.{ts,tsx,js,jsx}',
        'utils/**/*.{ts,tsx,js,jsx}'
      ],
      ignorePaths: options.ignorePaths ?? [
        'node_modules/**',
        '.next/**',
        'dist/**',
        'build/**',
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
        '**/*.d.ts'
      ],
      debounceMs: options.debounceMs ?? 500,
      verbose: options.verbose ?? false
    }

    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      violations: 0,
      errors: 0,
      lastRun: null
    }
  }

  /**
   * Add a guard to the service
   */
  addGuard(guard: BaseGuard): void {
    this.guards.push(guard)
    if (this.options.verbose) {
      console.log(`🛡️  Added guard: ${guard.getName()}`)
    }
  }

  /**
   * Remove a guard from the service
   */
  removeGuard(guardName: string): void {
    this.guards = this.guards.filter(guard => guard.getName() !== guardName)
    if (this.options.verbose) {
      console.log(`🗑️  Removed guard: ${guardName}`)
    }
  }

  /**
   * Set callback for violations
   */
  onViolations(callback: (violations: Violation[], filePath: string) => void): void {
    this.onViolationsCallback = callback
  }

  /**
   * Start watching files
   */
  async start(): Promise<void> {
    if (!this.options.enabled) {
      console.log('🛡️  Development guards disabled (NODE_ENV or enabled option)')
      return
    }

    if (this.watcher) {
      console.warn('🛡️  File watcher already running')
      return
    }

    console.log('🛡️  Starting development guards...')
    console.log(`📁 Watching: ${this.options.watchPaths.join(', ')}`)
    console.log(`🚫 Ignoring: ${this.options.ignorePaths.join(', ')}`)
    console.log(`🔧 Guards loaded: ${this.guards.map(g => g.getName()).join(', ')}`)

    this.watcher = chokidar.watch(this.options.watchPaths, {
      ignored: this.options.ignorePaths,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    })

    this.watcher
      .on('add', (filePath) => this.scheduleFileAnalysis(filePath, 'added'))
      .on('change', (filePath) => this.scheduleFileAnalysis(filePath, 'changed'))
      .on('unlink', (filePath) => this.handleFileRemoved(filePath))
      .on('error', (error) => {
        console.error('🚨 File watcher error:', error)
        this.stats.errors++
      })

    console.log('✅ Development guards started successfully')
  }

  /**
   * Stop watching files
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
      console.log('🛑 Development guards stopped')
    }

    // Clear any pending analyses
    this.processingQueue.forEach(timeout => clearTimeout(timeout))
    this.processingQueue.clear()
  }

  /**
   * Schedule file analysis with debouncing
   */
  private scheduleFileAnalysis(filePath: string, action: 'added' | 'changed'): void {
    // Clear existing timeout for this file
    const existingTimeout = this.processingQueue.get(filePath)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Schedule new analysis
    const timeout = setTimeout(() => {
      this.analyzeFile(filePath, action)
      this.processingQueue.delete(filePath)
    }, this.options.debounceMs)

    this.processingQueue.set(filePath, timeout)
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(filePath: string, action: 'added' | 'changed'): Promise<void> {
    try {
      // Skip system files
      if (isSystemFile(filePath)) {
        return
      }

      if (this.options.verbose) {
        console.log(`🔍 Analyzing ${action} file: ${path.relative(process.cwd(), filePath)}`)
      }

      this.stats.totalFiles++
      
      // Analyze the file
      const ast = await analyze(filePath)
      const allViolations: Violation[] = []

      // Run all enabled guards
      for (const guard of this.guards) {
        if (!guard.isEnabled()) continue

        try {
          const violations = await guard.check(ast, filePath)
          allViolations.push(...violations)
        } catch (error) {
          console.error(`❌ Guard ${guard.getName()} failed for ${filePath}:`, error)
          this.stats.errors++
        }
      }

      this.stats.processedFiles++
      this.stats.violations += allViolations.length
      this.stats.lastRun = new Date()

      // Report violations
      if (allViolations.length > 0) {
        this.reportViolations(filePath, allViolations)
        
        if (this.onViolationsCallback) {
          this.onViolationsCallback(allViolations, filePath)
        }
      } else if (this.options.verbose) {
        console.log(`✅ No violations found in ${path.relative(process.cwd(), filePath)}`)
      }

    } catch (error) {
      console.error(`❌ Failed to analyze ${filePath}:`, error)
      this.stats.errors++
    }
  }

  /**
   * Handle file removal
   */
  private handleFileRemoved(filePath: string): void {
    if (this.options.verbose) {
      console.log(`🗑️  File removed: ${path.relative(process.cwd(), filePath)}`)
    }
    
    // Clear any pending analysis for this file
    const timeout = this.processingQueue.get(filePath)
    if (timeout) {
      clearTimeout(timeout)
      this.processingQueue.delete(filePath)
    }
  }

  /**
   * Report violations to console and callbacks
   */
  private reportViolations(filePath: string, violations: Violation[]): void {
    const relativePath = path.relative(process.cwd(), filePath)
    
    console.log(`\n🚨 ${violations.length} violation(s) in ${relativePath}:`)
    
    violations.forEach(violation => {
      const icon = violation.severity === 'error' ? '❌' : 
                   violation.severity === 'warning' ? '⚠️' : 'ℹ️'
      const typeIcon = violation.type === 'security' ? '🔒' : 
                       violation.type === 'performance' ? '⚡' : '✨'
      
      console.log(`  ${icon} ${typeIcon} [${violation.type.toUpperCase()}] ${violation.message}`)
      console.log(`     📍 Line ${violation.line}, Column ${violation.column}`)
      
      if (violation.quickFix) {
        console.log(`     💡 Quick fix available`)
      }
      
      if (violation.suggestion) {
        console.log(`     💭 Suggestion: ${violation.suggestion}`)
      }
    })
    
    console.log('') // Empty line for readability
  }

  /**
   * Get current statistics
   */
  getStats(): GuardStats {
    return { ...this.stats }
  }

  /**
   * Manually trigger analysis of a specific file
   */
  async analyzeFileManually(filePath: string): Promise<Violation[]> {
    try {
      const ast = await analyze(filePath)
      const allViolations: Violation[] = []

      for (const guard of this.guards) {
        if (!guard.isEnabled()) continue
        
        const violations = await guard.check(ast, filePath)
        allViolations.push(...violations)
      }

      return allViolations
    } catch (error) {
      console.error(`❌ Manual analysis failed for ${filePath}:`, error)
      return []
    }
  }

  /**
   * Analyze all files in the watch paths
   */
  async analyzeAllFiles(): Promise<{ [filePath: string]: Violation[] }> {
    const results: { [filePath: string]: Violation[] } = {}
    
    console.log('🔍 Analyzing all files...')
    
    const glob = await import('glob')
    
    for (const pattern of this.options.watchPaths) {
      const files = await glob.glob(pattern, {
        ignore: this.options.ignorePaths
      })
      
      for (const filePath of files) {
        if (!isSystemFile(filePath)) {
          const violations = await this.analyzeFileManually(filePath)
          if (violations.length > 0) {
            results[filePath] = violations
          }
        }
      }
    }
    
    console.log(`✅ Analysis complete. Found violations in ${Object.keys(results).length} files`)
    return results
  }
}