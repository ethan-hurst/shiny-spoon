import { Metadata } from 'next'
import { LegalLayout } from '@/components/legal/legal-layout'
import { TableOfContents } from '@/components/legal/table-of-contents'
import PageWrapper from '@/components/wrapper/page-wrapper'

export const metadata: Metadata = {
  title: 'Cookie Policy - TruthSource',
  description: 'Learn about how TruthSource uses cookies and similar tracking technologies to improve your experience.',
}

export default function CookiesPage() {
  return (
    <PageWrapper>
      <LegalLayout
        title="Cookie Policy"
        lastUpdated="January 15, 2024"
        downloadUrl="/legal/cookie-policy.pdf"
      >
        <TableOfContents />
        
        <div className="prose prose-gray max-w-none">
          <h2 id="what-are-cookies">1. What Are Cookies?</h2>
          <p>
            Cookies are small text files that are placed on your device when you visit a website. They help websites remember information about your visit, making your next visit easier and the site more useful to you.
          </p>

          <h2 id="how-we-use">2. How We Use Cookies</h2>
          <p>
            TruthSource uses cookies and similar tracking technologies for the following purposes:
          </p>
          <ul>
            <li><strong>Essential cookies:</strong> Required for the website to function properly</li>
            <li><strong>Performance cookies:</strong> Help us understand how visitors use our website</li>
            <li><strong>Functionality cookies:</strong> Remember your preferences and settings</li>
            <li><strong>Analytics cookies:</strong> Provide insights to improve our services</li>
          </ul>

          <h2 id="types-of-cookies">3. Types of Cookies We Use</h2>
          
          <h3 id="essential-cookies">Essential Cookies</h3>
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left">Cookie Name</th>
                <th className="text-left">Purpose</th>
                <th className="text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>__session</td>
                <td>Authentication and security</td>
                <td>Session</td>
              </tr>
              <tr>
                <td>__csrf</td>
                <td>Cross-site request forgery protection</td>
                <td>Session</td>
              </tr>
              <tr>
                <td>sidebar-state</td>
                <td>Remember sidebar preferences</td>
                <td>1 year</td>
              </tr>
            </tbody>
          </table>

          <h3 id="analytics-cookies">Analytics Cookies</h3>
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left">Cookie Name</th>
                <th className="text-left">Provider</th>
                <th className="text-left">Purpose</th>
                <th className="text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>_ga</td>
                <td>Google Analytics</td>
                <td>Distinguish unique users</td>
                <td>2 years</td>
              </tr>
              <tr>
                <td>_gid</td>
                <td>Google Analytics</td>
                <td>Distinguish unique users</td>
                <td>24 hours</td>
              </tr>
              <tr>
                <td>_gat</td>
                <td>Google Analytics</td>
                <td>Throttle request rate</td>
                <td>1 minute</td>
              </tr>
            </tbody>
          </table>

          <h3 id="functionality-cookies">Functionality Cookies</h3>
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left">Cookie Name</th>
                <th className="text-left">Purpose</th>
                <th className="text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>theme</td>
                <td>Remember theme preference</td>
                <td>1 year</td>
              </tr>
              <tr>
                <td>locale</td>
                <td>Remember language preference</td>
                <td>1 year</td>
              </tr>
            </tbody>
          </table>

          <h2 id="third-party">4. Third-Party Cookies</h2>
          <p>
            Some cookies are placed by third-party services that appear on our pages. We do not control these cookies. Third-party providers include:
          </p>
          <ul>
            <li>Google Analytics (analytics)</li>
            <li>Intercom (customer support)</li>
            <li>Stripe (payment processing)</li>
          </ul>

          <h2 id="managing-cookies">5. Managing Cookies</h2>
          <p>
            You can control and manage cookies in various ways:
          </p>
          
          <h3>Browser Settings</h3>
          <p>
            Most browsers allow you to:
          </p>
          <ul>
            <li>See what cookies you have and delete them individually</li>
            <li>Block third-party cookies</li>
            <li>Block all cookies from specific sites</li>
            <li>Block all cookies from being set</li>
            <li>Delete all cookies when you close your browser</li>
          </ul>

          <h3>Cookie Management Links</h3>
          <ul>
            <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener">Chrome</a></li>
            <li><a href="https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences" target="_blank" rel="noopener">Firefox</a></li>
            <li><a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener">Safari</a></li>
            <li><a href="https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noopener">Edge</a></li>
          </ul>

          <h2 id="impact">6. Impact of Disabling Cookies</h2>
          <p>
            If you disable cookies:
          </p>
          <ul>
            <li>You may not be able to sign in to your account</li>
            <li>Some features may not function properly</li>
            <li>Your preferences may not be remembered</li>
            <li>You may see less relevant content</li>
          </ul>

          <h2 id="updates">7. Updates to This Policy</h2>
          <p>
            We may update this Cookie Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.
          </p>

          <h2 id="contact-cookies">8. Contact Us</h2>
          <p>
            If you have questions about our use of cookies, please contact us at:
          </p>
          <ul>
            <li>Email: privacy@truthsource.io</li>
            <li>Address: 123 Market Street, Suite 100, San Francisco, CA 94105</li>
          </ul>

          <h2 id="consent">9. Cookie Consent</h2>
          <p>
            By using our website, you consent to our use of cookies as described in this policy. You can withdraw your consent at any time by adjusting your browser settings or contacting us.
          </p>
        </div>
      </LegalLayout>
    </PageWrapper>
  )
}