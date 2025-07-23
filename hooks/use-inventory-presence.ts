'use client'

import { useCallback, useEffect, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { PresenceData } from '@/lib/realtime/types'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'

interface UseInventoryPresenceOptions {
  inventoryId?: string
  currentView: 'list' | 'item'
}

export function useInventoryPresence({
  inventoryId,
  currentView,
}: UseInventoryPresenceOptions) {
  const [presenceData, setPresenceData] = useState<PresenceData[]>([])
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const supabase = createClient()
  const { user } = useUser()

  const updatePresence = useCallback(async () => {
    if (!channel || !user) return

    const presence: PresenceData = {
      userId: user.id,
      userName: user.full_name || user.email?.split('@')[0] || 'Anonymous',
      userEmail: user.email || '',
      currentView,
      lastActivity: new Date(),
      ...(user.avatar_url && { avatarUrl: user.avatar_url }),
      ...(inventoryId && { itemId: inventoryId }),
    }

    await channel.track(presence)
  }, [channel, user, currentView, inventoryId])

  useEffect(() => {
    if (!user) return

    // Create channel name based on context
    const channelName = inventoryId
      ? `presence:inventory:${inventoryId}`
      : 'presence:inventory:list'

    // Subscribe to presence channel
    const presenceChannel = supabase.channel(channelName)

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const users: PresenceData[] = []

        Object.entries(state).forEach(([, presenceArray]) => {
          if (Array.isArray(presenceArray) && presenceArray.length > 0) {
            // Get the most recent presence data for each user with proper type safety
            const latestPresence = presenceArray[
              presenceArray.length - 1
            ] as unknown as PresenceData

            // Validate the presence data structure before using
            if (
              latestPresence &&
              typeof latestPresence === 'object' &&
              'userId' in latestPresence
            ) {
              // Don't include self in presence list
              if (latestPresence.userId !== user.id) {
                users.push(latestPresence)
              }
            }
          }
        })

        setPresenceData(users)
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          setChannel(presenceChannel)

          // Send initial presence
          const presence: PresenceData = {
            userId: user.id,
            userName:
              user.full_name || user.email?.split('@')[0] || 'Anonymous',
            userEmail: user.email || '',
            currentView,
            lastActivity: new Date(),
            ...(user.avatar_url && { avatarUrl: user.avatar_url }),
            ...(inventoryId && { itemId: inventoryId }),
          }

          await presenceChannel.track(presence)
        }
      })

    // Update presence every 30 seconds to keep alive
    const interval = setInterval(() => {
      updatePresence()
    }, 30000)

    // Cleanup
    return () => {
      clearInterval(interval)
      if (presenceChannel) {
        presenceChannel.untrack()
        supabase.removeChannel(presenceChannel)
      }
    }
  }, [user, inventoryId, currentView, supabase, updatePresence])

  // Update presence when view changes
  useEffect(() => {
    updatePresence()
  }, [updatePresence])

  const getActiveUsers = useCallback((): PresenceData[] => {
    // Filter out stale presence (older than 2 minutes)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)

    return presenceData.filter(
      (presence) => new Date(presence.lastActivity) > twoMinutesAgo
    )
  }, [presenceData])

  const getUsersOnItem = useCallback(
    (itemId: string): PresenceData[] => {
      return getActiveUsers().filter(
        (presence) =>
          presence.currentView === 'item' && presence.itemId === itemId
      )
    },
    [getActiveUsers]
  )

  const getUsersOnList = useCallback((): PresenceData[] => {
    return getActiveUsers().filter(
      (presence) => presence.currentView === 'list'
    )
  }, [getActiveUsers])

  return {
    presenceData: getActiveUsers(),
    getUsersOnItem,
    getUsersOnList,
    totalActive: getActiveUsers().length,
  }
}
