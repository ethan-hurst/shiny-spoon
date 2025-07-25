import { allPosts } from 'contentlayer2/generated'
import { compareDesc } from 'date-fns'
import { BlogCard } from '@/components/blog/blog-card'
import { BlogFilters } from '@/components/blog/blog-filters'
import { Pagination } from '@/components/ui/pagination'

export const metadata = {
  title: 'Blog - TruthSource',
  description: 'Insights on B2B e-commerce, inventory management, and data accuracy.',
}

const POSTS_PER_PAGE = 12

export default async function BlogPage(props: {
  searchParams: Promise<{ page?: string; category?: string; tag?: string }>
}) {
  const searchParams = await props.searchParams
  // Parse and validate search params
  const rawPage = Number(searchParams.page) || 1
  const selectedCategory = typeof searchParams.category === 'string' ? searchParams.category : undefined
  const selectedTag = typeof searchParams.tag === 'string' ? searchParams.tag : undefined

  // Filter and sort posts
  let filteredPosts = allPosts
    .filter((post) => post.published)
    .sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)))

  if (selectedCategory) {
    filteredPosts = filteredPosts.filter((post) =>
      post.categories.includes(selectedCategory)
    )
  }

  if (selectedTag) {
    filteredPosts = filteredPosts.filter((post) =>
      post.tags.includes(selectedTag)
    )
  }

  // Pagination with boundary check
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE))
  
  // Validate and clamp current page
  const currentPage = Math.min(Math.max(1, rawPage), totalPages)
  
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE
  const endIndex = startIndex + POSTS_PER_PAGE
  const currentPosts = filteredPosts.slice(startIndex, endIndex)

  // Get all categories and tags for filters
  const allCategories = [...new Set(allPosts.flatMap((post) => post.categories))]
  const allTags = [...new Set(allPosts.flatMap((post) => post.tags))]

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-muted-foreground">
            Insights and updates from the TruthSource team
          </p>
        </div>

        <BlogFilters
          categories={allCategories}
          tags={allTags}
          selectedCategory={selectedCategory}
          selectedTag={selectedTag}
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {currentPosts.map((post) => (
            <BlogCard key={post._id} post={post} />
          ))}
        </div>

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            baseUrl="/blog"
          />
        )}
      </div>
    </div>
  )
}