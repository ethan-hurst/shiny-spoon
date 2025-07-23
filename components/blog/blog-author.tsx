import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import authorsData from '@/content/authors/truthsource-team.json'

interface BlogAuthorProps {
  authors: string[]
}

export function BlogAuthor({ authors }: BlogAuthorProps) {
  // For now, we'll use the truthsource-team author
  // In a real implementation, you'd load multiple author files
  const author = authorsData

  if (!authors.length) return null

  return (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarImage src={author.avatar} alt={author.name} />
        <AvatarFallback>
          {author.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div>
        <p className="font-medium">{author.name}</p>
        <p className="text-sm text-muted-foreground">{author.bio.slice(0, 50)}...</p>
      </div>
    </div>
  )
}