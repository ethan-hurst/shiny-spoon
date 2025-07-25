import Link from 'next/link'
import Stripe from 'stripe'
import { Button } from '@/components/ui/button'
import NavBar from '@/components/wrapper/navbar'

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

/**
 * Displays a success page after a completed Stripe checkout session.
 *
 * Awaits the provided search parameters, retrieves the Stripe checkout session using the session ID, and renders a confirmation page with navigation options.
 *
 * @param props - Contains a promise resolving to the search parameters, including the Stripe session ID.
 */
export default async function SuccessPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams

  const session = await stripe.checkout.sessions.retrieve(
    searchParams?.session_id as string
  )

  return (
    <main className="flex min-w-screen flex-col items-center justify-between">
      <NavBar />
      <h1 className="mt-[35vh] mb-3 scroll-m-20  text-5xl font-semibold tracking-tight transition-colors first:mt-0">
        Welcome to Nextjs Starter Kit 🎉
      </h1>
      <p className="leading-7 text-center w-[60%]">Let&apos;s get cooking</p>
      <Link href="/dashboard" className="mt-4">
        <Button>Access Dashboard</Button>
      </Link>
    </main>
  )
}
