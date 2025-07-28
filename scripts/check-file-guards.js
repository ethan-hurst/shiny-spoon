#!/usr/bin/env node

/**
 * File-specific Guards Checker - Run guards on staged files
 */

const { execSync } = require('child_process')

const stagedFiles = process.argv.slice(2)

if (stagedFiles.length > 0) {
  console.log('🔍 Running guards on staged files...')
  
  for (const file of stagedFiles) {
    if (file.match(/\.(ts|tsx|js|jsx)$/)) {
      try {
        execSync(`npm run dev:guards analyze "${file}"`, { stdio: 'inherit' })
      } catch (error) {
        console.error(`❌ Guard check failed for ${file}`)
        process.exit(1)
      }
    }
  }
}
