'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building, LogOut, Settings, User } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/app/actions/auth'

interface UserNavProps {
  user: {
    email: string
    name?: string
    avatar?: string
  }
  organization?: {
    name: string
    slug: string
  }
}

export function UserNav({ user, organization }: UserNavProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleSignOut() {
    setIsLoading(true)
    try {
      await signOut()
      toast.success('Signed out successfully')
    } catch (error) {
      toast.error('Error signing out')
    } finally {
      setIsLoading(false)
    }
  }

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full"
          aria-label="User account menu"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatar} alt={user.name || user.email} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.name || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        {organization && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <Building className="mr-2 h-4 w-4" aria-hidden="true" />
              <span>{organization.name}</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push('/dashboard/settings')}
          aria-label="Go to settings"
        >
          <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push('/dashboard/profile')}
          aria-label="Go to profile"
        >
          <User className="mr-2 h-4 w-4" aria-hidden="true" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-red-600 focus:text-red-600"
          onClick={handleSignOut}
          disabled={isLoading}
          aria-label="Sign out of your account"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          <span>{isLoading ? 'Signing out...' : 'Sign out'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
