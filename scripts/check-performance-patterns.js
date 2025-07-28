#!/usr/bin/env node

/**
 * Performance Patterns Checker - Pre-commit performance validation
 */

const { glob } = require('glob')
const { readFileSync } = require('fs')

const PERFORMANCE_PATTERNS = [
  {
    name: 'Potential N+1 Query in Loop',
    pattern: /(for\s*\([^}]+\{[^}]*supabase|for\s*\([^}]+\{[^}]*fetch\(|\.(map|forEach)\([^}]*supabase|\.(map|forEach)\([^}]*fetch\()/gs,
    files: ['app/**/*.ts', 'lib/**/*.ts'],
    severity: 'warning'
  },
  {
    name: 'Large Bundle Import',
    pattern: /import\s+\*\s+as\s+\w+\s+from\s+['"](?:lodash|moment|rxjs)['"]|import\s+['"](?:lodash|moment|rxjs)['"];/g,
    files: ['app/**/*.ts', 'components/**/*.tsx', 'lib/**/*.ts'],
    severity: 'warning'
  },
  {
    name: 'Missing useCallback for Event Handlers',
    pattern: /onClick=\{[^}]*\}|onSubmit=\{[^}]*\}|onChange=\{[^}]*\}/g,
    antiPattern: /useCallback/,
    files: ['components/**/*.tsx'],
    severity: 'info'
  }
]

async function checkPerformancePatterns() {
  console.log('🔍 Checking performance patterns...')
  let hasIssues = false
  
  for (const check of PERFORMANCE_PATTERNS) {
    const files = await glob(check.files, {
      ignore: ['node_modules/**', '.next/**', '__tests__/**']
    })
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8')
        const matches = content.match(check.pattern)
        
        if (matches) {
          const hasAntiPattern = check.antiPattern ? check.antiPattern.test(content) : false
          
          if (!hasAntiPattern) {
            const icon = check.severity === 'warning' ? '⚠️' : 'ℹ️'
            console.warn(`${icon} ${check.name} in ${file}`)
            hasIssues = true
          }
        }
      } catch (error) {
        console.error(`❌ Failed to check ${file}: ${error.message}`)
      }
    }
  }
  
  if (hasIssues) {
    console.warn('\n💡 Run "npm run dev:guards analyze" for detailed performance analysis')
  }
  
  console.log('✅ Performance patterns check completed')
}

checkPerformancePatterns().catch(error => {
  console.error('❌ Performance check failed:', error)
  process.exit(1)
})
