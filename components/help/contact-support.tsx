import Link from 'next/link'
import { Clock, Mail, MessageCircle, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function ContactSupport() {
  return (
    <div className="mt-16">
      <Card className="bg-muted/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Still need help?</CardTitle>
          <CardDescription>
            Our support team is here to assist you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Live Chat</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Get instant help from our team
              </p>
              <Button variant="outline" className="w-full">
                Start Chat
              </Button>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Email Support</h3>
              <p className="text-sm text-muted-foreground mb-3">
                We'll respond within 24 hours
              </p>
              <Link href="/contact">
                <Button variant="outline" className="w-full">
                  Send Email
                </Button>
              </Link>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Phone Support</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Mon-Fri 9am-5pm EST
              </p>
              <Button variant="outline" className="w-full">
                1-800-TRUTH-SRC
              </Button>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Average response time: 2 hours</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
