// PRP-012: Webhook Handler for Integration Framework
import { Headers } from 'next/dist/compiled/@edge-runtime/primitives'
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface WebhookHandler {
  verifySignature(payload: string, signature: string, secret: string): Promise<boolean>
  processWebhook(payload: any): Promise<void>
}

export class GenericWebhookHandler implements WebhookHandler {
  async verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
    try {
      const encoder = new TextEncoder()
      const keyData = encoder.encode(secret)
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      
      const signatureData = encoder.encode(payload)
      const expectedSignature = await crypto.subtle.sign('HMAC', key, signatureData)
      const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      
      return signature === expectedSignatureHex
    } catch (error) {
      console.error('Webhook verification failed:', error)
      return false
    }
  }

  async processWebhook(payload: any): Promise<void> {
    // TODO: Implement webhook processing
    console.log('Processing webhook:', payload)
  }
}

export async function handleWebhook(
  request: Request,
  platform: string,
  handler: WebhookHandler
): Promise<NextResponse> {
  try {
    const body = await request.text()
    const headers = new Headers(request.headers)
    
    // Get signature from headers (platform-specific)
    const signature = headers.get('x-webhook-signature') || 
                     headers.get('x-hub-signature') ||
                     headers.get('x-shopify-hmac-sha256')
    
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      )
    }

    // Verify signature
    const isValid = await handler.verifySignature(body, signature, process.env.WEBHOOK_SECRET || '')
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Process webhook
    const payload = JSON.parse(body)
    await handler.processWebhook(payload)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook processing failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}