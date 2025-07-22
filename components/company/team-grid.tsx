import { Card } from '@/components/ui/card'
import { Linkedin } from 'lucide-react'
import Link from 'next/link'

interface TeamMember {
  name: string
  role: string
  image: string
  bio: string
  linkedin?: string
}

interface TeamGridProps {
  members: TeamMember[]
}

export function TeamGrid({ members }: TeamGridProps) {
  return (
    <section className="py-12">
      <h2 className="text-2xl font-bold mb-8 text-center">Meet Our Team</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {members.map((member) => (
          <Card key={member.name} className="overflow-hidden">
            <div className="aspect-square relative bg-gray-100">
              <img
                src={member.image}
                alt={member.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{member.name}</h3>
                  <p className="text-sm text-gray-600">{member.role}</p>
                </div>
                {member.linkedin && (
                  <Link
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-primary transition-colors"
                  >
                    <Linkedin className="h-5 w-5" />
                  </Link>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-3">{member.bio}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}