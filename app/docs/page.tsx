import Link from 'next/link'
import { allDocs } from 'contentlayer2/generated'
import { ArrowRight, Book, Code, Settings, Zap } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata = {
  title: 'Documentation - TruthSource',
  description:
    'Learn how to use TruthSource to synchronize your B2B e-commerce data.',
}

export default function DocsPage() {
  // Group docs by category
  const docsByCategory = allDocs.reduce(
    (acc, doc) => {
      const category = doc.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(doc)
      return acc
    },
    {} as Record<string, typeof allDocs>
  )

  // Sort docs within each category by order
  Object.keys(docsByCategory).forEach((category) => {
    const docs = docsByCategory[category]
    if (docs) {
      docs.sort((a, b) => a.order - b.order)
    }
  })

  const categoryIcons: Record<string, React.ReactNode> = {
    Setup: <Settings className="h-5 w-5" />,
    Integration: <Zap className="h-5 w-5" />,
    'API Reference': <Code className="h-5 w-5" />,
    Guides: <Book className="h-5 w-5" />,
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Documentation</h1>
        <p className="text-muted-foreground">
          Everything you need to know about using TruthSource
        </p>
      </div>

      <div className="grid gap-6">
        {Object.entries(docsByCategory).map(([category, docs]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-4">
              {categoryIcons[category] || <Book className="h-5 w-5" />}
              <h2 className="text-xl font-semibold">{category}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {docs.map((doc) => (
                <Link key={doc._id} href={doc.url}>
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-lg">
                        {doc.title}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{doc.description}</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">Need help?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Can't find what you're looking for? We're here to help.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/help" className="text-primary hover:underline">
            Browse Help Center →
          </Link>
          <Link href="/contact" className="text-primary hover:underline">
            Contact Support →
          </Link>
          <a
            href="https://github.com/truthsource/docs"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contribute to Docs →
          </a>
        </div>
      </div>
    </div>
  )
}
