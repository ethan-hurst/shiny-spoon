import { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/legal-layout'
import { TableOfContents } from '@/components/legal/table-of-contents'
import PageWrapper from '@/components/wrapper/page-wrapper'

export const metadata: Metadata = {
  title: 'Terms of Service - TruthSource',
  description: 'Read the TruthSource terms of service. Learn about your rights and responsibilities when using our B2B data synchronization platform.',
}

export default function TermsPage() {
  return (
    <PageWrapper>
      <LegalLayout
        title="Terms of Service"
        lastUpdated="January 15, 2024"
        downloadUrl="/legal/terms-of-service.pdf"
      >
        <TableOfContents />
        
        <div className="prose prose-gray max-w-none">
          <h2 id="acceptance">1. Acceptance of Terms</h2>
          <p>
            By accessing and using TruthSource ("Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
          </p>

          <h2 id="description">2. Description of Service</h2>
          <p>
            TruthSource provides a B2B data synchronization platform that enables businesses to sync inventory, pricing, and customer data across multiple e-commerce and ERP systems. The Service includes:
          </p>
          <ul>
            <li>Real-time data synchronization</li>
            <li>Conflict resolution and data accuracy monitoring</li>
            <li>API access for custom integrations</li>
            <li>Customer portal functionality</li>
            <li>Analytics and reporting tools</li>
          </ul>

          <h2 id="account-terms">3. Account Terms</h2>
          <p>
            You must be 18 years or older to use this Service. You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account and password.
          </p>

          <h2 id="payment">4. Payment and Billing</h2>
          <p>
            A valid payment method is required for paid accounts. You will be billed in advance on a recurring and periodic basis (monthly or annual). You can cancel your subscription at any time.
          </p>

          <h2 id="data-privacy">5. Data Privacy and Security</h2>
          <p>
            We take data privacy seriously. Your business data is encrypted at rest and in transit. We maintain SOC 2 compliance and follow industry best practices for data security. See our Privacy Policy for more details.
          </p>

          <h2 id="prohibited-uses">6. Prohibited Uses</h2>
          <p>
            You may not use the Service for any illegal or unauthorized purpose. You must not, in the use of the Service, violate any laws in your jurisdiction.
          </p>

          <h2 id="api-usage">7. API Usage Terms</h2>
          <p>
            API usage is subject to rate limits as specified in your plan. Excessive API usage may result in temporary throttling or account suspension.
          </p>

          <h2 id="warranties">8. Warranties and Disclaimers</h2>
          <p>
            The Service is provided "as is" and "as available" without warranty of any kind. We do not warrant that the Service will be uninterrupted, timely, secure, or error-free.
          </p>

          <h2 id="limitation">9. Limitation of Liability</h2>
          <p>
            In no event shall TruthSource, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages.
          </p>

          <h2 id="termination">10. Termination</h2>
          <p>
            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
          </p>

          <h2 id="changes">11. Changes to Terms</h2>
          <p>
            We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
          </p>

          <h2 id="contact">12. Contact Information</h2>
          <p>
            If you have any questions about these Terms, please contact us at:
          </p>
          <ul>
            <li>Email: legal@truthsource.io</li>
            <li>Address: 123 Market Street, Suite 100, San Francisco, CA 94105</li>
          </ul>
        </div>
      </LegalLayout>
    </PageWrapper>
  )
}