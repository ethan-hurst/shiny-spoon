import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock } from 'lucide-react'
import type { Post } from 'contentlayer/generated'

interface BlogCardProps {
  post: Post
}

export function BlogCard({ post }: BlogCardProps) {
  return (
    <Card className="h-full flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
      <Link href={post.url}>
        <div className="aspect-video relative overflow-hidden bg-gray-100">
          <img
            src={post.image}
            alt={post.title}
            className="object-cover w-full h-full hover:scale-105 transition-transform duration-300"
          />
        </div>
      </Link>
      
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {post.categories.map((category) => (
            <Badge key={category} variant="secondary" className="text-xs">
              {category}
            </Badge>
          ))}
        </div>
        
        <Link href={post.url}>
          <h3 className="text-xl font-semibold line-clamp-2 hover:text-primary transition-colors">
            {post.title}
          </h3>
        </Link>
      </CardHeader>
      
      <CardContent className="flex-grow">
        <p className="text-muted-foreground line-clamp-3">
          {post.description}
        </p>
      </CardContent>
      
      <CardFooter className="text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <time dateTime={post.date}>
              {format(new Date(post.date), 'MMM d, yyyy')}
            </time>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{post.readingTime.text}</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}