import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { IntegrationForm } from '@/components/features/integrations/integration-form'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Add Integration | TruthSource',
  description: 'Connect a new external system to TruthSource',
}

export default function NewIntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/integrations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Integration</h1>
          <p className="text-muted-foreground">
            Connect TruthSource with your external systems
          </p>
        </div>
      </div>

      <IntegrationForm />
    </div>
  )
}
