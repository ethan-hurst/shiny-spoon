#!/usr/bin/env node

/**
 * Simple Development Guards Analysis
 * Basic pattern checking without full TypeScript compilation
 */

const fs = require('fs')
const path = require('path')
const { glob } = require('glob')

const SECURITY_PATTERNS = [
  {
    name: 'Missing Organization Filter',
    pattern: /supabase\.from\([^)]+\)\.select\([^)]*\)/g,
    antiPattern: /\.eq\s*\(\s*['"]organization_id['"].*?\)/,
    files: ['app/**/*.ts', 'lib/**/*.ts'],
    severity: 'error'
  },
  {
    name: 'Missing Rate Limiting', 
    pattern: /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/g,
    antiPattern: /(createRouteHandler|rateLimit)/,
    files: ['app/api/**/route.ts'],
    severity: 'error'
  }
]

const PERFORMANCE_PATTERNS = [
  {
    name: 'Potential N+1 Query in Loop',
    pattern: /(for\s*\([^}]+\{[^}]*supabase|for\s*\([^}]+\{[^}]*fetch\(|\.map\([^}]*supabase|\.map\([^}]*fetch\()/gs,
    files: ['app/**/*.ts', 'lib/**/*.ts'],
    severity: 'warning'
  }
]

async function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const violations = []
    
    const allPatterns = [...SECURITY_PATTERNS, ...PERFORMANCE_PATTERNS]
    
    for (const pattern of allPatterns) {
      // Check if this file type should be checked for this pattern
      const shouldCheck = pattern.files.some(filePattern => {
        const regex = new RegExp(filePattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
        return regex.test(filePath)
      })
      
      if (shouldCheck) {
        const matches = content.match(pattern.pattern)
        if (matches) {
          const hasAntiPattern = pattern.antiPattern ? pattern.antiPattern.test(content) : false
          
          if (!hasAntiPattern) {
            violations.push({
              type: pattern.severity === 'error' ? 'security' : 'performance',
              severity: pattern.severity,
              message: pattern.name,
              file: filePath
            })
          }
        }
      }
    }
    
    return violations
  } catch (error) {
    console.error(`❌ Failed to analyze ${filePath}:`, error.message)
    return []
  }
}

async function analyzeAllFiles() {
  console.log('🔍 Analyzing files for development guard violations...')
  
  const filePatterns = [
    'app/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}'
  ]
  
  const allFiles = []
  for (const pattern of filePatterns) {
    const files = await glob(pattern, {
      ignore: ['node_modules/**', '.next/**', '__tests__/**', '**/*.d.ts']
    })
    allFiles.push(...files)
  }
  
  console.log(`📁 Found ${allFiles.length} files to analyze`)
  
  const allViolations = []
  let filesWithViolations = 0
  
  for (const file of allFiles) {
    const violations = await analyzeFile(file)
    if (violations.length > 0) {
      allViolations.push(...violations)
      filesWithViolations++
      
      console.log(`\n🚨 ${violations.length} violation(s) in ${file}:`)
      violations.forEach(v => {
        const icon = v.severity === 'error' ? '❌' : '⚠️'
        console.log(`  ${icon} ${v.message}`)
      })
    }
  }
  
  console.log('\n📊 Analysis Results:')
  console.log(`  Files analyzed: ${allFiles.length}`)
  console.log(`  Files with violations: ${filesWithViolations}`)
  console.log(`  Total violations: ${allViolations.length}`)
  
  const errors = allViolations.filter(v => v.severity === 'error').length
  const warnings = allViolations.filter(v => v.severity === 'warning').length
  
  console.log(`  Errors: ${errors}`)
  console.log(`  Warnings: ${warnings}`)
  
  if (allViolations.length === 0) {
    console.log('\n✅ No violations found! Great job! 🎉')
  } else {
    console.log('\n💡 To fix these issues:')
    console.log('  1. Run "npm run dev:guards start" for real-time monitoring')
    console.log('  2. Use createRouteHandler for API routes')
    console.log('  3. Add .eq("organization_id", organizationId) to database queries')
    console.log('  4. Avoid database queries inside loops')
  }
  
  return allViolations
}

async function main() {
  const command = process.argv[2]
  const target = process.argv[3]
  
  switch (command) {
    case 'analyze':
      if (target && target !== '--help') {
        // Analyze specific file
        console.log(`🔍 Analyzing file: ${target}`)
        const violations = await analyzeFile(target)
        
        if (violations.length === 0) {
          console.log('✅ No violations found')
        } else {
          console.log(`🚨 Found ${violations.length} violations:`)
          violations.forEach(v => {
            const icon = v.severity === 'error' ? '❌' : '⚠️'
            console.log(`  ${icon} ${v.message}`)
          })
        }
      } else {
        // Analyze all files
        await analyzeAllFiles()
      }
      break
      
    case 'help':
    default:
      console.log(`
🛡️  Development Guards Quick Analysis

Usage:
  npm run dev:guards:quick analyze [file]    Analyze file(s) for violations
  npm run dev:guards:quick help              Show this help

Examples:
  npm run dev:guards:quick analyze app/api/products/route.ts
  npm run dev:guards:quick analyze

Note: This is a simplified analysis. For full real-time monitoring with
auto-fixes, use: npm run dev:guards start
`)
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Analysis failed:', error)
    process.exit(1)
  })
}

module.exports = { analyzeFile, analyzeAllFiles }