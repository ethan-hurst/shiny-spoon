#!/usr/bin/env node

/**
 * Enhanced Pre-commit Hooks Setup - Install comprehensive quality gates
 */

const { execSync } = require('child_process')
const { writeFileSync, chmodSync, existsSync, mkdirSync } = require('fs')
const path = require('path')

function setupEnhancedHooks() {
  console.log('🔧 Setting up enhanced pre-commit hooks...')
  
  // Ensure .husky directory exists
  if (!existsSync('.husky')) {
    mkdirSync('.husky', { recursive: true })
  }
  
  // Ensure husky is installed
  try {
    execSync('npx husky install', { stdio: 'inherit' })
  } catch (error) {
    console.error('❌ Failed to install husky:', error.message)
    process.exit(1)
  }
  
  // Create comprehensive pre-commit hook
  const preCommitContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🛡️  Running development guard checks..."

# 1. TypeScript strict compilation
echo "📝 Checking TypeScript..."
npm run type-check || exit 1

# 2. Security pattern verification
echo "🔒 Verifying security patterns..."
node scripts/check-security-patterns.js || exit 1

# 3. Performance checks
echo "⚡ Checking performance patterns..."
node scripts/check-performance-patterns.js || exit 1

# 4. Code quality checks
echo "✨ Running quality checks..."
npm run lint || exit 1

# 5. Test coverage verification (if tests exist)
echo "🧪 Verifying test coverage..."
npm run test:coverage -- --passWithNoTests --silent || exit 1

echo "✅ All pre-commit checks passed!"
`

  const hookPath = path.join('.husky', 'pre-commit')
  writeFileSync(hookPath, preCommitContent)
  chmodSync(hookPath, '755')
  
  // Create security patterns checker
  const securityPatternsScript = `#!/usr/bin/env node

/**
 * Security Patterns Checker - Pre-commit security validation
 */

const { glob } = require('glob')
const { readFileSync } = require('fs')
const path = require('path')

const SECURITY_PATTERNS = [
  {
    name: 'Missing Organization Filter',
    pattern: /supabase\\.from\\([^)]+\\)\\.select\\([^)]*\\)/g,
    antiPattern: /\\.eq\\s*\\(\\s*['"]organization_id['"].*?\\)/,
    files: ['app/**/*.ts', 'lib/**/*.ts'],
    severity: 'error',
    exclude: ['__tests__/**', '*.d.ts', 'types/**']
  },
  {
    name: 'Missing Rate Limiting',
    pattern: /export\\s+(async\\s+)?function\\s+(GET|POST|PUT|DELETE|PATCH)/g,
    antiPattern: /(createRouteHandler|rateLimit)/,
    files: ['app/api/**/route.ts'],
    severity: 'error'
  },
  {
    name: 'Direct Database Access',
    pattern: /\\.from\\s*\\(\\s*['"][^'"]+['"]\\s*\\)/g,
    antiPattern: /(BaseRepository|Repository|createRouteHandler)/,
    files: ['app/**/*.ts', 'components/**/*.ts'],
    severity: 'warning',
    exclude: ['lib/repositories/**', 'lib/services/**']
  },
  {
    name: 'Missing Error Handling',
    pattern: /(await\\s+fetch\\(|await\\s+supabase\\.|axios\\.[a-z]+\\()/g,
    antiPattern: /(try\\s*\\{|catch\\s*\\(|\\.catch\\()/,
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
            console.error(\`\${icon} \${check.name} in \${file}\`)
            
            if (check.severity === 'error') {
              hasErrors = true
            } else {
              hasWarnings = true
            }
          }
        }
      } catch (error) {
        console.error(\`❌ Failed to check \${file}: \${error.message}\`)
      }
    }
  }
  
  if (hasErrors) {
    console.error('\\n💡 Run "npm run dev:guards start" to get detailed analysis and auto-fixes')
    process.exit(1)
  }
  
  if (hasWarnings) {
    console.warn('\\n⚠️  Security warnings found. Consider running "npm run dev:guards analyze" for details')
  }
  
  console.log('✅ Security patterns check passed')
}

checkSecurityPatterns().catch(error => {
  console.error('❌ Security check failed:', error)
  process.exit(1)
})
`

  writeFileSync('scripts/check-security-patterns.js', securityPatternsScript)
  
  // Create performance patterns checker
  const performancePatternsScript = `#!/usr/bin/env node

/**
 * Performance Patterns Checker - Pre-commit performance validation
 */

const { glob } = require('glob')
const { readFileSync } = require('fs')

const PERFORMANCE_PATTERNS = [
  {
    name: 'Potential N+1 Query in Loop',
    pattern: /(for\\s*\\([^}]+\\{[^}]*supabase|for\\s*\\([^}]+\\{[^}]*fetch\\(|\\.(map|forEach)\\([^}]*supabase|\\.(map|forEach)\\([^}]*fetch\\()/gs,
    files: ['app/**/*.ts', 'lib/**/*.ts'],
    severity: 'warning'
  },
  {
    name: 'Large Bundle Import',
    pattern: /import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"](?:lodash|moment|rxjs)['"]|import\\s+['"](?:lodash|moment|rxjs)['"];/g,
    files: ['app/**/*.ts', 'components/**/*.tsx', 'lib/**/*.ts'],
    severity: 'warning'
  },
  {
    name: 'Missing useCallback for Event Handlers',
    pattern: /onClick=\\{[^}]*\\}|onSubmit=\\{[^}]*\\}|onChange=\\{[^}]*\\}/g,
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
            console.warn(\`\${icon} \${check.name} in \${file}\`)
            hasIssues = true
          }
        }
      } catch (error) {
        console.error(\`❌ Failed to check \${file}: \${error.message}\`)
      }
    }
  }
  
  if (hasIssues) {
    console.warn('\\n💡 Run "npm run dev:guards analyze" for detailed performance analysis')
  }
  
  console.log('✅ Performance patterns check completed')
}

checkPerformancePatterns().catch(error => {
  console.error('❌ Performance check failed:', error)
  process.exit(1)
})
`

  writeFileSync('scripts/check-performance-patterns.js', performancePatternsScript)
  
  // Update lint-staged configuration for incremental checking
  const lintStagedConfig = {
    '*.{ts,tsx,js,jsx}': [
      'node scripts/check-file-guards.js',
      'eslint --fix',
      'git add'
    ],
    '*.{ts,tsx}': [
      'tsc --noEmit --skipLibCheck'
    ]
  }
  
  writeFileSync('.lintstagedrc.json', JSON.stringify(lintStagedConfig, null, 2))
  
  // Create file-specific guard checker
  const fileGuardsScript = `#!/usr/bin/env node

/**
 * File-specific Guards Checker - Run guards on staged files
 */

const { execSync } = require('child_process')

const stagedFiles = process.argv.slice(2)

if (stagedFiles.length > 0) {
  console.log('🔍 Running guards on staged files...')
  
  for (const file of stagedFiles) {
    if (file.match(/\\.(ts|tsx|js|jsx)$/)) {
      try {
        execSync(\`npm run dev:guards analyze "\${file}"\`, { stdio: 'inherit' })
      } catch (error) {
        console.error(\`❌ Guard check failed for \${file}\`)
        process.exit(1)
      }
    }
  }
}
`

  writeFileSync('scripts/check-file-guards.js', fileGuardsScript)
  
  console.log('✅ Enhanced pre-commit hooks configured successfully!')
  console.log('📋 Available commands:')
  console.log('  - npm run dev:guards start    # Start real-time monitoring')
  console.log('  - npm run dev:guards analyze  # Analyze all files')
  console.log('  - npm run setup:hooks         # Re-run this setup')
}

if (require.main === module) {
  try {
    setupEnhancedHooks()
  } catch (error) {
    console.error('❌ Failed to setup enhanced hooks:', error)
    process.exit(1)
  }
}

module.exports = { setupEnhancedHooks }