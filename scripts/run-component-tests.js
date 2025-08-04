#!/usr/bin/env node

/**
 * Component Test Runner for TruthSource
 * 
 * This script provides a comprehensive way to run React component tests
 * with various options for different testing scenarios.
 */

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// Configuration
const CONFIG = {
  testPatterns: {
    ui: '**/ui/**/*.test.{js,jsx,ts,tsx}',
    auth: '**/auth/**/*.test.{js,jsx,ts,tsx}',
    features: '**/features/**/*.test.{js,jsx,ts,tsx}',
    all: '**/components/**/*.test.{js,jsx,ts,tsx}',
  },
  coverageThresholds: {
    statements: 80,
    branches: 70,
    functions: 80,
    lines: 80,
  },
  watchPatterns: {
    unit: '__tests__/unit/**/*.test.{js,jsx,ts,tsx}',
    integration: '__tests__/integration/**/*.test.{js,jsx,ts,tsx}',
  },
}

// Command line argument parsing
const args = process.argv.slice(2)
const command = args[0] || 'help'

// Available commands
const commands = {
  help: () => {
    console.log(`
TruthSource Component Test Runner

Usage: node scripts/run-component-tests.js <command> [options]

Commands:
  run [type]           Run tests for specific component type
  watch [type]         Watch mode for specific component type
  coverage [type]      Run tests with coverage reporting
  ci                   Run all tests in CI mode
  debug [type]         Run tests in debug mode
  performance [type]   Run performance tests
  accessibility [type] Run accessibility tests
  security [type]      Run security-focused tests

Component Types:
  ui                   UI components (Button, Input, etc.)
  auth                 Authentication components
  features             Feature components (Inventory, Analytics, etc.)
  all                  All components

Options:
  --verbose            Verbose output
  --bail              Exit on first failure
  --coverage          Generate coverage report
  --watch             Watch mode
  --debug             Debug mode
  --performance       Performance testing
  --accessibility     Accessibility testing
  --security          Security testing

Examples:
  node scripts/run-component-tests.js run ui
  node scripts/run-component-tests.js watch features --coverage
  node scripts/run-component-tests.js ci
  node scripts/run-component-tests.js performance all
`)
  },

  run: (type = 'all') => {
    const pattern = CONFIG.testPatterns[type] || CONFIG.testPatterns.all
    const options = buildJestOptions({
      pattern,
      coverage: args.includes('--coverage'),
      verbose: args.includes('--verbose'),
      bail: args.includes('--bail'),
    })
    
    console.log(`Running ${type} component tests...`)
    runJest(options)
  },

  watch: (type = 'all') => {
    const pattern = CONFIG.testPatterns[type] || CONFIG.testPatterns.all
    const options = buildJestOptions({
      pattern,
      watch: true,
      coverage: args.includes('--coverage'),
      verbose: args.includes('--verbose'),
    })
    
    console.log(`Watching ${type} component tests...`)
    runJest(options)
  },

  coverage: (type = 'all') => {
    const pattern = CONFIG.testPatterns[type] || CONFIG.testPatterns.all
    const options = buildJestOptions({
      pattern,
      coverage: true,
      coverageThreshold: CONFIG.coverageThresholds,
      verbose: args.includes('--verbose'),
    })
    
    console.log(`Running ${type} component tests with coverage...`)
    runJest(options)
  },

  ci: () => {
    const options = buildJestOptions({
      pattern: CONFIG.testPatterns.all,
      coverage: true,
      coverageThreshold: CONFIG.coverageThresholds,
      bail: true,
      ci: true,
    })
    
    console.log('Running all component tests in CI mode...')
    runJest(options)
  },

  debug: (type = 'all') => {
    const pattern = CONFIG.testPatterns[type] || CONFIG.testPatterns.all
    const options = buildJestOptions({
      pattern,
      verbose: true,
      debug: true,
      noCache: true,
    })
    
    console.log(`Running ${type} component tests in debug mode...`)
    runJest(options)
  },

  performance: (type = 'all') => {
    const pattern = CONFIG.testPatterns[type] || CONFIG.testPatterns.all
    const options = buildJestOptions({
      pattern,
      testNamePattern: 'Performance',
      verbose: true,
    })
    
    console.log(`Running ${type} performance tests...`)
    runJest(options)
  },

  accessibility: (type = 'all') => {
    const pattern = CONFIG.testPatterns[type] || CONFIG.testPatterns.all
    const options = buildJestOptions({
      pattern,
      testNamePattern: 'Accessibility',
      verbose: true,
    })
    
    console.log(`Running ${type} accessibility tests...`)
    runJest(options)
  },

  security: (type = 'all') => {
    const pattern = CONFIG.testPatterns[type] || CONFIG.testPatterns.all
    const options = buildJestOptions({
      pattern,
      testNamePattern: 'Security',
      verbose: true,
    })
    
    console.log(`Running ${type} security tests...`)
    runJest(options)
  },
}

// Helper functions
function buildJestOptions({
  pattern,
  watch = false,
  coverage = false,
  coverageThreshold = null,
  verbose = false,
  bail = false,
  ci = false,
  debug = false,
  noCache = false,
  testNamePattern = null,
}) {
  const options = ['--config', 'jest.config.js']
  
  if (pattern) {
    options.push('--testPathPatterns', pattern)
  }
  
  if (watch) {
    options.push('--watch')
  }
  
  if (coverage) {
    options.push('--coverage')
  }
  
  if (coverageThreshold) {
    options.push('--coverageThreshold', JSON.stringify(coverageThreshold))
  }
  
  if (verbose) {
    options.push('--verbose')
  }
  
  if (bail) {
    options.push('--bail')
  }
  
  if (ci) {
    options.push('--ci', '--coverageReporters', 'text', '--coverageReporters', 'lcov')
  }
  
  if (debug) {
    options.push('--detectOpenHandles', '--forceExit')
  }
  
  if (noCache) {
    options.push('--no-cache')
  }
  
  if (testNamePattern) {
    options.push('--testNamePattern', testNamePattern)
  }
  
  return options
}

function runJest(options) {
  const jestProcess = spawn('npx', ['jest', ...options], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  
  jestProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ All tests passed!')
    } else {
      console.log(`\n❌ Tests failed with exit code ${code}`)
      process.exit(code)
    }
  })
  
  jestProcess.on('error', (error) => {
    console.error('Failed to start Jest:', error)
    process.exit(1)
  })
}

// Test validation functions
function validateTestStructure() {
  const testDirs = [
    '__tests__/unit/components/ui',
    '__tests__/unit/components/auth',
    '__tests__/unit/components/features',
  ]
  
  const missingDirs = testDirs.filter(dir => !fs.existsSync(dir))
  
  if (missingDirs.length > 0) {
    console.warn('Warning: Missing test directories:', missingDirs)
  }
  
  return missingDirs.length === 0
}

function generateTestReport() {
  const report = {
    timestamp: new Date().toISOString(),
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    coverage: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    },
  }
  
  // This would be populated by actual test results
  return report
}

// Main execution
if (commands[command]) {
  const type = args[1] || 'all'
  
  // Validate test structure
  if (!validateTestStructure()) {
    console.warn('Test structure validation failed. Some tests may not run properly.')
  }
  
  // Execute command
  commands[command](type)
} else {
  console.error(`Unknown command: ${command}`)
  commands.help()
  process.exit(1)
}

// Export for potential use in other scripts
module.exports = {
  commands,
  CONFIG,
  buildJestOptions,
  runJest,
  validateTestStructure,
  generateTestReport,
} 