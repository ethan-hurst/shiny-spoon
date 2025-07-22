#!/usr/bin/env node

const { exec } = require('child_process')
const { promisify } = require('util')
const fs = require('fs').promises
const path = require('path')

const execAsync = promisify(exec)

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

// Helper to run commands
async function runCommand(command, description) {
  console.log(`${colors.blue}Running: ${description}${colors.reset}`)
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 5 * 60 * 1000, // 5 minutes timeout
    })

    // Handle warnings separately - log them but don't fail
    if (stderr) {
      const isWarning =
        stderr.toLowerCase().includes('warning') ||
        stderr.toLowerCase().includes('warn') ||
        stderr.toLowerCase().includes('deprecated')

      if (isWarning) {
        console.warn(
          `${colors.yellow}Warning during ${description}:${colors.reset}`
        )
        console.warn(stderr)
      } else {
        // Non-warning stderr should cause failure
        throw new Error(stderr)
      }
    }

    return { success: true, output: stdout }
  } catch (error) {
    if (error.killed && error.signal === 'SIGTERM') {
      return { success: false, error: 'Command timed out after 5 minutes' }
    }
    return { success: false, error: error.message }
  }
}

// Helper to check file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

// Test shadcn component
async function testShadcnComponent() {
  console.log(`${colors.blue}Testing shadcn/ui components...${colors.reset}`)

  const componentsToCheck = [
    'components/ui/button.tsx',
    'components/ui/card.tsx',
    'components/ui/dialog.tsx',
    'components/ui/input.tsx',
  ]

  for (const component of componentsToCheck) {
    const exists = await fileExists(path.join(process.cwd(), component))
    if (!exists) {
      return { success: false, error: `Missing shadcn component: ${component}` }
    }
  }

  return { success: true }
}

// Main validation function
async function validateSetup() {
  console.log(
    `${colors.yellow}🔍 Running PRP-001 Validation Loops...${colors.reset}\n`
  )

  const validations = [
    {
      level: 1,
      name: 'Syntax & Style Check',
      tests: [
        { command: 'npm run lint', description: 'ESLint' },
        { command: 'npm run type-check', description: 'TypeScript' },
      ],
    },
    {
      level: 2,
      name: 'Build Validation',
      tests: [{ command: 'npm run build', description: 'Next.js Build' }],
    },
    {
      level: 3,
      name: 'Component Testing',
      tests: [
        {
          command: async () => testShadcnComponent(),
          description: 'shadcn/ui Components',
        },
      ],
    },
    {
      level: 4,
      name: 'Configuration Validation',
      tests: [
        {
          command: async () => {
            const files = [
              'next.config.ts',
              'tailwind.config.ts',
              'tsconfig.json',
              'postcss.config.js',
            ]
            for (const file of files) {
              if (!(await fileExists(path.join(process.cwd(), file)))) {
                return { success: false, error: `Missing config file: ${file}` }
              }
            }
            return { success: true }
          },
          description: 'Configuration Files',
        },
      ],
    },
  ]

  let allPassed = true
  const results = []

  for (const level of validations) {
    console.log(
      `\n${colors.yellow}Level ${level.level}: ${level.name}${colors.reset}`
    )
    console.log('─'.repeat(50))

    for (const test of level.tests) {
      let result

      if (typeof test.command === 'function') {
        result = await test.command()
      } else {
        result = await runCommand(test.command, test.description)
      }

      if (result.success) {
        console.log(
          `${colors.green}✅ ${test.description} passed${colors.reset}`
        )
      } else {
        console.log(`${colors.red}❌ ${test.description} failed${colors.reset}`)
        console.log(`   ${colors.red}Error: ${result.error}${colors.reset}`)
        allPassed = false
      }

      results.push({
        level: level.level,
        test: test.description,
        passed: result.success,
        error: result.error,
      })
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50))
  console.log(`${colors.yellow}VALIDATION SUMMARY${colors.reset}`)
  console.log('═'.repeat(50))

  const passedCount = results.filter((r) => r.passed).length
  const totalCount = results.length

  console.log(`Total Tests: ${totalCount}`)
  console.log(`Passed: ${colors.green}${passedCount}${colors.reset}`)
  console.log(`Failed: ${colors.red}${totalCount - passedCount}${colors.reset}`)

  if (allPassed) {
    console.log(
      `\n${colors.green}🎉 All PRP-001 validations passed!${colors.reset}`
    )
    process.exit(0)
  } else {
    console.log(
      `\n${colors.red}❌ Some validations failed. Please fix the issues above.${colors.reset}`
    )

    // Show failed tests
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`)
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - Level ${r.level}: ${r.test}`)
      })

    process.exit(1)
  }
}

// Run validation
validateSetup().catch((error) => {
  console.error(
    `${colors.red}Validation script error: ${error.message}${colors.reset}`
  )
  process.exit(1)
})
