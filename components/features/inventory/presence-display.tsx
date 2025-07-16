'use client'

import { useInventoryPresence } from '@/hooks/use-inventory-presence'
import { PresenceAvatars } from './presence-avatars'

export function PresenceDisplay({ organizationId }: { organizationId: string }) {
  const { getUsersOnList, totalActive } = useInventoryPresence({
    currentView: 'list'
  })
  
  const activeUsers = getUsersOnList()
  
  if (totalActive === 0) return null
  
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {totalActive} {totalActive === 1 ? 'person' : 'people'} viewing
      </span>
      <PresenceAvatars users={activeUsers} />
    </div>
  )
}