import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Read the OpenAPI specification file
    const openApiPath = path.join(process.cwd(), 'public', 'openapi.yaml')
    const openApiContent = fs.readFileSync(openApiPath, 'utf8')

    // Parse YAML to JSON for API consumption
    const yaml = require('js-yaml')
    const spec = yaml.load(openApiContent)

    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('Error serving OpenAPI spec:', error)
    return NextResponse.json(
      { error: 'Failed to load API specification' },
      { status: 500 }
    )
  }
}
