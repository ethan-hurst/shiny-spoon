/**
 * Team and role configuration constants
 */

export const TEAM_ROLES = {
  OWNER: {
    value: 'owner',
    label: 'Owner',
    description: 'Full access to all features and settings',
    permissions: ['*'], // All permissions
  },
  ADMIN: {
    value: 'admin',
    label: 'Admin',
    description: 'Can manage team, billing, and all data',
    permissions: [
      'manage_team',
      'manage_billing',
      'manage_settings',
      'manage_api_keys',
      'read_data',
      'write_data',
      'delete_data',
    ],
  },
  MEMBER: {
    value: 'member',
    label: 'Member',
    description: 'Can view and edit data, but not manage team or billing',
    permissions: ['read_data', 'write_data'],
  },
  VIEWER: {
    value: 'viewer',
    label: 'Viewer',
    description: 'Can only view data, no editing permissions',
    permissions: ['read_data'],
  },
} as const

export type TeamRole = (typeof TEAM_ROLES)[keyof typeof TEAM_ROLES]['value']

export const INVITE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
} as const

export type InviteStatus = (typeof INVITE_STATUS)[keyof typeof INVITE_STATUS]

export const TEAM_MESSAGES = {
  INVITE_SENT: 'Team invitation sent successfully',
  INVITE_ACCEPTED: 'Invitation accepted successfully',
  MEMBER_REMOVED: 'Team member removed successfully',
  ROLE_UPDATED: 'Role updated successfully',
  LIMIT_REACHED: "You've reached the team member limit for your plan",
  INVITE_EXPIRED: 'This invitation has expired',
  CANNOT_REMOVE_OWNER: 'Cannot remove the organization owner',
  CANNOT_CHANGE_OWN_ROLE: 'You cannot change your own role',
} as const

export const INVITE_EXPIRY_DAYS = 7 // Days before invite expires
