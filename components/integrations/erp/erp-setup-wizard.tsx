'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowLeft, ArrowRight, Check, AlertCircle } from 'lucide-react'
import { ERPSelector } from './erp-selector'
import { ERPConfigForm } from './erp-config-form'
import { FieldMapper } from './field-mapper'
import { ConnectionTest } from './connection-test'
import { SyncConfiguration } from './sync-configuration'
import { createERPConnection } from '@/lib/actions/erp'
import { ERPType, ERPConfig } from '@/lib/integrations/erp/types'
import { toast } from 'sonner'

interface WizardStep {
  title: string
  description: string
  component: React.ComponentType<any>
}

const steps: WizardStep[] = [
  {
    title: 'Select ERP System',
    description: 'Choose your ERP platform',
    component: ERPSelector,
  },
  {
    title: 'Configure Connection',
    description: 'Enter your ERP connection details',
    component: ERPConfigForm,
  },
  {
    title: 'Map Fields',
    description: 'Configure field mappings between systems',
    component: FieldMapper,
  },
  {
    title: 'Test Connection',
    description: 'Verify your connection works correctly',
    component: ConnectionTest,
  },
  {
    title: 'Setup Sync',
    description: 'Configure how data will be synchronized',
    component: SyncConfiguration,
  },
]

export function ERPSetupWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedERP, setSelectedERP] = useState<ERPType>()
  const [config, setConfig] = useState<Partial<ERPConfig>>({})
  const [fieldMappings, setFieldMappings] = useState<any[]>([])
  const [syncStrategy, setSyncStrategy] = useState<any>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()

  const currentStepData = steps[currentStep]
  const StepComponent = currentStepData.component
  const progress = ((currentStep + 1) / steps.length) * 100

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      await handleFinish()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFinish = async () => {
    if (!selectedERP) {
      setError('Please select an ERP system')
      return
    }

    setIsLoading(true)
    setError(undefined)

    try {
      const result = await createERPConnection({
        type: selectedERP,
        config: config as ERPConfig,
        fieldMappings,
        syncStrategy,
      })

      if (result.success) {
        toast.success('ERP connection created successfully')
        router.push(`/integrations/erp/${result.data.id}`)
      } else {
        setError(result.error || 'Failed to create ERP connection')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('ERP setup error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return !!selectedERP
      case 1:
        return !!config.name && Object.keys(config).length > 1
      case 2:
        return fieldMappings.length > 0
      case 3:
        return true // Test results will determine
      case 4:
        return !!syncStrategy.type
      default:
        return false
    }
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Add ERP System</CardTitle>
            <CardDescription>{currentStepData.description}</CardDescription>
          </div>
          <div className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>
        <Progress value={progress} className="mt-4" />
      </CardHeader>

      <CardContent className="min-h-[400px]">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <StepComponent
          selectedERP={selectedERP}
          onSelectERP={setSelectedERP}
          config={config}
          onConfigChange={setConfig}
          fieldMappings={fieldMappings}
          onFieldMappingsChange={setFieldMappings}
          syncStrategy={syncStrategy}
          onSyncStrategyChange={setSyncStrategy}
        />
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0 || isLoading}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full transition-colors ${
                index <= currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <Button
          onClick={handleNext}
          disabled={!isStepValid() || isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {currentStep === steps.length - 1 ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Complete Setup
            </>
          ) : (
            <>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}