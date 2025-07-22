import { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/legal-layout'
import { TableOfContents } from '@/components/legal/table-of-contents'
import PageWrapper from '@/components/wrapper/page-wrapper'

export const metadata: Metadata = {
  title: 'Privacy Policy - TruthSource',
  description: 'Learn how TruthSource collects, uses, and protects your data. Our commitment to privacy and data security.',
}

export default function PrivacyPage() {
  return (
    <PageWrapper>
      <LegalLayout
        title="Privacy Policy"
        lastUpdated="January 15, 2024"
        downloadUrl="/legal/privacy-policy.pdf"
      >
        <TableOfContents />
        
        <div className="prose prose-gray max-w-none">
          <h2 id="introduction">1. Introduction</h2>
          <p>
            TruthSource ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
          </p>

          <h2 id="information-collected">2. Information We Collect</h2>
          <h3 id="personal-information">Personal Information</h3>
          <p>
            We collect information you provide directly to us, such as:
          </p>
          <ul>
            <li>Name and contact information</li>
            <li>Company details</li>
            <li>Billing information</li>
            <li>Account credentials</li>
          </ul>

          <h3 id="business-data">Business Data</h3>
          <p>
            To provide our services, we process:
          </p>
          <ul>
            <li>Inventory data</li>
            <li>Pricing information</li>
            <li>Customer records</li>
            <li>Order and transaction data</li>
          </ul>

          <h3 id="usage-data">Usage Data</h3>
          <p>
            We automatically collect:
          </p>
          <ul>
            <li>Log data and IP addresses</li>
            <li>Browser type and version</li>
            <li>Pages visited and time spent</li>
            <li>API usage statistics</li>
          </ul>

          <h2 id="how-we-use">3. How We Use Your Information</h2>
          <p>
            We use the information we collect to:
          </p>
          <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send related information</li>
            <li>Send technical notices and support messages</li>
            <li>Respond to your comments and questions</li>
            <li>Monitor and analyze usage patterns</li>
            <li>Detect and prevent fraudulent activity</li>
          </ul>

          <h2 id="data-sharing">4. Information Sharing and Disclosure</h2>
          <p>
            We do not sell, trade, or rent your personal information. We may share your information only in the following circumstances:
          </p>
          <ul>
            <li>With your consent</li>
            <li>To comply with legal obligations</li>
            <li>To protect our rights and prevent fraud</li>
            <li>With service providers who assist our operations</li>
            <li>In connection with a merger or acquisition</li>
          </ul>

          <h2 id="data-security">5. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your data:
          </p>
          <ul>
            <li>256-bit SSL encryption for data in transit</li>
            <li>AES-256 encryption for data at rest</li>
            <li>Regular security audits and penetration testing</li>
            <li>SOC 2 Type II compliance</li>
            <li>Strict access controls and authentication</li>
          </ul>

          <h2 id="data-retention">6. Data Retention</h2>
          <p>
            We retain your information for as long as necessary to provide our services and comply with legal obligations. When you close your account, we will delete or anonymize your data within 90 days, unless required to retain it for legal reasons.
          </p>

          <h2 id="your-rights">7. Your Rights</h2>
          <p>
            You have the right to:
          </p>
          <ul>
            <li>Access your personal information</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to processing of your data</li>
            <li>Export your data in a portable format</li>
            <li>Withdraw consent at any time</li>
          </ul>

          <h2 id="gdpr">8. GDPR Compliance</h2>
          <p>
            For users in the European Economic Area (EEA), we comply with the General Data Protection Regulation (GDPR). We process data based on:
          </p>
          <ul>
            <li>Your consent</li>
            <li>Contract fulfillment</li>
            <li>Legal obligations</li>
            <li>Legitimate business interests</li>
          </ul>

          <h2 id="cookies">9. Cookies and Tracking</h2>
          <p>
            We use cookies and similar tracking technologies to improve your experience. You can control cookies through your browser settings. See our Cookie Policy for more details.
          </p>

          <h2 id="children">10. Children's Privacy</h2>
          <p>
            Our Service is not intended for children under 18. We do not knowingly collect personal information from children.
          </p>

          <h2 id="international">11. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers.
          </p>

          <h2 id="changes">12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.
          </p>

          <h2 id="contact-privacy">13. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, please contact us at:
          </p>
          <ul>
            <li>Email: privacy@truthsource.io</li>
            <li>Address: 123 Market Street, Suite 100, San Francisco, CA 94105</li>
            <li>Data Protection Officer: dpo@truthsource.io</li>
          </ul>
        </div>
      </LegalLayout>
    </PageWrapper>
  )
}