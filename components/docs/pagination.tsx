import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DocsPaginationProps {
  prev: { title: string; href: string } | null
  next: { title: string; href: string } | null
}

export function DocsPagination({ prev, next }: DocsPaginationProps) {
  return (
    <div className="flex items-center justify-between mt-12 pt-6 border-t">
      {prev ? (
        <Link
          href={prev.href}
          className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <div className="text-left">
            <div className="text-muted-foreground">Previous</div>
            <div className="font-medium">{prev.title}</div>
          </div>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link
          href={next.href}
          className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
        >
          <div className="text-right">
            <div className="text-muted-foreground">Next</div>
            <div className="font-medium">{next.title}</div>
          </div>
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <div />
      )}
    </div>
  )
}
