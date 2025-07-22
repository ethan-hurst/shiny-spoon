import { redirect } from 'next/navigation'
import { UserProfile } from '@clerk/nextjs'
import PageWrapper from '@/components/wrapper/page-wrapper'
import config from '@/config'

const UserProfilePage = () => {
  if (!config?.auth?.enabled) {
    redirect('/')
  }

  return (
    <PageWrapper>
      <div className="h-full flex items-center justify-center p-9">
        <UserProfile path="/user-profile" routing="path" />
      </div>
    </PageWrapper>
  )
}

export default UserProfilePage
