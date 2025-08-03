import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface Author {
  name: string
  role: string
  avatar: string
  bio: string
  social?: {
    twitter?: string
    linkedin?: string
    github?: string
  }
}

interface BlogAuthorProps {
  authors: string[]
}

// Dynamic author data loading
const authorData: Record<string, Author> = {
  'truthsource-team': {
    name: 'TruthSource Team',
    role: 'Editorial Team',
    avatar: '/images/authors/truthsource-team.png',
    bio: 'The TruthSource team is dedicated to helping B2B distributors eliminate order errors and improve data accuracy.',
    social: {
      twitter: 'truthsource',
      linkedin: 'truthsource',
    },
  },
}

export function BlogAuthor({ authors }: BlogAuthorProps) {
  if (!authors || authors.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-4">
      {authors.map((authorId) => {
        const author = authorData[authorId]
        if (!author) return null

        const initials = author.name
          ? author.name
              .split(' ')
              .filter(Boolean)
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
          : '??'

        return (
          <div key={authorId} className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={author.avatar} alt={author.name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{author.name}</p>
              {author.bio && (
                <p className="text-sm text-muted-foreground">
                  {author.bio.length <= 50
                    ? author.bio
                    : `${author.bio.slice(0, 50)}...`}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
