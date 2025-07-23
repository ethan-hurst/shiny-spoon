import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.TRUTHSOURCE_API_URL || 'https://api.truthsource.io/v1'

export async function POST(request: NextRequest) {
  try {
    const { method, path, body, apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 401 }
      )
    }

    if (!method || !path) {
      return NextResponse.json(
        { error: 'Method and path are required' },
        { status: 400 }
      )
    }

    // Build the full URL
    const url = `${API_BASE_URL}${path}`

    // Prepare headers
    const headers: HeadersInit = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'TruthSource-API-Playground/1.0',
    }

    // Prepare request options
    const options: RequestInit = {
      method,
      headers,
    }

    // Add body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
      options.body = JSON.stringify(body)
    }

    // Record start time
    const startTime = Date.now()

    // Make the API request
    const response = await fetch(url, options)

    // Calculate response time
    const responseTime = Date.now() - startTime

    // Get response data
    const responseData = await response.json().catch(() => null)

    // Extract relevant headers
    const responseHeaders: Record<string, string> = {}
    const relevantHeaders = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'x-request-id',
      'content-type',
      'cache-control',
    ]

    response.headers.forEach((value, key) => {
      if (relevantHeaders.includes(key.toLowerCase())) {
        responseHeaders[key] = value
      }
    })

    // Return the response
    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseData,
      time: responseTime,
    })

  } catch (error) {
    console.error('API Playground Error:', error)
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Failed to connect to API server' },
        { status: 503 }
      )
    }

    // Handle other errors
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    )
  }
}

// Add OPTIONS support for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}