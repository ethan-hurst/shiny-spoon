// PRP-013: NetSuite OAuth Callback Page
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { NetSuiteAuth } from '@/lib/integrations/netsuite/auth'

/**
 * Removes sensitive information such as URLs, tokens, credentials, email addresses, and IP addresses from an error message.
 *
 * Applies multiple redaction patterns to ensure that secrets and personally identifiable information are not exposed in logs or UI.
 *
 * @param error - The error message to sanitize
 * @returns The sanitized error message with sensitive data replaced by placeholders
 */
function sanitizeErrorMessage(error: string): string {
  // Remove URLs including query parameters and fragments
  let sanitized = error.replace(
    /https?:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=%]+/g,
    '[URL]'
  )
  
  // Remove various token patterns (OAuth, JWT, API keys, etc.)
  // Handles base64, hex, and alphanumeric tokens of various lengths
  sanitized = sanitized
    .replace(/[a-zA-Z0-9_\-+/=]{32,}/g, '[TOKEN]') // Long tokens including base64
    .replace(/[a-fA-F0-9]{32,}/g, '[TOKEN]') // Hex tokens (MD5, SHA, etc.)
    .replace(/[a-zA-Z0-9]{16,}[-_][a-zA-Z0-9]{16,}/g, '[TOKEN]') // UUID-like tokens
  
  // Remove Bearer tokens and other authorization headers
  sanitized = sanitized
    .replace(/Bearer\s+[a-zA-Z0-9_\-+/=.]+/gi, 'Bearer [TOKEN]')
    .replace(/Basic\s+[a-zA-Z0-9_\-+/=.]+/gi, 'Basic [TOKEN]')
    .replace(/Token\s+[a-zA-Z0-9_\-+/=.]+/gi, 'Token [TOKEN]')
  
  // Remove account IDs with various delimiters and formats
  sanitized = sanitized
    .replace(/account[_-]?id\s*[=:]\s*["']?[a-zA-Z0-9_\-]+["']?/gi, 'account_id=[REDACTED]')
    .replace(/account\s*[=:]\s*["']?[a-zA-Z0-9_\-]+["']?/gi, 'account=[REDACTED]')
    .replace(/accountId\s*[=:]\s*["']?[a-zA-Z0-9_\-]+["']?/g, 'accountId=[REDACTED]')
  
  // Remove consumer keys and client IDs with various formats
  sanitized = sanitized
    .replace(/consumer[_-]?key\s*[=:]\s*["']?[a-zA-Z0-9_\-+/=]+["']?/gi, 'consumer_key=[REDACTED]')
    .replace(/client[_-]?id\s*[=:]\s*["']?[a-zA-Z0-9_\-+/=]+["']?/gi, 'client_id=[REDACTED]')
    .replace(/api[_-]?key\s*[=:]\s*["']?[a-zA-Z0-9_\-+/=]+["']?/gi, 'api_key=[REDACTED]')
  
  // Remove secrets and passwords
  sanitized = sanitized
    .replace(/client[_-]?secret\s*[=:]\s*["']?[^\s"']+["']?/gi, 'client_secret=[REDACTED]')
    .replace(/consumer[_-]?secret\s*[=:]\s*["']?[^\s"']+["']?/gi, 'consumer_secret=[REDACTED]')
    .replace(/password\s*[=:]\s*["']?[^\s"']+["']?/gi, 'password=[REDACTED]')
  
  // Remove email addresses
  sanitized = sanitized.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[EMAIL]'
  )
  
  // Remove IP addresses (IPv4 and IPv6)
  sanitized = sanitized
    .replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, '[IP]')
    .replace(/\b(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}\b/g, '[IP]')
  
  return sanitized
}

export const metadata: Metadata = {
  title: 'NetSuite OAuth Callback | TruthSource',
  description: 'Processing NetSuite authentication',
}

interface PageProps {
  searchParams: {
    code?: string
    state?: string
    error?: string
    error_description?: string
  }
}

/**
 * Handles the NetSuite OAuth callback, processes authentication, updates integration status, logs activity, and renders the result UI.
 *
 * Redirects unauthenticated users to the login page and users without an organization profile to onboarding. Validates OAuth parameters, verifies the OAuth state, exchanges the authorization code for tokens, updates the integration status if successful, and logs authentication events. Displays a success, error, or loading UI based on the authentication outcome.
 *
 * @param searchParams - The URL search parameters containing OAuth callback data.
 * @returns The rendered authentication result page.
 */
export default async function NetSuiteCallbackPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user's organization profile once
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  const organizationId = profile.organization_id

  let success = false
  let errorMessage = ''
  let integrationId = ''

  // Check for OAuth errors
  if (searchParams.error) {
    errorMessage = sanitizeErrorMessage(searchParams.error_description || 'Authentication failed')
  } else if (!searchParams.code || !searchParams.state) {
    errorMessage = 'Missing authorization code or state parameter'
  } else {
    try {
      // Verify state parameter
      integrationId = await NetSuiteAuth.verifyOAuthState(searchParams.state) || ''
      
      if (!integrationId) {
        throw new Error('Invalid or expired state parameter')
      }

      // Verify integration belongs to user's organization
      const { data: integration } = await supabase
        .from('integrations')
        .select('*, netsuite_config (*)')
        .eq('id', integrationId)
        .eq('platform', 'netsuite')
        .single()

      if (!integration) {
        throw new Error('Integration not found')
      }

      if (integration.organization_id !== organizationId) {
        throw new Error('Unauthorized')
      }

      // Exchange code for tokens
      const netsuiteConfig = integration.netsuite_config?.[0]
      if (!netsuiteConfig) {
        throw new Error('NetSuite configuration not found')
      }

      const auth = new NetSuiteAuth(
        integrationId,
        organizationId,
        netsuiteConfig
      )

      const tokenResult = await auth.exchangeCodeForTokens(searchParams.code)
      
      // Only update integration status if token exchange succeeded
      if (tokenResult && tokenResult.access_token && tokenResult.refresh_token) {
        // Update integration status
        await supabase
          .from('integrations')
          .update({ 
            status: 'active',
            credential_type: 'oauth2',
          })
          .eq('id', integrationId)
      } else {
        throw new Error('Failed to exchange code for tokens - invalid token response')
      }

      // Log successful authentication
      await supabase.rpc('log_integration_activity', {
        p_integration_id: integrationId,
        p_organization_id: organizationId,
        p_log_type: 'auth',
        p_severity: 'info',
        p_message: 'NetSuite OAuth authentication successful',
      })

      success = true
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Authentication failed'
      
      // Log authentication failure
      if (integrationId) {
        await supabase.rpc('log_integration_activity', {
          p_integration_id: integrationId,
          p_organization_id: organizationId,
          p_log_type: 'auth',
          p_severity: 'error',
          p_message: 'NetSuite OAuth authentication failed',
          p_details: { error: sanitizeErrorMessage(errorMessage) },
        })
      }
    }
  }

  return (
    <div className="container mx-auto py-16 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {success ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                Authentication Successful
              </>
            ) : errorMessage ? (
              <>
                <XCircle className="h-6 w-6 text-red-500" />
                Authentication Failed
              </>
            ) : (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Processing Authentication...
              </>
            )}
          </CardTitle>
          <CardDescription>
            {success 
              ? 'Your NetSuite account has been successfully connected'
              : errorMessage 
              ? 'There was a problem connecting your NetSuite account'
              : 'Please wait while we complete the authentication process'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <>
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Connection Established</AlertTitle>
                <AlertDescription>
                  Your NetSuite integration is now active. You can start syncing data
                  or configure additional settings.
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-2">
                <Link href={`/integrations/netsuite?id=${integrationId}`}>
                  <Button>
                    Continue to Configuration
                  </Button>
                </Link>
                <Link href="/integrations">
                  <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Integrations
                  </Button>
                </Link>
              </div>
            </>
          ) : errorMessage ? (
            <>
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">Troubleshooting tips:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Ensure you have the correct permissions in NetSuite</li>
                    <li>Verify that OAuth 2.0 is enabled for your integration</li>
                    <li>Check that the redirect URI matches your configuration</li>
                    <li>Try clearing your browser cookies and attempting again</li>
                  </ul>
                </div>
                
                <div className="flex gap-2">
                  {integrationId && (
                    <Link href={`/integrations/netsuite?id=${integrationId}`}>
                      <Button variant="outline">
                        Try Again
                      </Button>
                    </Link>
                  )}
                  <Link href="/integrations">
                    <Button variant="outline">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Integrations
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}