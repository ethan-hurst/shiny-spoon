import type { Metadata } from 'next'
import { Calendar, Tag, AlertCircle, CheckCircle, XCircle, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const metadata: Metadata = {
  title: 'API Changelog | TruthSource Developer Portal',
  description: 'Stay updated with the latest changes and improvements to TruthSource APIs',
}

const changelogEntries = [
  {
    version: 'v1.4.0',
    date: '2024-01-15',
    type: 'feature',
    changes: [
      'Added batch pricing calculation endpoint for bulk operations',
      'New webhook events for inventory threshold alerts',
      'Support for custom metadata fields on all resources',
    ],
  },
  {
    version: 'v1.3.2',
    date: '2024-01-08',
    type: 'improvement',
    changes: [
      'Improved response time for inventory queries by 40%',
      'Enhanced error messages with more actionable details',
      'Added rate limit headers to all API responses',
    ],
  },
  {
    version: 'v1.3.1',
    date: '2023-12-20',
    type: 'bugfix',
    changes: [
      'Fixed issue with pagination on large result sets',
      'Corrected timezone handling in delivery date calculations',
      'Resolved edge case in quantity break pricing',
    ],
  },
  {
    version: 'v1.3.0',
    date: '2023-12-10',
    type: 'feature',
    changes: [
      'Introduced GraphQL API endpoint (beta)',
      'Added support for partial product updates',
      'New customer segmentation API for targeted pricing',
    ],
  },
  {
    version: 'v1.2.0',
    date: '2023-11-25',
    type: 'breaking',
    changes: [
      'BREAKING: Changed authentication header format (see migration guide)',
      'BREAKING: Renamed `product_code` to `sku` across all endpoints',
      'Added backwards compatibility mode (deprecated, will be removed in v2.0)',
    ],
  },
]

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'feature':
      return <Zap className="h-4 w-4" />
    case 'improvement':
      return <CheckCircle className="h-4 w-4" />
    case 'bugfix':
      return <XCircle className="h-4 w-4" />
    case 'breaking':
      return <AlertCircle className="h-4 w-4" />
    default:
      return <Tag className="h-4 w-4" />
  }
}

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'feature':
      return <Badge className="bg-blue-500/10 text-blue-500">New Feature</Badge>
    case 'improvement':
      return <Badge className="bg-green-500/10 text-green-500">Improvement</Badge>
    case 'bugfix':
      return <Badge className="bg-yellow-500/10 text-yellow-500">Bug Fix</Badge>
    case 'breaking':
      return <Badge variant="destructive">Breaking Change</Badge>
    default:
      return <Badge>Update</Badge>
  }
}

export default function ChangelogPage() {
  return (
    <div className="container py-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">API Changelog</h1>
        <p className="text-muted-foreground">
          Track updates, improvements, and changes to the TruthSource API
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Subscribe to our developer newsletter to receive changelog updates directly in your inbox.
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        {changelogEntries.map((entry) => (
          <Card key={entry.version}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    {getTypeIcon(entry.type)}
                    Version {entry.version}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    {new Date(entry.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </CardDescription>
                </div>
                {getTypeBadge(entry.type)}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {entry.changes.map((change, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-0.5">•</span>
                    <span className="text-sm">{change}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8 border-dashed">
        <CardHeader className="text-center">
          <CardTitle>Looking for older versions?</CardTitle>
          <CardDescription>
            View the complete changelog history on GitHub
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Badge variant="outline" className="cursor-pointer">
            View Full History
          </Badge>
        </CardContent>
      </Card>
    </div>
  )
}