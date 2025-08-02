'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, Package, ChevronRight, CheckCircle } from 'lucide-react'
import { createOrganization, joinOrganization } from '@/app/actions/organizations'
import { toast } from 'sonner'

interface OnboardingWizardProps {
  userId: string
  userEmail: string
}

type Step = 'choice' | 'create' | 'join' | 'complete'
type OrganizationTier = 'free' | 'starter' | 'professional' | 'enterprise'

export function OnboardingWizard({ userId, userEmail }: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('choice')
  const [loading, setLoading] = useState(false)
  
  // Create organization state
  const [orgName, setOrgName] = useState('')
  const [orgTier, setOrgTier] = useState<OrganizationTier>('free')
  
  // Join organization state
  const [inviteCode, setInviteCode] = useState('')

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      toast.error('Please enter an organization name')
      return
    }

    setLoading(true)
    try {
      const result = await createOrganization({
        name: orgName,
        tier: orgTier,
      })

      if (result.success) {
        setStep('complete')
        toast.success('Organization created successfully!')
        
        // Redirect after a short delay
        setTimeout(() => {
          router.push('/settings/organization')
        }, 2000)
      } else {
        toast.error(result.error || 'Failed to create organization')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinOrganization = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code')
      return
    }

    setLoading(true)
    try {
      const result = await joinOrganization(inviteCode)

      if (result.success) {
        setStep('complete')
        toast.success('Successfully joined organization!')
        
        // Redirect after a short delay
        setTimeout(() => {
          router.push('/')
        }, 2000)
      } else {
        toast.error(result.error || 'Invalid invite code')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'choice') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-medium">How would you like to get started?</h3>
          <p className="mt-1 text-sm text-gray-500">
            You can create a new organization or join an existing one
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card 
            className="cursor-pointer hover:border-blue-500 transition-colors"
            onClick={() => setStep('create')}
          >
            <CardHeader>
              <Building2 className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle>Create Organization</CardTitle>
              <CardDescription>
                Start fresh with your own organization
              </CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="cursor-pointer hover:border-blue-500 transition-colors"
            onClick={() => setStep('join')}
          >
            <CardHeader>
              <Users className="h-8 w-8 text-green-600 mb-2" />
              <CardTitle>Join Organization</CardTitle>
              <CardDescription>
                Join an existing organization with an invite code
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  if (step === 'create') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Create Your Organization</h3>
          <p className="mt-1 text-sm text-gray-500">
            Set up your organization details
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              type="text"
              placeholder="Acme Corporation"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Select Your Plan</Label>
            <RadioGroup value={orgTier} onValueChange={(value) => setOrgTier(value as OrganizationTier)}>
              <div className="mt-2 space-y-3">
                <div className="flex items-start">
                  <RadioGroupItem value="free" id="free" />
                  <label htmlFor="free" className="ml-3 cursor-pointer">
                    <span className="block text-sm font-medium">Free</span>
                    <span className="block text-sm text-gray-500">
                      Up to 5 users, 1GB storage, 1,000 API calls/hour
                    </span>
                  </label>
                </div>
                
                <div className="flex items-start">
                  <RadioGroupItem value="starter" id="starter" />
                  <label htmlFor="starter" className="ml-3 cursor-pointer">
                    <span className="block text-sm font-medium">Starter - $29/month</span>
                    <span className="block text-sm text-gray-500">
                      Up to 25 users, 10GB storage, 10,000 API calls/hour
                    </span>
                  </label>
                </div>
                
                <div className="flex items-start">
                  <RadioGroupItem value="professional" id="professional" />
                  <label htmlFor="professional" className="ml-3 cursor-pointer">
                    <span className="block text-sm font-medium">Professional - $99/month</span>
                    <span className="block text-sm text-gray-500">
                      Up to 100 users, 100GB storage, 100,000 API calls/hour
                    </span>
                  </label>
                </div>
                
                <div className="flex items-start">
                  <RadioGroupItem value="enterprise" id="enterprise" />
                  <label htmlFor="enterprise" className="ml-3 cursor-pointer">
                    <span className="block text-sm font-medium">Enterprise - Custom pricing</span>
                    <span className="block text-sm text-gray-500">
                      Unlimited users, 1TB+ storage, unlimited API calls
                    </span>
                  </label>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep('choice')}
            disabled={loading}
          >
            Back
          </Button>
          <Button
            onClick={handleCreateOrganization}
            disabled={loading || !orgName.trim()}
          >
            {loading ? 'Creating...' : 'Create Organization'}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'join') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Join an Organization</h3>
          <p className="mt-1 text-sm text-gray-500">
            Enter the invite code provided by your organization admin
          </p>
        </div>

        <div>
          <Label htmlFor="invite-code">Invite Code</Label>
          <Input
            id="invite-code"
            type="text"
            placeholder="Enter 6-digit code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="mt-1"
            maxLength={6}
          />
          <p className="mt-1 text-xs text-gray-500">
            The invite code should be 6 characters (letters and numbers)
          </p>
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep('choice')}
            disabled={loading}
          >
            Back
          </Button>
          <Button
            onClick={handleJoinOrganization}
            disabled={loading || inviteCode.length !== 6}
          >
            {loading ? 'Joining...' : 'Join Organization'}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'complete') {
    return (
      <div className="text-center space-y-4">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <h3 className="text-lg font-medium">All set!</h3>
        <p className="text-sm text-gray-500">
          You're ready to start managing your inventory
        </p>
        <p className="text-sm text-gray-500">
          Redirecting you to the dashboard...
        </p>
      </div>
    )
  }

  return null
}