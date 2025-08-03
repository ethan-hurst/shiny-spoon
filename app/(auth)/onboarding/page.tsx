import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/auth'
import { OnboardingWizard } from '@/components/onboarding/wizard'

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check if user already belongs to an organization
  if (user.organizationId) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Welcome to Inventory Pro
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Let's set up your organization
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <OnboardingWizard userId={user.id} userEmail={user.email!} />
        </div>
      </div>
    </div>
  )
}