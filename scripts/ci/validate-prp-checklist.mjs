#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Ajv from 'ajv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const schemaPath = path.join(__dirname, 'schema', 'prp-checklist.schema.json')
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'))

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true })
const validate = ajv.compile(schema)

const targets = process.argv.slice(2)
if (!targets.length) {
  console.error('Usage: validate-prp-checklist.mjs <checklist-files-glob-or-paths>')
  process.exit(1)
}

let failed = false

for (const t of targets) {
  if (!fs.existsSync(t)) {
    console.warn(`Skipping missing file: ${t}`)
    continue
  }
  try {
    const data = JSON.parse(fs.readFileSync(t, 'utf-8'))
    const ok = validate(data)
    if (!ok) {
      failed = true
      console.error(`Schema validation failed for ${t}`)
      for (const err of validate.errors) {
        console.error(' ', err.instancePath, err.message)
      }
    } else {
      console.log(`✓ ${t} valid`)
    }
  } catch (e) {
    failed = true
    console.error(`Error reading ${t}:`, e.message)
  }
}

if (failed) process.exit(1)
