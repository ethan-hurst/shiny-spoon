'use client'

// PRP-014: Shopify Setup Wizard Component
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import { 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft,
  Copy,
  ExternalLink,
  Loader2
} from 'lucide-react'
import { ShopifyConfigForm } from './shopify-config-form'

interface ShopifySetupWizardProps {
  organizationId: string
}

interface StepProps {
  onNext: () => void
  onPrev?: () => void
  organizationId: string
}

const steps = [
  { id: 'intro', title: 'Introduction', description: 'Learn about the integration' },
  { id: 'app-creation', title: 'Create Shopify App', description: 'Set up your custom app' },
  { id: 'permissions', title: 'Configure Permissions', description: 'Grant necessary access' },
  { id: 'webhooks', title: 'Set Up Webhooks', description: 'Configure real-time updates' },
  { id: 'credentials', title: 'Enter Credentials', description: 'Connect your store' },
  { id: 'test', title: 'Test Connection', description: 'Verify everything works' },
  { id: 'complete', title: 'Complete', description: 'Start syncing data' }
]

function IntroStep({ onNext }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">What this integration does</h3>
        <ul className="space-y-2">
          {[
            'Syncs your product catalog including variants and metafields',
            'Keeps inventory levels updated in real-time across locations',
            'Manages B2B catalogs and customer-specific pricing',
            'Imports orders for reporting and analytics',
            'Synchronizes customer data and company information'
          ].map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <span className="text-sm">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Requirements:</strong> You need admin access to your Shopify store and the ability to create custom apps.
          B2B features require a Shopify Plus plan.
        </AlertDescription>
      </Alert>

      <Button onClick={onNext} className="w-full">
        Get Started
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}

function AppCreationStep({ onNext, onPrev }: StepProps) {
  const { toast } = useToast()

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Copied to clipboard',
        description: 'The text has been copied to your clipboard.'
      })
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard. Please copy manually.',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Create a Custom App in Shopify</h3>
        
        <ol className="space-y-4">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
              1
            </span>
            <div className="space-y-2">
              <p className="text-sm">Navigate to your Shopify admin panel</p>
              <a 
                href="https://admin.shopify.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Open Shopify Admin
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
              2
            </span>
            <div className="space-y-2">
              <p className="text-sm">Go to <strong>Settings → Apps and sales channels</strong></p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
              3
            </span>
            <div className="space-y-2">
              <p className="text-sm">Click <strong>"Develop apps"</strong> (you may need to enable this first)</p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
              4
            </span>
            <div className="space-y-2">
              <p className="text-sm">Click <strong>"Create an app"</strong> and name it:</p>
              <div className="flex items-center gap-2">
                <code className="px-2 py-1 bg-muted rounded text-xs flex-1">
                  TruthSource Integration
                </code>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => copyToClipboard('TruthSource Integration')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </li>
        </ol>
      </div>

      <div className="flex gap-3">
        <Button onClick={onPrev} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <Button onClick={onNext} className="flex-1">
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function PermissionsStep({ onNext, onPrev }: StepProps) {
  const requiredScopes = [
    { scope: 'read_products', description: 'Read product information' },
    { scope: 'write_products', description: 'Update product data' },
    { scope: 'read_inventory', description: 'Read inventory levels' },
    { scope: 'write_inventory', description: 'Update inventory levels' },
    { scope: 'read_orders', description: 'Import order data' },
    { scope: 'read_customers', description: 'Access customer information' },
    { scope: 'read_price_rules', description: 'Read pricing rules' },
    { scope: 'write_price_rules', description: 'Manage pricing rules' }
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Configure API Permissions</h3>
        
        <ol className="space-y-4">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
              1
            </span>
            <div className="space-y-2">
              <p className="text-sm">In your app configuration, click <strong>"Configure Admin API scopes"</strong></p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
              2
            </span>
            <div className="space-y-2">
              <p className="text-sm">Enable the following scopes:</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {requiredScopes.map((item) => (
                  <div key={item.scope} className="flex items-center gap-2 text-xs">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <code className="font-mono">{item.scope}</code>
                  </div>
                ))}
              </div>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
              3
            </span>
            <div className="space-y-2">
              <p className="text-sm">Click <strong>"Save"</strong> to apply the permissions</p>
            </div>
          </li>
        </ol>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> These permissions allow TruthSource to read and update your store data securely.
        </AlertDescription>
      </Alert>

      <div className="flex gap-3">
        <Button onClick={onPrev} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <Button onClick={onNext} className="flex-1">
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function WebhooksStep({ onNext, onPrev }: StepProps) {
  const { toast } = useToast()
  const webhookUrl = `${process.env.NEXT_PUBLIC_URL || window.location.origin}/api/webhooks/shopify`

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Copied to clipboard',
        description: 'The webhook URL has been copied to your clipboard.'
      })
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard. Please copy manually.',
        variant: 'destructive'
      })
    }
  }

  const webhookTopics = [
    'products/create',
    'products/update',
    'products/delete',
    'inventory_levels/update',
    'orders/create',
    'orders/updated',
    'customers/create',
    'customers/update'
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Configure Webhooks</h3>
        
        <ol className="space-y-4">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
              1
            </span>
            <div className="space-y-2">
              <p className="text-sm">In your app, navigate to <strong>"Webhooks"</strong> configuration</p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
              2
            </span>
            <div className="space-y-2">
              <p className="text-sm">Set the webhook URL to:</p>
              <div className="flex items-center gap-2">
                <code className="px-2 py-1 bg-muted rounded text-xs flex-1 overflow-x-auto">
                  {webhookUrl}
                </code>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => copyToClipboard(webhookUrl)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
              3
            </span>
            <div className="space-y-2">
              <p className="text-sm">Subscribe to these webhook topics:</p>
              <div className="grid grid-cols-2 gap-1 mt-2">
                {webhookTopics.map((topic) => (
                  <code key={topic} className="text-xs bg-muted px-2 py-1 rounded">
                    {topic}
                  </code>
                ))}
              </div>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium">
              4
            </span>
            <div className="space-y-2">
              <p className="text-sm">Copy the <strong>webhook signing secret</strong> - you'll need it in the next step</p>
            </div>
          </li>
        </ol>
      </div>

      <div className="flex gap-3">
        <Button onClick={onPrev} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <Button onClick={onNext} className="flex-1">
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

interface CredentialsStepProps extends StepProps {
  onIntegrationCreated: (integrationId: string) => void
}

function CredentialsStep({ onNext, onPrev, organizationId, onIntegrationCreated }: CredentialsStepProps) {
  const handleFormSubmit = (newIntegrationId: string) => {
    onIntegrationCreated(newIntegrationId)
    onNext()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Connect Your Store</h3>
        <p className="text-sm text-muted-foreground">
          Now let's connect your Shopify store using the credentials from your custom app.
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You'll need:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Your shop domain (e.g., mystore.myshopify.com)</li>
            <li>Admin API access token</li>
            <li>Webhook signing secret</li>
          </ul>
        </AlertDescription>
      </Alert>

      <ShopifyConfigForm 
        organizationId={organizationId}
        onSuccess={handleFormSubmit}
      />

      <Button 
        onClick={onPrev} 
        variant="outline" 
        className="w-full"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Previous
      </Button>
    </div>
  )
}

interface TestStepProps extends StepProps {
  integrationId: string | null
}

function TestStep({ onNext, onPrev, integrationId }: TestStepProps) {
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<{
    connection: boolean | null
    products: boolean | null
    inventory: boolean | null
    webhooks: boolean | null
  }>({
    connection: null,
    products: null,
    inventory: null,
    webhooks: null
  })

  const runTests = async () => {
    setTesting(true)
    
    try {
      // Test API connection
      const testResponse = await fetch('/api/integrations/shopify/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId })
      })
      
      const testData = await testResponse.json()
      
      if (testResponse.ok && testData.tests) {
        // Update test results based on actual test responses
        setTestResults({
          connection: testData.tests.connection || false,
          products: testData.tests.products || false,
          inventory: testData.tests.inventory || false,
          webhooks: testData.tests.webhooks || false
        })
      } else {
        // If test endpoint fails, mark all as failed
        setTestResults({
          connection: false,
          products: false,
          inventory: false,
          webhooks: false
        })
      }
    } catch (error) {
      // Network error - mark all tests as failed
      setTestResults({
        connection: false,
        products: false,
        inventory: false,
        webhooks: false
      })
    } finally {
      setTesting(false)
    }
  }

  const allTestsPassed = Object.values(testResults).every(result => result === true)

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Test Your Connection</h3>
        <p className="text-sm text-muted-foreground">
          Let's verify that everything is set up correctly.
        </p>
      </div>

      <div className="space-y-3">
        {[
          { key: 'connection', label: 'API Connection' },
          { key: 'products', label: 'Product Access' },
          { key: 'inventory', label: 'Inventory Access' },
          { key: 'webhooks', label: 'Webhook Configuration' }
        ].map(({ key, label }) => {
          const status = testResults[key as keyof typeof testResults]
          return (
            <div key={key} className="flex items-center justify-between p-3 border rounded">
              <span className="text-sm">{label}</span>
              {status === null ? (
                <span className="text-sm text-muted-foreground">Not tested</span>
              ) : status === true ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
          )
        })}
      </div>

      {!testing && !allTestsPassed && (
        <Button onClick={runTests} className="w-full">
          Run Tests
        </Button>
      )}

      {testing && (
        <Button disabled className="w-full">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Running Tests...
        </Button>
      )}

      {allTestsPassed && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600 dark:text-green-400">
            All tests passed! Your integration is ready to use.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button onClick={onPrev} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <Button 
          onClick={onNext} 
          className="flex-1"
          disabled={!allTestsPassed}
        >
          Complete Setup
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function CompleteStep({ organizationId }: StepProps) {
  const router = useRouter()
  
  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        
        <h3 className="text-lg font-semibold">Setup Complete!</h3>
        <p className="text-sm text-muted-foreground">
          Your Shopify integration is now active and will begin syncing data.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">What happens next?</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Initial product sync will begin automatically</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Inventory levels will be synchronized in real-time</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Webhooks will keep your data up to date</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>You can monitor sync status from the integration page</span>
          </li>
        </ul>
      </div>

      <div className="flex gap-3">
        <Button 
          onClick={() => router.push('/integrations')}
          variant="outline"
          className="flex-1"
        >
          View All Integrations
        </Button>
        <Button 
          onClick={() => router.push('/integrations/shopify')}
          className="flex-1"
        >
          Go to Shopify Integration
        </Button>
      </div>
    </div>
  )
}

export function ShopifySetupWizard({ organizationId }: ShopifySetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [integrationId, setIntegrationId] = useState<string | null>(null)
  const progress = ((currentStep + 1) / steps.length) * 100

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const renderStep = () => {
    const stepProps = {
      onNext: handleNext,
      onPrev: currentStep > 0 ? handlePrev : undefined,
      organizationId
    }

    switch (steps[currentStep].id) {
      case 'intro':
        return <IntroStep {...stepProps} />
      case 'app-creation':
        return <AppCreationStep {...stepProps} />
      case 'permissions':
        return <PermissionsStep {...stepProps} />
      case 'webhooks':
        return <WebhooksStep {...stepProps} />
      case 'credentials':
        return <CredentialsStep {...stepProps} onIntegrationCreated={setIntegrationId} />
      case 'test':
        return <TestStep {...stepProps} integrationId={integrationId} />
      case 'complete':
        return <CompleteStep {...stepProps} />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{steps[currentStep].title}</span>
          <span className="text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="py-6">
        {renderStep()}
      </div>
    </div>
  )
}