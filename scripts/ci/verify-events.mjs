#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

// Naive implementation: ensure required event names appear somewhere in src code.
// Enhancement later: parse structured logging invocations.

const checklistPath = process.argv[2]
if (!checklistPath) {
  console.error('Usage: verify-events.mjs <checklist.json>')
  process.exit(1)
}
if (!fs.existsSync(checklistPath)) {
  console.error('Checklist file not found:', checklistPath)
  process.exit(1)
}

const checklist = JSON.parse(fs.readFileSync(checklistPath, 'utf-8'))
const events = (checklist.observability?.events || []).map(e => e.name)
if (!events.length) {
  console.log('No events declared in checklist. Skipping.')
  process.exit(0)
}

// Collect candidate files (simple recursive walk under app, lib, components, hooks)
const roots = ['app', 'lib', 'components', 'hooks']
const projectRoot = process.cwd()
const files = []
function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walk(full)
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) files.push(full)
  }
}
roots.forEach(r => walk(path.join(projectRoot, r)))

const missing = new Set(events)
for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8')
  for (const ev of events) {
    if (content.includes(ev)) missing.delete(ev)
  }
  if (!missing.size) break
}

if (missing.size) {
  console.error('Missing required event references in code:')
  for (const ev of missing) console.error(' -', ev)
  process.exit(1)
}
console.log('✓ All declared observability events referenced in codebase')
