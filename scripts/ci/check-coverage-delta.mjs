#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

// Simplified placeholder: reads coverage-summary.json and ensures thresholds
// Future enhancement: compare against base branch for delta coverage.

const checklistPath = process.argv[2]
if (!checklistPath) {
  console.error('Usage: check-coverage-delta.mjs <checklist.json>')
  process.exit(1)
}
if (!fs.existsSync(checklistPath)) {
  console.error('Checklist file not found:', checklistPath)
  process.exit(1)
}

const checklist = JSON.parse(fs.readFileSync(checklistPath, 'utf-8'))
const gates = checklist.gates || {}
const covGate = gates.coverage
if (!covGate) {
  console.log('No coverage gate specified. Skipping.')
  process.exit(0)
}

const coverageFile = path.join(process.cwd(), 'coverage', 'coverage-summary.json')
if (!fs.existsSync(coverageFile)) {
  console.error('Coverage summary not found. Run tests with coverage first.')
  process.exit(1)
}
const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf-8'))
const total = coverage.total

function pct(v) { return (v.pct || 0) / 100 }

const failures = []
if (pct(total.statements) < covGate.statements) failures.push(`Statements ${total.statements.pct}% < ${covGate.statements*100}%`)
if (pct(total.branches)   < covGate.branches)   failures.push(`Branches ${total.branches.pct}% < ${covGate.branches*100}%`)
if (pct(total.functions)  < covGate.functions)  failures.push(`Functions ${total.functions.pct}% < ${covGate.functions*100}%`)
if (pct(total.lines)      < covGate.lines)      failures.push(`Lines ${total.lines.pct}% < ${covGate.lines*100}%`)

if (failures.length) {
  console.error('Coverage thresholds not met:')
  failures.forEach(f => console.error(' -', f))
  process.exit(1)
}
console.log('✓ Coverage thresholds met')
