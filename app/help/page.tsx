import { allHelpArticles } from 'contentlayer/generated'
import { HelpSearch } from '@/components/help/search'
import { HelpCategories } from '@/components/help/categories'
import { PopularArticles } from '@/components/help/popular-articles'
import { ContactSupport } from '@/components/help/contact-support'

export const metadata = {
  title: 'Help Center - TruthSource',
  description: 'Find answers to common questions and get support for TruthSource.',
}

export default function HelpCenterPage() {
  const articlesByCategory = allHelpArticles.reduce((acc, article) => {
    const category = article.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(article)
    return acc
  }, {} as Record<string, typeof allHelpArticles>)

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">How can we help?</h1>
          <HelpSearch />
        </div>

        <PopularArticles />
        <HelpCategories categories={articlesByCategory} />
        <ContactSupport />
      </div>
    </div>
  )
}