import { type Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BookOpen,
  Code2,
  FileCode2,
  GitBranch,
  Webhook,
  TestTube2,
  History,
  Home,
} from 'lucide-react'

export const metadata: Metadata = {
  title: {
    template: '%s | TruthSource Developer Portal',
    default: 'Developer Portal',
  },
  description: 'Build powerful integrations with the TruthSource API',
}

const navigation = [
  {
    name: 'Overview',
    href: '/developers',
    icon: Home,
  },
  {
    name: 'API Documentation',
    href: '/developers/docs',
    icon: BookOpen,
  },
  {
    name: 'SDKs & Libraries',
    href: '/developers/sdks',
    icon: Code2,
  },
  {
    name: 'Integration Guides',
    href: '/developers/guides',
    icon: FileCode2,
  },
  {
    name: 'Webhooks',
    href: '/developers/webhooks',
    icon: Webhook,
  },
  {
    name: 'Testing Tools',
    href: '/developers/testing',
    icon: TestTube2,
  },
  {
    name: 'Changelog',
    href: '/developers/changelog',
    icon: History,
  },
]

export default function DevelopersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="mr-8 flex items-center space-x-2">
            <Code2 className="h-6 w-6" />
            <span className="font-semibold">TruthSource Developers</span>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <nav className="flex items-center space-x-6">
              <Link
                href="/developers"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                Home
              </Link>
              <Link
                href="/developers/docs"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                API Docs
              </Link>
              <Link
                href="/developers/guides"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                Guides
              </Link>
              <Link
                href="https://github.com/truthsource"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                <GitBranch className="h-4 w-4" />
              </Link>
            </nav>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Get API Key</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <aside className="hidden w-64 border-r bg-muted/10 lg:block">
          <ScrollArea className="h-full py-6">
            <nav className="space-y-1 px-3">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* Resources Section */}
            <div className="mt-8 px-3">
              <h4 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Resources
              </h4>
              <nav className="space-y-1">
                <Link
                  href="https://status.truthsource.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  API Status
                </Link>
                <Link
                  href="/developers/support"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Support
                </Link>
                <Link
                  href="https://community.truthsource.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Community
                </Link>
              </nav>
            </div>

            {/* API Version */}
            <div className="mt-8 px-6">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground">API Version</p>
                <p className="text-sm font-semibold">v1.0.0</p>
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="container py-6 lg:py-8">{children}</div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by{' '}
            <Link
              href="/"
              className="font-medium underline underline-offset-4 hover:no-underline"
            >
              TruthSource
            </Link>
            . The source of truth for B2B e-commerce.
          </p>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/developers/docs#rate-limiting" className="hover:underline">
              Rate Limits
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}