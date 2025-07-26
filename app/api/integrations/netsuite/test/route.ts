// PRP-013: NetSuite Connection Test Endpoint
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NetSuiteAPIClient } from '@/lib/integrations/netsuite/api-client'
import { NetSuiteAuth } from '@/lib/integrations/netsuite/auth'
import type { NetSuiteIntegrationConfig } from '@/types/netsuite.types'

interface TestResult {
  name: string
  status: 'pending' | 'success' | 'error'
  message: string
  duration: number
  details?: any
}

interface TestResults {
  timestamp: string
  tests: TestResult[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { integration_id } = await request.json()

    if (!integration_id) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 })
    }

    // Get integration with NetSuite config
    const { data: integration } = await supabase
      .from('integrations')
      .select('*, netsuite_config(*)')
      .eq('id', integration_id)
      .eq('platform', 'netsuite')
      .single()

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Verify user has access
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!profile || integration.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const netsuiteConfig = integration.netsuite_config?.[0]
    if (!netsuiteConfig) {
      return NextResponse.json({ error: 'NetSuite configuration not found' }, { status: 404 })
    }

    // Initialize auth
    const auth = new NetSuiteAuth(
      integration_id,
      profile.organization_id,
      netsuiteConfig as NetSuiteIntegrationConfig
    )

    const testResults: TestResults = {
      timestamp: new Date().toISOString(),
      tests: [],
    }

    try {
      // Test 1: OAuth Token Validation
      const tokenTest = {
        name: 'OAuth Token Validation',
        status: 'pending',
        message: '',
        duration: 0,
      }
      
      const tokenStart = Date.now()
      try {
        await auth.initialize()
        const token = await auth.getAccessToken()
        
        if (token) {
          tokenTest.status = 'success'
          tokenTest.message = 'OAuth token is valid'
        } else {
          tokenTest.status = 'error'
          tokenTest.message = 'No valid OAuth token found'
        }
      } catch (error) {
        tokenTest.status = 'error'
        tokenTest.message = error instanceof Error ? error.message : 'Token validation failed'
      }
      tokenTest.duration = Date.now() - tokenStart
      testResults.tests.push(tokenTest)

      // Test 2: API Connectivity
      const apiTest = {
        name: 'API Connectivity',
        status: 'pending',
        message: '',
        duration: 0,
      }

      const apiStart = Date.now()
      try {
        const apiClient = new NetSuiteAPIClient(
          netsuiteConfig as NetSuiteIntegrationConfig,
          auth
        )

        // Try a simple query to test connectivity
        const testQuery = 'SELECT COUNT(*) as count FROM item WHERE ROWNUM <= 1'
        const result = await apiClient.executeSuiteQL(testQuery)
        
        if (result && result.length > 0) {
          apiTest.status = 'success'
          apiTest.message = 'Successfully connected to NetSuite API'
        } else {
          apiTest.status = 'warning'
          apiTest.message = 'Connected but no data returned'
        }
      } catch (error) {
        apiTest.status = 'error'
        apiTest.message = error instanceof Error ? error.message : 'API connection failed'
      }
      apiTest.duration = Date.now() - apiStart
      testResults.tests.push(apiTest)

      // Test 3: Permissions Check
      const permTest = {
        name: 'Permissions Check',
        status: 'pending',
        message: '',
        duration: 0,
        details: {},
      }

      const permStart = Date.now()
      try {
        const apiClient = new NetSuiteAPIClient(
          netsuiteConfig as NetSuiteIntegrationConfig,
          auth
        )

        // Check access to required record types
        const recordTypes = ['item', 'inventorybalance', 'pricelevel', 'customer', 'salesorder']
        const permissions: Record<string, boolean> = {}

        for (const recordType of recordTypes) {
          try {
            const query = `SELECT COUNT(*) as count FROM ${recordType} WHERE ROWNUM <= 1`
            await apiClient.executeSuiteQL(query)
            permissions[recordType] = true
          } catch (error) {
            permissions[recordType] = false
            // Log the specific error for debugging
            console.error(`Permission check failed for ${recordType}:`, {
              recordType,
              error: error instanceof Error ? error.message : String(error),
              code: (error as any)?.code,
            })
          }
        }

        const hasAllPermissions = Object.values(permissions).every(p => p === true)
        
        if (hasAllPermissions) {
          permTest.status = 'success'
          permTest.message = 'All required permissions granted'
        } else {
          permTest.status = 'warning'
          permTest.message = 'Some permissions missing'
        }
        permTest.details = permissions
      } catch (error) {
        permTest.status = 'error'
        permTest.message = error instanceof Error ? error.message : 'Permission check failed'
      }
      permTest.duration = Date.now() - permStart
      testResults.tests.push(permTest)

      // Test 4: Data Retrieval
      const dataTest = {
        name: 'Data Retrieval Test',
        status: 'pending',
        message: '',
        duration: 0,
        details: {},
      }

      const dataStart = Date.now()
      try {
        const apiClient = new NetSuiteAPIClient(
          netsuiteConfig as NetSuiteIntegrationConfig,
          auth
        )

        // Try to fetch sample data
        const productQuery = 'SELECT COUNT(*) as product_count FROM item WHERE itemtype IN (\'InvtPart\', \'NonInvtPart\')'
        const inventoryQuery = 'SELECT COUNT(*) as inventory_count FROM inventorybalance'
        const customerQuery = 'SELECT COUNT(*) as customer_count FROM customer WHERE isinactive = \'F\''

        const [products, inventory, customers] = await Promise.all([
          apiClient.executeSuiteQL(productQuery),
          apiClient.executeSuiteQL(inventoryQuery).catch(() => [{ inventory_count: 0 }]),
          apiClient.executeSuiteQL(customerQuery).catch(() => [{ customer_count: 0 }]),
        ])

        dataTest.details = {
          products: products[0]?.product_count || 0,
          inventory: inventory[0]?.inventory_count || 0,
          customers: customers[0]?.customer_count || 0,
        }

        dataTest.status = 'success'
        dataTest.message = 'Data retrieval successful'
      } catch (error) {
        dataTest.status = 'error'
        dataTest.message = error instanceof Error ? error.message : 'Data retrieval failed'
      }
      dataTest.duration = Date.now() - dataStart
      testResults.tests.push(dataTest)

      // Determine overall status
      const hasErrors = testResults.tests.some((t: any) => t.status === 'error')
      const hasWarnings = testResults.tests.some((t: any) => t.status === 'warning')
      
      testResults.overall_status = hasErrors ? 'error' : hasWarnings ? 'warning' : 'success'
      testResults.message = hasErrors 
        ? 'Connection test failed - please check your configuration'
        : hasWarnings 
        ? 'Connection successful with warnings'
        : 'All tests passed successfully'

      // Update integration status
      await supabase
        .from('integrations')
        .update({
          status: hasErrors ? 'error' : 'active',
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', integration_id)

      // Log test results
      await supabase.rpc('log_integration_activity', {
        p_integration_id: integration_id,
        p_organization_id: profile.organization_id,
        p_log_type: 'config',
        p_severity: hasErrors ? 'error' : hasWarnings ? 'warning' : 'info',
        p_message: 'Connection test completed',
        p_details: testResults,
      })

      return NextResponse.json(testResults)

    } catch (error) {
      testResults.overall_status = 'error'
      testResults.message = error instanceof Error ? error.message : 'Test execution failed'
      
      return NextResponse.json(testResults, { status: 500 })
    }

  } catch (error) {
    console.error('NetSuite test error:', error)
    return NextResponse.json(
      { 
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}