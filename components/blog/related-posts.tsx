import { allPosts, type Post } from 'contentlayer/generated'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface RelatedPostsProps {
  currentPost: Post
}

export function RelatedPosts({ currentPost }: RelatedPostsProps) {
  // Find related posts based on categories and tags
  const relatedPosts = allPosts
    .filter((post) => post.published && post._id !== currentPost._id)
    .map((post) => {
      // Calculate relevance score
      const categoryMatches = (post.categories || []).filter((cat) =>
        (currentPost.categories || []).includes(cat)
      ).length
      const tagMatches = (post.tags || []).filter((tag) =>
        (currentPost.tags || []).includes(tag)
      ).length
      const score = categoryMatches * 2 + tagMatches // Categories weighted more

      return { post, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ post }) => post)

  if (relatedPosts.length === 0) {
    // If no related posts found, show the latest posts
    const latestPosts = allPosts
      .filter((post) => post.published && post._id !== currentPost._id)
      .sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0
        const dateB = b.date ? new Date(b.date).getTime() : 0
        return dateB - dateA
      })
      .slice(0, 3)
    
    return (
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Latest Posts</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {latestPosts.map((post) => (
            <RelatedPostCard key={post._id} post={post} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6">Related Posts</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {relatedPosts.map((post) => (
          <RelatedPostCard key={post._id} post={post} />
        ))}
      </div>
    </div>
  )
}

function RelatedPostCard({ post }: { post: Post }) {
  return (
    <Card 
      className="h-full hover:shadow-lg transition-shadow"
      role="article"
      aria-label={`Related post: ${post.title}`}
    >
      <Link href={post.url}>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {(post.categories || []).slice(0, 2).map((category) => (
              <Badge key={category} variant="secondary" className="text-xs">
                {category}
              </Badge>
            ))}
          </div>
          <h3 className="font-semibold line-clamp-2 hover:text-primary transition-colors">
            {post.title}
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {post.description}
          </p>
          {post.date && (
            <time className="text-xs text-muted-foreground">
              {format(new Date(post.date), 'MMM d, yyyy')}
            </time>
          )}
        </CardContent>
      </Link>
    </Card>
  )
}