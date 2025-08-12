#!/usr/bin/env node
// PRP Execution Orchestrator
// Usage: pnpm prp:execute PRPs/PhaseX/PRP-XXX.md

import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

function log(msg) { console.log(`[prp-exec] ${msg}`) }
function fail(msg, code = 1) { console.error(`[prp-exec] ERROR: ${msg}`); process.exit(code) }

const prpPath = process.argv[2]
if (!prpPath) fail('Missing PRP markdown path argument')
if (!fs.existsSync(prpPath)) fail(`PRP file not found: ${prpPath}`)

// Derive checklist path
const checklistPath = prpPath.replace(/\.md$/, '.checklist.json')
if (!fs.existsSync(checklistPath)) fail(`Checklist JSON missing: ${checklistPath}`)

// Load checklist
let checklist
try { checklist = JSON.parse(fs.readFileSync(checklistPath, 'utf-8')) } catch (e) { fail(`Invalid checklist JSON: ${e.message}`) }

// Basic schema presence (lightweight before full validator)
for (const key of ['prp','gates','risk']) {
  if (!(key in checklist)) fail(`Checklist missing required key: ${key}`)
}

// Run schema validation via existing script
log('Validating checklist schema')
let r = spawnSync('node', ['scripts/ci/validate-prp-checklist.mjs', checklistPath], { stdio: 'inherit' })
if (r.status !== 0) fail('Checklist schema validation failed')

const gates = checklist.gates || {}
const riskTier = checklist.risk?.tier || 'UNKNOWN'
log(`Risk tier: ${riskTier}`)

// Helper to run commands
function run(cmd, args, opts={}) {
  log(`Running: ${cmd} ${args.join(' ')}`)
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts })
  if (res.status !== 0) fail(`Command failed: ${cmd} ${args.join(' ')}`)
}

// Mandatory base gates
run('pnpm', ['lint'])
run('pnpm', ['prettier','--check','.'])
run('pnpm', ['type-check'])
run('pnpm', ['build'])

// Policy tests
if (gates.policyTests) {
  try { run('pnpm', ['test:policies']) } catch (e) { fail('Policy tests failed') }
}
// Performance test
if (gates.perfTest?.required) {
  process.env.RUN_PERF_TESTS = '1'
  try { run('pnpm', ['test:perf']) } catch (e) { fail('Performance tests failed') }
}
// Load test for HIGH/CRITICAL
if (['HIGH','CRITICAL'].includes(riskTier)) {
  try { run('pnpm', ['test:load']) } catch (e) { fail('Load tests failed') }
}
// Events verification
try { run('pnpm', ['prp:check:events', checklistPath]) } catch (e) { fail('Event verification failed') }
// Coverage gate
if (gates.coverage) {
  // Ensure coverage generated
  run('pnpm', ['test:coverage'])
  run('pnpm', ['prp:check:coverage', checklistPath])
}

// TODO: dependency verification & feature flag registry sync can be added here

log('All gates passed')

// Update PRP-STATUS.md entry (append if not present)
const statusFile = path.join(process.cwd(), 'PRP-STATUS.md')
if (fs.existsSync(statusFile)) {
  const statusContent = fs.readFileSync(statusFile, 'utf-8')
  const prpId = checklist.prp
  const implementedLine = `| ${prpId} | ✅ Implemented |`
  if (!statusContent.includes(prpId)) {
    log('PRP id not found in PRP-STATUS.md (skipping update)')
  } else if (!statusContent.includes(implementedLine)) {
    const updated = statusContent.replace(new RegExp(`\n(.*${prpId}.*)\n`), match => match.replace('| 📄 Documented |','| ✅ Implemented |'))
    fs.writeFileSync(statusFile, updated)
    log('Updated PRP-STATUS.md to Implemented')
  }
} else {
  log('PRP-STATUS.md not found; skipping status update')
}

log('PRP execution complete')
