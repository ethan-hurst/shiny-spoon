import { notFound } from 'next/navigation'
import { allDocs } from 'contentlayer2/generated'
import { getMDXComponent } from 'next-contentlayer2/hooks'
import { MDXComponents } from '@/components/mdx'
import { TableOfContents } from '@/components/docs/table-of-contents'
import { DocsPagination } from '@/components/docs/pagination'

/**
 * Generates route parameters for all documentation pages for static site generation.
 *
 * @returns An array of objects, each containing a `slug` array representing the path segments for a documentation page.
 */
export async function generateStaticParams() {
  return allDocs.map((doc) => ({
    slug: doc.slug.split('/'),
  }))
}

/**
 * Generates metadata for a documentation page based on the provided slug parameters.
 *
 * Resolves the slug from the incoming parameters, locates the corresponding document, and returns an object containing the page title and description. Returns an empty object if no matching document is found.
 *
 * @returns An object with `title` and `description` for the page, or an empty object if the document does not exist.
 */
export async function generateMetadata(props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params
  const doc = allDocs.find((doc) => doc.slug === params.slug.join('/'))
  if (!doc) return {}

  return {
    title: `${doc.title} - TruthSource Docs`,
    description: doc.description,
  }
}

/**
 * Renders a documentation page based on the provided slug parameters.
 *
 * Displays the document's title, description, MDX content, pagination links to adjacent documents in the same category, and a sidebar table of contents. Triggers a 404 page if the document is not found.
 */
export default async function DocPage(props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params
  const doc = allDocs.find((doc) => doc.slug === params.slug.join('/'))

  if (!doc) {
    notFound()
  }

  const MDXContent = getMDXComponent(doc.body.code)

  // Find previous and next docs in the same category
  const categoryDocs = allDocs
    .filter((d) => d.category === doc.category)
    .sort((a, b) => a.order - b.order)
  
  const currentIndex = categoryDocs.findIndex((d) => d._id === doc._id)
  const prevDoc = currentIndex > 0 ? categoryDocs[currentIndex - 1] : null
  const nextDoc = currentIndex < categoryDocs.length - 1 ? categoryDocs[currentIndex + 1] : null

  return (
    <div className="flex gap-8">
      <article className="flex-1 min-w-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{doc.title}</h1>
          <p className="text-lg text-muted-foreground">{doc.description}</p>
        </div>

        <div className="prose prose-gray max-w-none dark:prose-invert">
          <MDXContent components={MDXComponents} />
        </div>

        <DocsPagination
          prev={prevDoc ? { title: prevDoc.title, href: prevDoc.url } : null}
          next={nextDoc ? { title: nextDoc.title, href: nextDoc.url } : null}
        />
      </article>

      <aside className="hidden xl:block w-64 shrink-0">
        <div className="sticky top-20">
          <TableOfContents content={doc.body.raw} />
        </div>
      </aside>
    </div>
  )
}