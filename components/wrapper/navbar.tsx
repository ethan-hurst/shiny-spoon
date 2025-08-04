'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { BlocksIcon, ChevronRight, Menu } from 'lucide-react'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { createBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import ModeToggle from '../mode-toggle'
import { Button } from '../ui/button'
import { UserProfile } from '../user-profile'

const navigation = {
  features: [
    {
      title: 'Inventory Sync',
      href: '/features/inventory-sync',
      description:
        'Keep inventory accurate across all channels with real-time sync',
    },
    {
      title: 'Pricing Rules',
      href: '/features/pricing-rules',
      description: 'Manage complex B2B pricing with customer-specific rules',
    },
    {
      title: 'Customer Portal',
      href: '/features/customer-portal',
      description: 'Give customers self-service access to orders and inventory',
    },
    {
      title: 'Analytics',
      href: '/features/analytics',
      description: 'Track sync performance and data accuracy metrics',
    },
  ],
  solutions: [
    {
      title: 'For Distributors',
      href: '/solutions/distributors',
      description: 'Streamline operations and reduce order errors',
    },
    {
      title: 'For Manufacturers',
      href: '/solutions/manufacturers',
      description: 'Connect your supply chain in real-time',
    },
    {
      title: 'For Retailers',
      href: '/solutions/retailers',
      description: 'Manage inventory across all sales channels',
    },
  ],
  resources: [
    {
      title: 'Documentation',
      href: '/docs',
      description: 'Get started with our comprehensive guides',
    },
    {
      title: 'API Reference',
      href: '/developers',
      description: 'Build custom integrations with our API',
    },
    {
      title: 'Blog',
      href: '/blog',
      description: 'Latest updates and industry insights',
    },
    {
      title: 'Help Center',
      href: '/help',
      description: 'Find answers to common questions',
    },
  ],
  company: [
    {
      title: 'About',
      href: '/about',
      description: 'Learn about our mission and team',
    },
    {
      title: 'Careers',
      href: '/careers',
      description: 'Join our growing team',
    },
    {
      title: 'Contact',
      href: '/contact',
      description: 'Get in touch with our team',
    },
    {
      title: 'Partners',
      href: '/partners',
      description: 'Explore partnership opportunities',
    },
  ],
}

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      setUser(user)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return (
    <div
      className={cn(
        'flex min-w-full fixed justify-between p-2 border-b z-50 transition-all duration-200',
        scrolled
          ? 'bg-white/95 dark:bg-black/95 backdrop-blur-sm shadow-sm'
          : 'bg-white dark:bg-black dark:bg-opacity-50'
      )}
    >
      <div className="flex items-center gap-8">
        <Link
          href="/"
          className="pl-2 flex items-center gap-2"
          aria-label="Home"
        >
          <BlocksIcon aria-hidden="true" className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl hidden sm:block">TruthSource</span>
        </Link>

        <NavigationMenu className="hidden lg:block">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Features</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 lg:w-[500px] lg:grid-cols-1">
                  {navigation.features.map((item) => (
                    <ListItem
                      key={item.title}
                      title={item.title}
                      href={item.href}
                    >
                      {item.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger>Solutions</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4">
                  {navigation.solutions.map((item) => (
                    <ListItem
                      key={item.title}
                      title={item.title}
                      href={item.href}
                    >
                      {item.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4">
                  {navigation.resources.map((item) => (
                    <ListItem
                      key={item.title}
                      title={item.title}
                      href={item.href}
                    >
                      {item.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger>Company</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4">
                  {navigation.company.map((item) => (
                    <ListItem
                      key={item.title}
                      title={item.title}
                      href={item.href}
                    >
                      {item.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <Link href="/pricing">
                <NavigationMenuLink
                  className={cn(
                    'group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50'
                  )}
                >
                  Pricing
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>

            {user && (
              <NavigationMenuItem>
                <Link href="/dashboard">
                  <NavigationMenuLink
                    className={cn(
                      'group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50'
                    )}
                  >
                    Dashboard
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            )}
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <div className="flex items-center gap-2">
        {user ? (
          <UserProfile />
        ) : (
          <>
            <Link href="/login" className="hidden min-[825px]:block">
              <Button variant="ghost" size="sm">
                Log In
              </Button>
            </Link>
            <Link href="/signup" className="hidden min-[825px]:block">
              <Button size="sm">Start Free Trial</Button>
            </Link>
          </>
        )}
        <ModeToggle />

        {/* Mobile menu */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px]">
            <SheetHeader>
              <SheetTitle>TruthSource</SheetTitle>
            </SheetHeader>
            <MobileNav
              navigation={navigation}
              user={user}
              onItemClick={() => setMobileMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}

const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'>
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  )
})
ListItem.displayName = 'ListItem'

function MobileNav({
  navigation,
  user,
  onItemClick,
}: {
  navigation: typeof navigation
  user: User | null
  onItemClick: () => void
}) {
  return (
    <div className="flex flex-col space-y-4 mt-8">
      <Link href="/" onClick={onItemClick}>
        <Button variant="outline" className="w-full justify-start">
          <ChevronRight className="mr-2 h-4 w-4" />
          Home
        </Button>
      </Link>

      {user ? (
        <Link href="/dashboard" onClick={onItemClick}>
          <Button variant="outline" className="w-full justify-start">
            <ChevronRight className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      ) : (
        <>
          <Link href="/login" onClick={onItemClick}>
            <Button variant="outline" className="w-full">
              Log in
            </Button>
          </Link>
          <Link href="/signup" onClick={onItemClick}>
            <Button className="w-full">Start Free Trial</Button>
          </Link>
        </>
      )}

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">Features</h3>
        {navigation.features.map((item) => (
          <Link key={item.title} href={item.href} onClick={onItemClick}>
            <Button variant="ghost" className="w-full justify-start text-sm">
              {item.title}
            </Button>
          </Link>
        ))}
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">Solutions</h3>
        {navigation.solutions.map((item) => (
          <Link key={item.title} href={item.href} onClick={onItemClick}>
            <Button variant="ghost" className="w-full justify-start text-sm">
              {item.title}
            </Button>
          </Link>
        ))}
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">Resources</h3>
        {navigation.resources.map((item) => (
          <Link key={item.title} href={item.href} onClick={onItemClick}>
            <Button variant="ghost" className="w-full justify-start text-sm">
              {item.title}
            </Button>
          </Link>
        ))}
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">Company</h3>
        {navigation.company.map((item) => (
          <Link key={item.title} href={item.href} onClick={onItemClick}>
            <Button variant="ghost" className="w-full justify-start text-sm">
              {item.title}
            </Button>
          </Link>
        ))}
      </div>

      <div className="border-t pt-4">
        <Link href="/pricing" onClick={onItemClick}>
          <Button variant="ghost" className="w-full justify-start">
            Pricing
          </Button>
        </Link>
      </div>
    </div>
  )
}
