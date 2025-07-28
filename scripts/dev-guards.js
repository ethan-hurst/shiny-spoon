#!/usr/bin/env node

/**
 * Development Guards CLI - Start/stop the development guards system
 */

// Use dynamic import for ES modules
async function loadDevGuards() {
  try {
    // Try to use tsx if available for TypeScript execution
    const { execSync } = require('child_process')
    
    // Check if we can run TypeScript directly
    try {
      const tsxPath = require.resolve('tsx', { paths: [process.cwd()] })
      return { useTsx: true }
    } catch {
      // Fall back to compiled JS or direct execution
      return { useTsx: false }
    }
  } catch (error) {
    console.error('❌ Failed to load development guards:', error)
    return null
  }
}

async function main() {
  const command = process.argv[2]
  
  switch (command) {
    case 'start':
      try {
        console.log('🚀 Starting Development Guards...')
        
        const config = {
          enabled: true,
          verbose: process.argv.includes('--verbose'),
          guards: {
            organizationIsolation: !process.argv.includes('--no-org-isolation'),
            rateLimiting: !process.argv.includes('--no-rate-limiting'),
            nPlusOneQuery: !process.argv.includes('--no-n-plus-one')
          }
        }
        
        await startDevGuards(config)
        
        // Keep the process alive
        process.on('SIGINT', async () => {
          console.log('\n🛑 Shutting down Development Guards...')
          await stopDevGuards()
          process.exit(0)
        })
        
        process.on('SIGTERM', async () => {
          await stopDevGuards()
          process.exit(0)
        })
        
      } catch (error) {
        console.error('❌ Failed to start Development Guards:', error)
        process.exit(1)
      }
      break
      
    case 'status':
      try {
        const devGuards = getDevGuards()
        const status = devGuards.getStatus()
        
        console.log('📊 Development Guards Status:')
        console.log(`  Running: ${status.running ? '✅' : '❌'}`)
        console.log(`  WebSocket Clients: ${status.websocketClients}`)
        console.log(`  Files Processed: ${status.fileWatcherStats.processedFiles}`)
        console.log(`  Violations Found: ${status.fileWatcherStats.violations}`)
        console.log(`  Errors: ${status.fileWatcherStats.errors}`)
        
      } catch (error) {
        console.log('❌ Development Guards not running')
      }
      break
      
    case 'analyze':
      try {
        const filePath = process.argv[3]
        const devGuards = getDevGuards()
        
        if (filePath) {
          console.log(`🔍 Analyzing file: ${filePath}`)
          const violations = await devGuards.analyzeFile(filePath)
          
          if (violations.length === 0) {
            console.log('✅ No violations found')
          } else {
            console.log(`🚨 Found ${violations.length} violations:`)
            violations.forEach(v => {
              console.log(`  ${v.severity === 'error' ? '❌' : '⚠️'} ${v.message}`)
              console.log(`     📍 Line ${v.line}, Column ${v.column}`)
            })
          }
        } else {
          console.log('🔍 Analyzing all files...')
          const results = await devGuards.analyzeAllFiles()
          
          const totalViolations = Object.values(results).reduce((sum, violations) => sum + violations.length, 0)
          console.log(`📊 Found ${totalViolations} violations in ${Object.keys(results).length} files`)
          
          Object.entries(results).forEach(([file, violations]) => {
            console.log(`\n📁 ${file}:`)
            violations.forEach(v => {
              console.log(`  ${v.severity === 'error' ? '❌' : '⚠️'} ${v.message}`)
            })
          })
        }
        
      } catch (error) {
        console.error('❌ Analysis failed:', error)
        process.exit(1)
      }
      break
      
    case 'help':
    default:
      console.log(`
🛡️  Development Guards CLI

Usage:
  npm run dev:guards start [options]    Start the development guards system
  npm run dev:guards status             Check system status
  npm run dev:guards analyze [file]     Analyze file(s) for violations
  npm run dev:guards help               Show this help

Options:
  --verbose                    Enable verbose logging
  --no-org-isolation          Disable organization isolation guard
  --no-rate-limiting           Disable rate limiting guard
  --no-n-plus-one             Disable N+1 query guard

Examples:
  npm run dev:guards start --verbose
  npm run dev:guards analyze app/api/products/route.ts
  npm run dev:guards analyze
`)
      break
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
}

module.exports = { main }