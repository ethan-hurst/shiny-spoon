import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  baseUrl: string
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  baseUrl,
  className,
}: PaginationProps) {
  const getPageUrl = (page: number) => {
    if (page === 1) return baseUrl
    return `${baseUrl}?page=${page}`
  }

  const renderPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    // Add first page and ellipsis if needed
    if (startPage > 1) {
      pages.push(
        <Link key={1} href={getPageUrl(1)}>
          <Button
            variant={currentPage === 1 ? 'default' : 'outline'}
            size="sm"
            className="w-10 h-10"
          >
            1
          </Button>
        </Link>
      )
      if (startPage > 2) {
        pages.push(
          <span key="ellipsis-start" className="px-2 py-1">
            ...
          </span>
        )
      }
    }

    // Add visible page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Link key={i} href={getPageUrl(i)}>
          <Button
            variant={currentPage === i ? 'default' : 'outline'}
            size="sm"
            className="w-10 h-10"
          >
            {i}
          </Button>
        </Link>
      )
    }

    // Add last page and ellipsis if needed
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <span key="ellipsis-end" className="px-2 py-1">
            ...
          </span>
        )
      }
      pages.push(
        <Link key={totalPages} href={getPageUrl(totalPages)}>
          <Button
            variant={currentPage === totalPages ? 'default' : 'outline'}
            size="sm"
            className="w-10 h-10"
          >
            {totalPages}
          </Button>
        </Link>
      )
    }

    return pages
  }

  if (totalPages <= 1) return null

  return (
    <nav
      className={cn('flex items-center justify-center space-x-2', className)}
      aria-label="Pagination"
    >
      {currentPage > 1 && (
        <Link href={getPageUrl(currentPage - 1)}>
          <Button variant="outline" size="sm" className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
        </Link>
      )}

      <div className="flex items-center space-x-1">{renderPageNumbers()}</div>

      {currentPage < totalPages && (
        <Link href={getPageUrl(currentPage + 1)}>
          <Button variant="outline" size="sm" className="gap-1">
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </nav>
  )
}
