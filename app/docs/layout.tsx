import { allDocs } from 'contentlayer/generated'
import { DocsSidebar } from '@/components/docs/sidebar'
import { DocsSearch } from '@/components/docs/search'
import { VersionSelector } from '@/components/docs/version-selector'

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Type-safe grouping of docs by category
  const docsByCategory = allDocs.reduce<Record<string, typeof allDocs>>((acc, doc) => {
    const category = doc.category || 'Uncategorized'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(doc)
    return acc
  }, {})

  // Sort docs within each category by order
  Object.keys(docsByCategory).forEach((category) => {
    docsByCategory[category].sort((a, b) => a.order - b.order)
  })

  return (
    <div className="flex min-h-screen">
      <DocsSidebar categories={docsByCategory} />
      <div className="flex-1 px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <DocsSearch />
            <VersionSelector />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}