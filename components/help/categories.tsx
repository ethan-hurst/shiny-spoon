import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, FileQuestion, Settings, Shield, Zap } from 'lucide-react'
import type { HelpArticle } from 'contentlayer2/generated'

interface HelpCategoriesProps {
  categories: Record<string, HelpArticle[]>
}

export function HelpCategories({ categories }: HelpCategoriesProps) {
  const categoryIcons: Record<string, React.ReactNode> = {
    'Getting Started': <Zap className="h-5 w-5" />,
    'Troubleshooting': <Settings className="h-5 w-5" />,
    'Account & Billing': <Shield className="h-5 w-5" />,
    'General': <FileQuestion className="h-5 w-5" />,
  }

  const categoryDescriptions: Record<string, string> = {
    'Getting Started': 'Learn the basics and get up and running quickly',
    'Troubleshooting': 'Find solutions to common issues and errors',
    'Account & Billing': 'Manage your account, subscription, and billing',
    'General': 'Frequently asked questions and general information',
  }

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(categories).map(([category, articles]) => (
          <Card key={category} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {categoryIcons[category] || <FileQuestion className="h-5 w-5" />}
                {category}
              </CardTitle>
              <CardDescription>
                {categoryDescriptions[category] || `${articles.length} articles`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {articles.slice(0, 3).map((article) => (
                  <li key={article._id}>
                    <Link
                      href={article.url}
                      className="text-sm hover:text-primary transition-colors flex items-center justify-between group"
                    >
                      <span>{article.title}</span>
                      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </li>
                ))}
              </ul>
              {articles.length > 3 && (
                <Link
                  href={`/help/category/${category.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-sm text-primary hover:underline mt-4 inline-block"
                >
                  View all {articles.length} articles →
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}