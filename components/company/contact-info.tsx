import { Card } from '@/components/ui/card'
import { Mail, Phone, MapPin, Clock } from 'lucide-react'

export function ContactInfo() {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Get in Touch</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Email</p>
              <p className="text-sm text-gray-600">
                <a href="mailto:support@truthsource.io" className="hover:text-primary transition-colors">
                  support@truthsource.io
                </a>
              </p>
              <p className="text-sm text-gray-600">
                <a href="mailto:sales@truthsource.io" className="hover:text-primary transition-colors">
                  sales@truthsource.io
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Phone</p>
              <p className="text-sm text-gray-600">+1 (415) 555-0123</p>
              <p className="text-sm text-gray-600">Mon-Fri 9am-6pm PST</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Office</p>
              <p className="text-sm text-gray-600">123 Market Street, Suite 100</p>
              <p className="text-sm text-gray-600">San Francisco, CA 94105</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Business Hours</p>
              <p className="text-sm text-gray-600">Monday - Friday: 9:00 AM - 6:00 PM PST</p>
              <p className="text-sm text-gray-600">24/7 Support for Enterprise</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-primary/5 border-primary/10">
        <h3 className="font-semibold mb-2">Need immediate assistance?</h3>
        <p className="text-sm text-gray-600 mb-4">
          Our support team is here to help you get the most out of TruthSource.
        </p>
        <div className="space-y-2">
          <p className="text-sm">
            <strong>Enterprise Support:</strong> enterprise@truthsource.io
          </p>
          <p className="text-sm">
            <strong>Technical Support:</strong> Use the in-app chat
          </p>
        </div>
      </Card>
    </div>
  )
}