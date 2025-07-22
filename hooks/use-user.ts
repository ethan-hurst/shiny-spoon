'use client'

import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createBrowserClient } from '@/lib/supabase/client'

interface UserProfile extends User {
  full_name?: string
  avatar_url?: string
  organization_id?: string
}

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !authUser) {
          setUser(null)
          return
        }

        // Get user profile data
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('full_name, avatar_url, organization_id')
          .eq('user_id', authUser.id)
          .single()

        if (!profileError && profile) {
          setUser({
            ...authUser,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            organization_id: profile.organization_id,
          })
        } else {
          setUser(authUser)
        }
      } catch (error) {
        console.error('Error fetching user:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name, avatar_url, organization_id')
          .eq('user_id', session.user.id)
          .single()

        setUser({
          ...session.user,
          full_name: profile?.full_name,
          avatar_url: profile?.avatar_url,
          organization_id: profile?.organization_id,
        })
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  return { user, loading }
}
