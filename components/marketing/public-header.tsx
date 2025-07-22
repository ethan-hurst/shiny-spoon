'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { Menu, ChevronRight } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { UserProfile } from '@/components/user-profile'
import ModeToggle from '@/components/mode-toggle'
import * as React from 'react'

const navigation = {
  features: [
    { name: 'Inventory Sync', href: '/features/inventory-sync', description: 'Real-time inventory synchronization' },
    { name: 'Pricing Rules', href: '/features/pricing-rules', description: 'Dynamic B2B pricing management' },
    { name: 'Customer Portal', href: '/features/customer-portal', description: 'Self-service for your customers' },
    { name: 'Analytics', href: '/features/analytics', description: 'Data insights and reporting' },
  ],
  solutions: [
    { name: 'For Distributors', href: '/solutions/distributors', description: 'Streamline distribution operations' },
    { name: 'For Manufacturers', href: '/solutions/manufacturers', description: 'Connect with your supply chain' },
    { name: 'For Retailers', href: '/solutions/retailers', description: 'Manage multi-channel inventory' },
  ],
  resources: [
    { name: 'Documentation', href: '/docs', description: 'Guides and API reference' },
    { name: 'API Reference', href: '/developers', description: 'Developer documentation' },
    { name: 'Blog', href: '/blog', description: 'Latest news and insights' },
    { name: 'Case Studies', href: '/case-studies', description: 'Customer success stories' },
  ],
  company: [
    { name: 'About', href: '/about', description: 'Our mission and team' },
    { name: 'Careers', href: '/careers', description: 'Join our growing team' },
    { name: 'Contact', href: '/contact', description: 'Get in touch with us' },
  ],
}

export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createBrowserClient()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return (
    <header className={cn(
      'fixed top-0 w-full z-50 transition-all duration-200',
      scrolled ? 'bg-white/95 dark:bg-black/95 backdrop-blur-sm shadow-sm' : 'bg-transparent'
    )}>
      <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold">TruthSource</span>
          </Link>

          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Features</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4 lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                    {navigation.features.map((item) => (
                      <ListItem
                        key={item.name}
                        title={item.name}
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
                        key={item.name}
                        title={item.name}
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
                        key={item.name}
                        title={item.name}
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
                        key={item.name}
                        title={item.name}
                        href={item.href}
                      >
                        {item.description}
                      </ListItem>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Link href="/pricing" legacyBehavior passHref>
                  <NavigationMenuLink className={cn(
                    'group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50'
                  )}>
                    Pricing
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/dashboard" className="hidden lg:block">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <UserProfile />
            </>
          ) : (
            <>
              <Link href="/login" className="hidden lg:block">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link href="/signup" className="hidden lg:block">
                <Button size="sm">Start free trial</Button>
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
              <MobileNav navigation={navigation} user={user} onItemClick={() => setMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
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

function MobileNav({ navigation, user, onItemClick }: { 
  navigation: typeof navigation, 
  user: User | null,
  onItemClick: () => void 
}) {
  return (
    <div className="flex flex-col space-y-4 mt-8">
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
            <Button variant="outline" className="w-full">Log in</Button>
          </Link>
          <Link href="/signup" onClick={onItemClick}>
            <Button className="w-full">Start free trial</Button>
          </Link>
        </>
      )}
      
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">Features</h3>
        {navigation.features.map((item) => (
          <Link key={item.name} href={item.href} onClick={onItemClick}>
            <Button variant="ghost" className="w-full justify-start text-sm">
              {item.name}
            </Button>
          </Link>
        ))}
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">Company</h3>
        {navigation.company.map((item) => (
          <Link key={item.name} href={item.href} onClick={onItemClick}>
            <Button variant="ghost" className="w-full justify-start text-sm">
              {item.name}
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