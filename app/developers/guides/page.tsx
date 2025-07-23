import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, BookOpen, Code, Zap, Shield, Database } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Integration Guides | TruthSource Developer Portal',
  description: 'Step-by-step guides for integrating TruthSource APIs with your systems',
}

const guides = [
  {
    title: 'Getting Started with TruthSource API',
    description: 'Learn the basics of authenticating and making your first API call',
    category: 'Basics',
    icon: BookOpen,
    href: '/developers/guides/getting-started',
    difficulty: 'Beginner',
    readTime: '10 min',
  },
  {
    title: 'Inventory Sync Integration',
    description: 'Implement real-time inventory synchronization between systems',
    category: 'Integration',
    icon: Database,
    href: '/developers/guides/inventory-sync',
    difficulty: 'Intermediate',
    readTime: '20 min',
  },
  {
    title: 'Webhook Implementation',
    description: 'Set up webhooks to receive real-time updates on data changes',
    category: 'Real-time',
    icon: Zap,
    href: '/developers/guides/webhooks',
    difficulty: 'Intermediate',
    readTime: '15 min',
  },
  {
    title: 'Authentication & Security',
    description: 'Best practices for secure API authentication and data handling',
    category: 'Security',
    icon: Shield,
    href: '/developers/guides/authentication',
    difficulty: 'Beginner',
    readTime: '12 min',
  },
  {
    title: 'Batch Operations',
    description: 'Efficiently handle bulk data operations for large-scale integrations',
    category: 'Advanced',
    icon: Code,
    href: '/developers/guides/batch-operations',
    difficulty: 'Advanced',
    readTime: '25 min',
  },
  {
    title: 'Error Handling & Retry Logic',
    description: 'Implement robust error handling and automatic retry mechanisms',
    category: 'Best Practices',
    icon: FileText,
    href: '/developers/guides/error-handling',
    difficulty: 'Intermediate',
    readTime: '18 min',
  },
]

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Beginner':
      return 'bg-green-500/10 text-green-500'
    case 'Intermediate':
      return 'bg-yellow-500/10 text-yellow-500'
    case 'Advanced':
      return 'bg-red-500/10 text-red-500'
    default:
      return 'bg-gray-500/10 text-gray-500'
  }
}

export default function GuidesPage() {
  return (
    <div className="container py-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Integration Guides</h1>
        <p className="text-muted-foreground">
          Step-by-step tutorials and best practices for integrating TruthSource APIs
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => {
          const Icon = guide.icon
          return (
            <Card key={guide.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Icon className="h-8 w-8 text-primary" />
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {guide.category}
                    </Badge>
                    <Badge className={`text-xs ${getDifficultyColor(guide.difficulty)}`}>
                      {guide.difficulty}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-xl">{guide.title}</CardTitle>
                <CardDescription>{guide.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {guide.readTime} read
                  </span>
                  <Button asChild size="sm">
                    <Link href={guide.href}>Read Guide</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="mt-8 border-dashed">
        <CardHeader className="text-center">
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>
            Can't find what you're looking for? Our team is here to help.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-4">
          <Button variant="outline" asChild>
            <Link href="/developers/support">Contact Support</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/developers/community">Ask Community</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}