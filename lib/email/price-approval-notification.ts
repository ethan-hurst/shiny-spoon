import { z } from 'zod'
import { PriceApprovalWithDetails } from '@/types/customer-pricing.types'
import { queueEmail } from '@/lib/email/email-queue'

interface ApprovalEmailParams {
  to: string
  approval: PriceApprovalWithDetails
  actionUrl: string
}

// HTML escape function to prevent XSS
function escapeHtml(text: string | undefined | null): string {
  if (!text) return ''
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  }
  
  return text.replace(/[&<>"'\/]/g, (char) => map[char] || char)
}

// Configuration for thresholds
const APPROVAL_THRESHOLDS = {
  DISCOUNT_HIGH: 20, // Discount percentage considered high
  MARGIN_LOW: 15,    // Margin percentage considered low
}

/**
 * Generates an HTML email body for a price approval request, including customer, product, pricing, discount, margin, reason, requester, and request date details.
 *
 * All dynamic content is HTML-escaped to prevent XSS. Visual emphasis is applied to discount and margin metrics based on defined thresholds. If the request date is invalid or cannot be parsed, "Date unavailable" is shown.
 *
 * @param approval - The price approval details to include in the email
 * @param actionUrl - The URL for the recipient to review and approve the request
 * @returns The complete HTML string for the approval email
 */
export function generateApprovalEmailHtml({
  approval,
  actionUrl,
}: Omit<ApprovalEmailParams, 'to'>): string {
  const discountClass = (approval.discount_percent || 0) > APPROVAL_THRESHOLDS.DISCOUNT_HIGH ? 'high' : 'normal'
  const marginClass = (approval.margin_percent || 0) < APPROVAL_THRESHOLDS.MARGIN_LOW ? 'low' : 'normal'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Price Approval Required</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2563eb;
      margin: 0;
      font-size: 24px;
    }
    .alert {
      background-color: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    .alert-text {
      color: #92400e;
      font-weight: 500;
      margin: 0;
    }
    .details {
      background-color: #f9fafb;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .detail-label {
      color: #6b7280;
      font-size: 14px;
    }
    .detail-value {
      font-weight: 600;
      color: #111827;
    }
    .price-comparison {
      display: flex;
      justify-content: space-around;
      margin: 20px 0;
      gap: 20px;
    }
    .price-box {
      flex: 1;
      text-align: center;
      padding: 16px;
      border-radius: 6px;
    }
    .price-box.current {
      background-color: #f3f4f6;
    }
    .price-box.requested {
      background-color: #dbeafe;
      border: 2px solid #3b82f6;
    }
    .price-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .price-value {
      font-size: 24px;
      font-weight: bold;
      color: #111827;
      margin: 8px 0;
    }
    .metrics {
      display: flex;
      gap: 16px;
      margin: 20px 0;
    }
    .metric {
      flex: 1;
      padding: 12px;
      border-radius: 6px;
      text-align: center;
    }
    .metric.normal {
      background-color: #d1fae5;
      color: #065f46;
    }
    .metric.high {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .metric.low {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .metric-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 20px;
      font-weight: bold;
      margin-top: 4px;
    }
    .reason {
      background-color: #f9fafb;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin: 20px 0;
    }
    .reason-label {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .reason-text {
      color: #111827;
      margin: 0;
    }
    .action-button {
      display: inline-block;
      background-color: #3b82f6;
      color: white;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .action-button:hover {
      background-color: #2563eb;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
      text-align: center;
    }
    .requested-by {
      font-size: 14px;
      color: #6b7280;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Price Approval Required</h1>
    </div>

    <div class="alert">
      <p class="alert-text">⚠️ A price change request requires your approval</p>
    </div>

    <div class="details">
      <div class="detail-row">
        <span class="detail-label">Customer</span>
        <span class="detail-value">${escapeHtml(approval.customers?.display_name || approval.customers?.company_name || 'Unknown Customer')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Product</span>
        <span class="detail-value">${escapeHtml(approval.products?.name || 'Unknown Product')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">SKU</span>
        <span class="detail-value">${escapeHtml(approval.products?.sku || 'N/A')}</span>
      </div>
    </div>

    <div class="price-comparison">
      <div class="price-box current">
        <div class="price-label">Current Price</div>
        <div class="price-value">$${(approval.current_price || 0).toFixed(2)}</div>
      </div>
      <div class="price-box requested">
        <div class="price-label">Requested Price</div>
        <div class="price-value">$${(approval.requested_price || 0).toFixed(2)}</div>
      </div>
    </div>

    <div class="metrics">
      <div class="metric ${discountClass}">
        <div class="metric-label">Discount</div>
        <div class="metric-value">${(approval.discount_percent || 0).toFixed(1)}%</div>
      </div>
      <div class="metric ${marginClass}">
        <div class="metric-label">Margin</div>
        <div class="metric-value">${(approval.margin_percent || 0).toFixed(1)}%</div>
      </div>
    </div>

    <div class="reason">
      <div class="reason-label">Reason for Change</div>
      <p class="reason-text">${escapeHtml(approval.change_reason)}</p>
    </div>

    <div class="requested-by">
      Requested by: <strong>${escapeHtml(approval.requested_by_user?.email || 'Unknown User')}</strong><br>
      ${(() => {
        try {
          const date = new Date(approval.requested_at)
          if (isNaN(date.getTime())) {
            console.error('Invalid date:', approval.requested_at)
            return 'Date unavailable'
          }
          return date.toLocaleString()
        } catch (error) {
          console.error('Date parsing error:', error)
          return 'Date unavailable'
        }
      })()}
    </div>

    <div style="text-align: center;">
      <a href="${actionUrl}" class="action-button">Review and Approve</a>
    </div>

    <div class="footer">
      <p>This is an automated notification from TruthSource. Please do not reply to this email.</p>
      <p>If you have questions, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Generates a plain text email body for a price approval request, including customer, product, pricing, discount, margin, reason, requester, date, and approval link.
 *
 * @returns The plain text content for the approval email.
 */
export function generateApprovalEmailText({
  approval,
  actionUrl,
}: Omit<ApprovalEmailParams, 'to'>): string {
  return `
Price Approval Required

A price change request requires your approval.

Customer: ${approval.customers?.display_name || approval.customers?.company_name || 'Unknown Customer'}
Product: ${approval.products?.name || 'Unknown Product'} (${approval.products?.sku || 'N/A'})

Current Price: $${(approval.current_price || 0).toFixed(2)}
Requested Price: $${(approval.requested_price || 0).toFixed(2)}

Discount: ${(approval.discount_percent || 0).toFixed(1)}%
Margin: ${(approval.margin_percent || 0).toFixed(1)}%

Reason for Change:
${approval.change_reason}

Requested by: ${approval.requested_by_user?.email || 'Unknown User'}
Date: ${(() => {
  try {
    const date = new Date(approval.requested_at)
    if (isNaN(date.getTime())) {
      return 'Date unavailable'
    }
    return date.toLocaleString()
  } catch {
    return 'Date unavailable'
  }
})()}

Review and approve this request:
${actionUrl}

This is an automated notification from TruthSource.
  `
}

/**
 * Sends a price approval request email to the specified recipient.
 *
 * Validates the recipient's email address, generates both HTML and plain text email content with approval details, and queues the email for sending. Throws an error if validation fails or if the email cannot be queued.
 *
 * @param to - The recipient's email address
 * @param approval - The approval request details to include in the email
 * @param actionUrl - The URL for the recipient to review and approve the request
 * @returns An object indicating success, recipient, and subject if the email is queued successfully
 * @throws If the email address is invalid or the email cannot be queued for sending
 */
export async function sendApprovalEmail({
  to,
  approval,
  actionUrl,
}: ApprovalEmailParams) {
  // Validate email address with zod
  const emailSchema = z.string().email()
  try {
    emailSchema.parse(to)
  } catch (error) {
    throw new Error('Invalid email address')
  }

  const htmlContent = generateApprovalEmailHtml({ approval, actionUrl })
  const textContent = generateApprovalEmailText({ approval, actionUrl })
  
  const subject = `Price Approval Required - ${escapeHtml(approval.customers?.company_name || 'Customer')}`
  
  try {
    // Queue the email for sending
    const result = await queueEmail({
      to,
      from: 'noreply@truthsource.ai',
      subject,
      html: htmlContent,
      text: textContent,
    })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to queue email')
    }
    
    return {
      success: true,
      message: 'Email queued for sending',
      to,
      subject,
    }
  } catch (error) {
    console.error('Error sending approval email:', error)
    throw new Error(`Failed to send approval email: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}