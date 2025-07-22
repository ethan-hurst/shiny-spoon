import { Metadata } from 'next'
import { TeamGrid } from '@/components/company/team-grid'
import { CompanyValues } from '@/components/company/values'
import { CompanyStats } from '@/components/company/stats'
import { CompanyStory } from '@/components/company/story'
import PageWrapper from '@/components/wrapper/page-wrapper'

export const metadata: Metadata = {
  title: 'About TruthSource - Our Mission & Team',
  description: 'Learn about TruthSource\'s mission to eliminate B2B data errors and meet the team building the future of data synchronization.',
  keywords: ['about TruthSource', 'B2B software company', 'data synchronization', 'our team', 'our mission'],
}

const teamMembers = [
  {
    name: 'Sarah Chen',
    role: 'CEO & Co-founder',
    image: '/team/sarah-chen.jpg',
    bio: 'Former VP of Operations at a $100M B2B distributor. 15+ years in supply chain and e-commerce.',
    linkedin: 'https://linkedin.com/in/sarahchen',
  },
  {
    name: 'Michael Rodriguez',
    role: 'CTO & Co-founder',
    image: '/team/michael-rodriguez.jpg',
    bio: 'Previously Principal Engineer at Salesforce. Expert in distributed systems and real-time data.',
    linkedin: 'https://linkedin.com/in/michaelrodriguez',
  },
  {
    name: 'Emily Thompson',
    role: 'VP of Product',
    image: '/team/emily-thompson.jpg',
    bio: 'Former Product Lead at NetSuite. Passionate about solving complex B2B workflows.',
    linkedin: 'https://linkedin.com/in/emilythompson',
  },
  {
    name: 'David Park',
    role: 'VP of Engineering',
    image: '/team/david-park.jpg',
    bio: '10+ years building scalable B2B platforms. Previously at Shopify Plus.',
    linkedin: 'https://linkedin.com/in/davidpark',
  },
  {
    name: 'Lisa Wang',
    role: 'VP of Customer Success',
    image: '/team/lisa-wang.jpg',
    bio: 'Expert in B2B customer experience. Previously built CS teams at multiple SaaS startups.',
    linkedin: 'https://linkedin.com/in/lisawang',
  },
  {
    name: 'James Mitchell',
    role: 'VP of Sales',
    image: '/team/james-mitchell.jpg',
    bio: '15+ years in B2B software sales. Track record of building high-performing sales teams.',
    linkedin: 'https://linkedin.com/in/jamesmitchell',
  },
]

export default function AboutPage() {
  return (
    <PageWrapper>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">About TruthSource</h1>
          
          <div className="text-center mb-12">
            <p className="text-xl text-gray-600">
              We're on a mission to eliminate data errors in B2B commerce
            </p>
          </div>

          <CompanyStory />
          <CompanyStats />
          <CompanyValues />
          <TeamGrid members={teamMembers} />

          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Join Our Team</h2>
            <p className="text-gray-600 mb-6">
              We're always looking for talented people who share our passion for accurate data.
            </p>
            <a
              href="/careers"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              View Open Positions
            </a>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}