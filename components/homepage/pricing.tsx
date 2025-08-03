'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import type { User } from '@supabase/supabase-js'
import axios from 'axios'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ANNUAL_DISCOUNT_PERCENTAGE,
  BILLING_INTERVALS,
  SUBSCRIPTION_PLANS,
} from '@/lib/constants/billing'
import { createBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { TITLE_TAILWIND_CLASS } from '@/utils/constants'

type PricingSwitchProps = {
  // eslint-disable-next-line no-unused-vars
  onSwitch: (value: string) => void
}

type PricingCardProps = {
  user: User | null
  handleCheckout: (priceId: string) => Promise<void>
  priceIdMonthly: string
  priceIdYearly: string
  isYearly?: boolean
  title: string
  monthlyPrice?: number
  yearlyPrice?: number
  description: string
  features: string[]
  actionLabel: string
  popular?: boolean
  exclusive?: boolean
}

const PricingHeader = ({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) => (
  <section className="text-center">
    <h1
      className={`${TITLE_TAILWIND_CLASS} mt-2 font-semibold tracking-tight dark:text-white text-gray-900`}
    >
      {title}
    </h1>
    <p className="text-gray-600 dark:text-gray-400 pt-1">{subtitle}</p>
    <br />
  </section>
)

const PricingSwitch = ({ onSwitch }: PricingSwitchProps) => (
  <Tabs defaultValue="0" className="w-40 mx-auto" onValueChange={onSwitch}>
    <TabsList className="py-6 px-2">
      <TabsTrigger value="0" className="text-base">
        <p className="text-black dark:text-white">Monthly</p>
      </TabsTrigger>
      <TabsTrigger value="1" className="text-base">
        <p className="text-black dark:text-white">Yearly</p>
      </TabsTrigger>
    </TabsList>
  </Tabs>
)

const PricingCard = ({
  user,
  handleCheckout,
  isYearly,
  title,
  priceIdMonthly,
  priceIdYearly,
  monthlyPrice,
  yearlyPrice,
  description,
  features,
  actionLabel,
  popular,
  exclusive,
}: PricingCardProps) => {
  const router = useRouter()
  return (
    <Card
      className={cn(
        `w-72 flex flex-col justify-between py-1 ${popular ? 'border-rose-400' : 'border-zinc-700'} mx-auto sm:mx-0`,
        {
          'animate-background-shine bg-white dark:bg-[linear-gradient(110deg,#000103,45%,#1e2631,55%,#000103)] bg-[length:200%_100%] transition-colors':
            exclusive,
        }
      )}
    >
      <div>
        <CardHeader className="pb-8 pt-4">
          {isYearly && yearlyPrice && monthlyPrice ? (
            <div className="flex justify-between">
              <CardTitle className="text-zinc-700 dark:text-zinc-300 text-lg">
                {title}
              </CardTitle>
              <div
                className={cn(
                  'px-2.5 rounded-xl h-fit text-sm py-1 bg-zinc-200 text-black dark:bg-zinc-800 dark:text-white',
                  {
                    'bg-gradient-to-r from-orange-400 to-rose-400 dark:text-black ':
                      popular,
                  }
                )}
              >
                Save ${monthlyPrice * 12 - yearlyPrice}
              </div>
            </div>
          ) : (
            <CardTitle className="text-zinc-700 dark:text-zinc-300 text-lg">
              {title}
            </CardTitle>
          )}
          <div className="flex gap-0.5">
            <h2 className="text-3xl font-bold">
              {yearlyPrice && isYearly
                ? '$' + yearlyPrice
                : monthlyPrice
                  ? '$' + monthlyPrice
                  : 'Custom'}
            </h2>
            <span className="flex flex-col justify-end text-sm mb-1">
              {yearlyPrice && isYearly
                ? '/year'
                : monthlyPrice
                  ? '/month'
                  : null}
            </span>
          </div>
          <CardDescription className="pt-1.5 h-12">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {features.map((feature: string) => (
            <CheckItem key={feature} text={feature} />
          ))}
        </CardContent>
      </div>
      <CardFooter className="mt-2">
        <Button
          onClick={() => {
            if (user?.id) {
              handleCheckout(isYearly ? priceIdYearly : priceIdMonthly, true)
            } else {
              toast('Please login or sign up to purchase', {
                description: 'You must be logged in to make a purchase',
                action: {
                  label: 'Sign Up',
                  onClick: () => {
                    router.push('/signup')
                  },
                },
              })
            }
          }}
          className="relative inline-flex w-full items-center justify-center rounded-md bg-black text-white dark:bg-white px-6 font-medium dark:text-black transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
          type="button"
        >
          <div className="absolute -inset-0.5 -z-10 rounded-lg bg-gradient-to-b from-[#c7d2fe] to-[#8678f9] opacity-75 blur" />
          {actionLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}

const CheckItem = ({ text }: { text: string }) => (
  <div className="flex gap-2">
    <CheckCircle2 size={18} className="my-auto text-green-400" />
    <p className="pt-0.5 text-zinc-700 dark:text-zinc-300 text-sm">{text}</p>
  </div>
)

export default function Pricing() {
  const [isYearly, setIsYearly] = useState<boolean>(false)
  const [user, setUser] = useState<User | null>(null)
  const togglePricingPeriod = (value: string) =>
    setIsYearly(parseInt(value) === 1)
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    setStripePromise(loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!))

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

  const handleCheckout = async (priceId: string, subscription: boolean) => {
    try {
      const { data } = await axios.post(
        `/api/payments/create-checkout-session`,
        {
          userId: user?.id,
          email: user?.email,
          priceId,
          subscription,
        }
      )

      if (data.sessionId) {
        const stripe = await stripePromise

        const response = await stripe?.redirectToCheckout({
          sessionId: data.sessionId,
        })

        return response
      } else {
        console.error('Failed to create checkout session')
        toast('Failed to create checkout session')
        return
      }
    } catch (error) {
      console.error('Error during checkout:', error)
      toast('Error during checkout')
      return
    }
  }

  const plans = [
    {
      title: SUBSCRIPTION_PLANS.BASIC.name,
      monthlyPrice: SUBSCRIPTION_PLANS.BASIC.monthlyPrice,
      yearlyPrice: SUBSCRIPTION_PLANS.BASIC.yearlyPrice,
      description: SUBSCRIPTION_PLANS.BASIC.description,
      features: SUBSCRIPTION_PLANS.BASIC.features,
      priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_BASIC_MONTHLY,
      priceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_BASIC_YEARLY,
      actionLabel: 'Get Started',
    },
    {
      title: SUBSCRIPTION_PLANS.PRO.name,
      monthlyPrice: SUBSCRIPTION_PLANS.PRO.monthlyPrice,
      yearlyPrice: SUBSCRIPTION_PLANS.PRO.yearlyPrice,
      description: SUBSCRIPTION_PLANS.PRO.description,
      features: SUBSCRIPTION_PLANS.PRO.features,
      actionLabel: 'Get Started',
      priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_MONTHLY,
      priceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_YEARLY,
      popular: SUBSCRIPTION_PLANS.PRO.popular,
    },
    {
      title: SUBSCRIPTION_PLANS.ENTERPRISE.name,
      price: 'Custom',
      monthlyPrice: SUBSCRIPTION_PLANS.ENTERPRISE.monthlyPrice,
      yearlyPrice: SUBSCRIPTION_PLANS.ENTERPRISE.yearlyPrice,
      description: SUBSCRIPTION_PLANS.ENTERPRISE.description,
      features: SUBSCRIPTION_PLANS.ENTERPRISE.features,
      actionLabel: 'Contact Sales',
      priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ENTERPRISE,
      priceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ENTERPRISE,
      exclusive: SUBSCRIPTION_PLANS.ENTERPRISE.exclusive,
    },
  ]

  return (
    <div>
      <PricingHeader
        title="Sample Pricing Plans"
        subtitle="Use these sample pricing cards in your SAAS"
      />
      <PricingSwitch onSwitch={togglePricingPeriod} />
      <section className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-8 mt-8">
        {plans.map((plan) => {
          return (
            <PricingCard
              user={user}
              handleCheckout={handleCheckout}
              key={plan.title}
              {...plan}
              isYearly={isYearly}
            />
          )
        })}
      </section>
    </div>
  )
}
