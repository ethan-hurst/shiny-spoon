'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PresenceData } from '@/lib/realtime/types'
import { cn } from '@/lib/utils'

interface PresenceAvatarsProps {
  users: PresenceData[]
  maxDisplay?: number
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  className?: string
}

export function PresenceAvatars({
  users,
  maxDisplay = 3,
  size = 'sm',
  showTooltip = true,
  className,
}: PresenceAvatarsProps) {
  const displayUsers = users.slice(0, maxDisplay)
  const remainingCount = Math.max(0, users.length - maxDisplay)

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getActivityText = (lastActivity: Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(lastActivity).getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'Active now'
    if (minutes < 60) return `Active ${minutes}m ago`

    const hours = Math.floor(minutes / 60)
    return `Active ${hours}h ago`
  }

  const renderAvatar = (user: PresenceData, index: number) => {
    const avatar = (
      <motion.div
        key={user.userId}
        initial={{ scale: 0, x: -10 }}
        animate={{ scale: 1, x: 0 }}
        exit={{ scale: 0, x: -10 }}
        transition={{
          delay: index * 0.05,
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
        className={cn(
          'relative ring-2 ring-background rounded-full',
          index > 0 && '-ml-2'
        )}
        style={{ zIndex: maxDisplay - index }}
      >
        <Avatar className={cn(sizeClasses[size], 'border-2 border-background')}>
          <AvatarImage src={user.avatarUrl} alt={user.userName} />
          <AvatarFallback className="text-xs font-medium">
            {getInitials(user.userName)}
          </AvatarFallback>
        </Avatar>

        {/* Activity indicator */}
        <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" aria-label="User is active" />
      </motion.div>
    )

    if (!showTooltip) return avatar

    return (
      <Tooltip key={user.userId}>
        <TooltipTrigger asChild>{avatar}</TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{user.userName}</p>
            <p className="text-xs text-muted-foreground">{user.userEmail}</p>
            <p className="text-xs text-muted-foreground">
              {getActivityText(user.lastActivity)}
            </p>
            {user.currentView === 'item' && user.itemId && (
              <p className="text-xs text-muted-foreground">Viewing this item</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  if (users.length === 0) return null

  return (
    <TooltipProvider>
      <div className={cn('flex items-center', className)} role="group" aria-label="Active users">
        <AnimatePresence mode="popLayout">
          {displayUsers.map((user, index) => renderAvatar(user, index))}
        </AnimatePresence>

        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ scale: 0, x: -10 }}
                animate={{ scale: 1, x: 0 }}
                className={cn(
                  'relative -ml-2 flex items-center justify-center',
                  sizeClasses[size],
                  'rounded-full bg-muted text-muted-foreground',
                  'text-xs font-medium ring-2 ring-background'
                )}
                style={{ zIndex: 0 }}
              >
                <span aria-label={`${remainingCount} more ${remainingCount === 1 ? 'user' : 'users'}`}>+{remainingCount}</span>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">
                  {remainingCount} more{' '}
                  {remainingCount === 1 ? 'person' : 'people'}
                </p>
                {users.slice(maxDisplay).map((user) => (
                  <p key={user.userId} className="text-xs">
                    {user.userName}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
