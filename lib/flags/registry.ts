// Central feature flag registry
// Auto-generated and extended via PRP generate process.
// Each flag must have removal criteria defined in originating PRP checklist JSON.

export type FlagScope = 'ui' | 'api' | 'job'

export interface FeatureFlagDefinition {
  name: string
  description: string
  scope: FlagScope[]
  default: boolean
  owner: string // GitHub handle or team name
  removalCriteria: string[]
  introducedIn: string // PRP id e.g. PRP-017
  expiresAt?: string // optional planned removal date ISO
  tags?: string[]
}

// IMPORTANT: Do not remove flags without verifying launch criteria met.
// A CI script will verify that any flag defaulting to true has documented removal PR.

export const featureFlags: FeatureFlagDefinition[] = [
  // Example scaffold flag (can be removed once real flags added)
  {
    name: 'bulk_ops',
    description: 'Enables bulk operations processing UI & API endpoints',
    scope: ['ui', 'api', 'job'],
    default: false,
    owner: 'platform',
    removalCriteria: [
      '95% success rate over 30d',
      'Rollback procedure validated',
      'P95 chunk latency < 500ms for 95% of operations',
      'All AC tests passing in CI'
    ],
    introducedIn: 'PRP-017',
    tags: ['bulk', 'operations', 'migration']
  }
]

// Helper lookup
export function isFlagEnabled(name: string, overrides?: Record<string, boolean>): boolean {
  const def = featureFlags.find(f => f.name === name)
  if (!def) return false
  if (overrides && name in overrides) return overrides[name]!
  return def.default
}

export function listFlags() {
  return featureFlags.map(f => ({
    name: f.name,
    default: f.default,
    scope: f.scope,
    introducedIn: f.introducedIn
  }))
}
