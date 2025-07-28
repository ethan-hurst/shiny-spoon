#!/usr/bin/env node

/**
 * Security Patterns Checker - Pre-commit security validation
 */

const { glob } = require('glob')
const { readFileSync } = require('fs')
const path = require('path')

const SECURITY_PATTERNS = [
  {
    name: 'Missing Organization Filter',
    pattern: /supabase\.from\([^)]+\)\.select\([^)]*\)/g,
    antiPattern: /\.eq\s*\(\s*['"]organization_id['"].*?\)/,
    files: ['app/**/*.ts', 'lib/**/*.ts'],
    severity: 'error',
    exclude: ['__tests__/**', '*.d.ts', 'types/**']
  },
  {
    name: 'Missing Rate Limiting',
    pattern: /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/g,
    antiPattern: /(createRouteHandler|rateLimit)/,
    files: ['app/api/**/route.ts'],
    severity: 'error'
  },
  {
    name: 'Direct Database Access',
    pattern: /\.from\s*\(\s*['"][^'"]+['"]\s*\)/g,
    antiPattern: /(BaseRepository|Repository|createRouteHandler)/,
    files: ['app/**/*.ts', 'components/**/*.ts'],
    severity: 'warning',
    exclude: ['lib/repositories/**', 'lib/services/**']
  },
  {
    name: 'Missing Error Handling',
    pattern: /(await\s+fetch\(|await\s+supabase\.|axios\.[a-z]+\()/g,
    antiPattern: /(try\s*\{|catch\s*\(|\.catch\()/,
    files: ['app/**/*.ts', 'lib/**/*.ts'],
    severity: 'warning',
    exclude: ['__tests__/**']
  }
]

async function checkSecurityPatterns() {
  console.log('🔍 Checking security patterns...')
  let hasErrors = false
  let hasWarnings = false
  
  for (const check of SECURITY_PATTERNS) {
    const files = await glob(check.files, {
      ignore: ['node_modules/**', '.next/**', ...(check.exclude || [])]
    })
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8')
        const matches = content.match(check.pattern)
        
        if (matches) {
          const hasAntiPattern = check.antiPattern.test(content)
          
          if (!hasAntiPattern) {
            const icon = check.severity === 'error' ? '❌' : '⚠️'
            console.error(`${icon} ${check.name} in ${file}`)
            
            if (check.severity === 'error') {
              hasErrors = true
            } else {
              hasWarnings = true
            }
          }
        }
      } catch (error) {
        console.error(`❌ Failed to check ${file}: ${error.message}`)
      }
    }
  }
  
  if (hasErrors) {
    console.error('\n💡 Run "npm run dev:guards start" to get detailed analysis and auto-fixes')
    process.exit(1)
  }
  
  if (hasWarnings) {
    console.warn('\n⚠️  Security warnings found. Consider running "npm run dev:guards analyze" for details')
  }
  
  console.log('✅ Security patterns check passed')
}

checkSecurityPatterns().catch(error => {
  console.error('❌ Security check failed:', error)
  process.exit(1)
})
