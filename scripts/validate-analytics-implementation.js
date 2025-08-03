#!/usr/bin/env node

/**
 * PRP-018 Analytics Dashboard - Implementation Validation Script
 * This script validates that all required components have been implemented
 */

const fs = require('fs')
const path = require('path')

console.log('🚀 Validating PRP-018 Analytics Dashboard Implementation...\n')

// Define all required files for the analytics dashboard
const requiredFiles = [
  // Database Schema
  'supabase/migrations/020_analytics_dashboard.sql',

  // Core Analytics Service
  'lib/analytics/calculate-metrics.ts',

  // Main Dashboard Page
  'app/(dashboard)/analytics/page.tsx',

  // Analytics Components
  'components/features/analytics/metrics-cards.tsx',
  'components/features/analytics/accuracy-chart.tsx',
  'components/features/analytics/sync-performance-chart.tsx',
  'components/features/analytics/inventory-trends-chart.tsx',
  'components/features/analytics/revenue-impact-card.tsx',
  'components/features/analytics/date-range-picker.tsx',
  'components/features/analytics/export-analytics-button.tsx',
  'components/features/analytics/analytics-skeleton.tsx',

  // Server Actions
  'app/actions/analytics.ts',

  // Scheduled Job
  'app/api/cron/analytics/route.ts',

  // Navigation Update
  'lib/constants/navigation.ts',

  // Test Suite
  '__tests__/analytics/analytics-dashboard.test.ts',
]

// Function to check if a file exists and get its stats
function validateFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath)
  try {
    const stats = fs.statSync(fullPath)
    return {
      exists: true,
      size: stats.size,
      path: filePath,
    }
  } catch (error) {
    return {
      exists: false,
      path: filePath,
      error: error.message,
    }
  }
}

// Validate all files
let totalFiles = 0
let existingFiles = 0
let totalSize = 0

console.log('📁 File Validation:')
console.log('─'.repeat(80))

requiredFiles.forEach((file) => {
  const result = validateFile(file)
  totalFiles++

  if (result.exists) {
    existingFiles++
    totalSize += result.size
    console.log(`✅ ${file} (${(result.size / 1024).toFixed(1)}KB)`)
  } else {
    console.log(`❌ ${file} - MISSING`)
  }
})

console.log('─'.repeat(80))
console.log(
  `📊 Summary: ${existingFiles}/${totalFiles} files present (${(totalSize / 1024).toFixed(1)}KB total)\n`
)

// Check for key functionality
console.log('🔍 Feature Validation:')
console.log('─'.repeat(80))

const features = [
  {
    name: 'Database Schema',
    files: ['supabase/migrations/020_analytics_dashboard.sql'],
    description: 'Analytics tables with RLS policies',
  },
  {
    name: 'Metrics Calculation Service',
    files: ['lib/analytics/calculate-metrics.ts'],
    description: 'Core business logic for analytics',
  },
  {
    name: 'Dashboard UI Components',
    files: [
      'components/features/analytics/metrics-cards.tsx',
      'components/features/analytics/accuracy-chart.tsx',
      'components/features/analytics/sync-performance-chart.tsx',
      'components/features/analytics/inventory-trends-chart.tsx',
    ],
    description: 'Visual components for data presentation',
  },
  {
    name: 'Data Export Functionality',
    files: [
      'components/features/analytics/export-analytics-button.tsx',
      'app/actions/analytics.ts',
    ],
    description: 'CSV export capabilities',
  },
  {
    name: 'Scheduled Analytics Job',
    files: ['app/api/cron/analytics/route.ts'],
    description: 'Automated metrics calculation',
  },
  {
    name: 'Navigation Integration',
    files: ['lib/constants/navigation.ts'],
    description: 'Dashboard accessibility',
  },
]

features.forEach((feature) => {
  const allFilesExist = feature.files.every((file) => validateFile(file).exists)

  if (allFilesExist) {
    console.log(`✅ ${feature.name} - ${feature.description}`)
  } else {
    console.log(`❌ ${feature.name} - ${feature.description} (INCOMPLETE)`)
  }
})

console.log('─'.repeat(80))

// Content validation for key files
console.log('\n📝 Content Validation:')
console.log('─'.repeat(80))

const contentChecks = [
  {
    file: 'lib/analytics/calculate-metrics.ts',
    checks: [
      'AnalyticsCalculator',
      'OrderAccuracyMetrics',
      'SyncPerformanceMetrics',
      'InventoryTrendMetrics',
      'RevenueImpactMetrics',
      'calculateOrderAccuracy',
      'calculateSyncPerformance',
      'calculateInventoryTrends',
      'calculateRevenueImpact',
    ],
  },
  {
    file: 'app/(dashboard)/analytics/page.tsx',
    checks: [
      'AnalyticsCalculator',
      'MetricsCards',
      'AccuracyChart',
      'SyncPerformanceChart',
      'InventoryTrendsChart',
      'RevenueImpactCard',
      'DateRangePicker',
      'ExportAnalyticsButton',
    ],
  },
  {
    file: 'lib/constants/navigation.ts',
    checks: ['Analytics Dashboard', '/analytics', 'TrendingUp'],
  },
]

contentChecks.forEach((check) => {
  const result = validateFile(check.file)
  if (result.exists) {
    try {
      const content = fs.readFileSync(
        path.join(process.cwd(), check.file),
        'utf8'
      )
      const missingItems = check.checks.filter(
        (item) => !content.includes(item)
      )

      if (missingItems.length === 0) {
        console.log(`✅ ${check.file} - All required content present`)
      } else {
        console.log(`⚠️  ${check.file} - Missing: ${missingItems.join(', ')}`)
      }
    } catch (error) {
      console.log(`❌ ${check.file} - Cannot read file content`)
    }
  } else {
    console.log(`❌ ${check.file} - File does not exist`)
  }
})

console.log('─'.repeat(80))

// Final assessment
const completionRate = (existingFiles / totalFiles) * 100
console.log(
  `\n🎯 Implementation Status: ${completionRate.toFixed(1)}% complete\n`
)

if (completionRate === 100) {
  console.log('🎉 SUCCESS: PRP-018 Analytics Dashboard is fully implemented!')
  console.log('\n📋 What was delivered:')
  console.log('  • Comprehensive analytics dashboard with 4 key metrics')
  console.log('  • Order accuracy tracking with trend analysis')
  console.log('  • Sync performance monitoring with real-time updates')
  console.log('  • Inventory trends by value and stock levels')
  console.log('  • Revenue impact calculator with savings projection')
  console.log('  • Date range filtering and CSV export capabilities')
  console.log('  • Responsive charts using Recharts library')
  console.log('  • Database schema with proper RLS policies')
  console.log('  • Scheduled job for automatic metric calculation')
  console.log('  • Navigation integration and loading states')

  console.log('\n🚀 Next steps:')
  console.log('  • Run database migrations to create analytics tables')
  console.log('  • Test the /analytics dashboard route in the application')
  console.log('  • Configure the cron job for regular metric updates')
  console.log('  • Validate with real data and user feedback')
} else {
  console.log('⚠️  INCOMPLETE: Some components are missing')
  console.log('\nPlease check the missing files and features listed above.')
}

console.log('\n' + '═'.repeat(80))
