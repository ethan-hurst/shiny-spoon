'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Custom link component that handles internal/external links
function CustomLink({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href) return <>{children}</>

  // Validate URL for security
  const isValidUrl = (url: string) => {
    try {
      if (url.startsWith('/') || url.startsWith('#')) return true
      const parsed = new URL(url)
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }

  if (!isValidUrl(href)) {
    console.warn(`Invalid URL detected: ${href}`)
    return <span {...props}>{children}</span>
  }

  if (href.startsWith('/')) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    )
  }

  if (href.startsWith('#')) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
      <span className="sr-only">(opens in new tab)</span>
    </a>
  )
}

// Custom image component with Next.js Image optimization
function CustomImage({
  src,
  alt,
  width,
  height,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  width?: number
  height?: number
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  if (!src) return null

  // Require meaningful alt text
  if (!alt || alt.trim() === '') {
    console.warn(`Image missing alt text: ${src}`)
  }

  const handleLoad = () => setIsLoading(false)
  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-center bg-gray-100 rounded-lg p-8 text-gray-500">
        <span>Failed to load image</span>
      </div>
    )
  }

  // If dimensions are provided, use Next.js Image
  if (width && height) {
    return (
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <span className="text-gray-500">Loading...</span>
          </div>
        )}
        <Image
          src={src}
          alt={alt || 'Image'}
          width={width}
          height={height}
          className={cn('rounded-lg', isLoading && 'opacity-0')}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      </div>
    )
  }

  // Otherwise, use regular img tag with loading state
  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <span className="text-gray-500">Loading...</span>
        </div>
      )}
      <img
        src={src}
        alt={alt || 'Image'}
        className={cn('rounded-lg', isLoading && 'opacity-0')}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  )
}

// Code block wrapper with copy button
function CodeBlock({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  return (
    <pre
      className={cn(
        'relative overflow-x-auto rounded-lg bg-gray-900 p-4',
        className
      )}
      {...props}
    >
      {children}
    </pre>
  )
}

// Inline code styling
function InlineCode({ children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <code
      className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-gray-900 dark:bg-gray-800 dark:text-gray-100"
      {...props}
    >
      {children}
    </code>
  )
}

// Callout/Alert component
function Callout({
  children,
  type = 'info',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  type?: 'info' | 'warning' | 'error' | 'success'
}) {
  const styles = {
    info: 'border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200',
    warning:
      'border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200',
    error:
      'border-red-500 bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-200',
    success:
      'border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200',
  }

  return (
    <div
      className={cn('my-6 rounded-lg border-l-4 p-4', styles[type])}
      {...props}
    >
      {children}
    </div>
  )
}

// Table components with responsive wrapper
function Table({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div
      className="my-6 overflow-x-auto"
      role="region"
      aria-label="Table content"
    >
      <table
        className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
        role="table"
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

// Typography components
const components = {
  // Headings
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mt-8 mb-4 text-4xl font-bold tracking-tight" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mt-8 mb-4 text-3xl font-semibold tracking-tight" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-6 mb-3 text-2xl font-semibold tracking-tight" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h4 className="mt-4 mb-2 text-xl font-semibold tracking-tight" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h5 className="mt-4 mb-2 text-lg font-semibold tracking-tight" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h6 className="mt-4 mb-2 text-base font-semibold tracking-tight" {...props}>
      {children}
    </h6>
  ),

  // Paragraphs and text
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mb-4 leading-7 text-gray-700 dark:text-gray-300" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong
      className="font-semibold text-gray-900 dark:text-gray-100"
      {...props}
    >
      {children}
    </strong>
  ),
  em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),

  // Lists
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="mb-4 ml-6 list-disc space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="mb-4 ml-6 list-decimal space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="text-gray-700 dark:text-gray-300" {...props}>
      {children}
    </li>
  ),

  // Blockquote
  blockquote: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="my-6 border-l-4 border-gray-300 pl-6 italic text-gray-700 dark:border-gray-600 dark:text-gray-300"
      {...props}
    >
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className="my-8 border-gray-200 dark:border-gray-700" {...props} />
  ),

  // Code
  pre: CodeBlock,
  code: InlineCode,

  // Links and images
  a: CustomLink,
  img: CustomImage,
  Image: CustomImage,

  // Tables
  table: Table,
  thead: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-gray-50 dark:bg-gray-800" {...props}>
      {children}
    </thead>
  ),
  tbody: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody
      className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900"
      {...props}
    >
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr {...props}>{children}</tr>
  ),
  th: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
      scope="col"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td
      className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100"
      {...props}
    >
      {children}
    </td>
  ),

  // Custom components
  Callout,
}

export const MDXComponents = components
