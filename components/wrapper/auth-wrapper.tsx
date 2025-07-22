import { ReactNode } from 'react'

interface AuthWrapperProps {
  children: ReactNode
}

const AuthWrapper = ({ children }: AuthWrapperProps) => {
  // Since we're using Supabase, no wrapper is needed
  // Supabase auth is handled by the middleware and individual components
  return <>{children}</>
}

export default AuthWrapper
