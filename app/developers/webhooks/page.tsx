import { type Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Webhook,
  Shield,
  Zap,
  AlertCircle,
  Code2,
  Package,
  CreditCard,
  ShoppingCart,
  Copy,
  Check,
} from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Webhooks',
  description: 'Real-time event notifications for inventory, pricing, and order changes in TruthSource.',
}

const webhookEvents = [
  {
    event: 'inventory.updated',
    category: 'Inventory',
    description: 'Triggered when inventory levels change for a product',
    icon: Package,
    payload: {
      event: 'inventory.updated',
      timestamp: '2024-01-15T10:30:00Z',
      data: {
        inventory_id: 'inv_abc123',
        product_id: 'prod_xyz789',
        warehouse_id: 'wh_123',
        previous_quantity: 150,
        current_quantity: 125,
        change_amount: -25,
        reason: 'sale',
        updated_by: 'system',
      },
    },
  },
  {
    event: 'price.changed',
    category: 'Pricing',
    description: 'Triggered when pricing rules affect product prices',
    icon: CreditCard,
    payload: {
      event: 'price.changed',
      timestamp: '2024-01-15T10:30:00Z',
      data: {
        product_id: 'prod_xyz789',
        price_change: {
          previous_price: 99.99,
          current_price: 89.99,
          currency: 'USD',
          change_percentage: -10.0,
        },
        affected_rules: ['rule_123', 'rule_456'],
        effective_date: '2024-01-15T00:00:00Z',
      },
    },
  },
  {
    event: 'order.created',
    category: 'Orders',
    description: 'Triggered when a new order is created',
    icon: ShoppingCart,
    payload: {
      event: 'order.created',
      timestamp: '2024-01-15T10:30:00Z',
      data: {
        order_id: 'ord_def456',
        customer_id: 'cust_789',
        total_amount: 1299.99,
        currency: 'USD',
        items_count: 5,
        status: 'pending',
        created_at: '2024-01-15T10:29:55Z',
      },
    },
  },
  {
    event: 'product.updated',
    category: 'Products',
    description: 'Triggered when product information is modified',
    icon: Package,
    payload: {
      event: 'product.updated',
      timestamp: '2024-01-15T10:30:00Z',
      data: {
        product_id: 'prod_xyz789',
        changes: {
          name: {
            previous: 'Industrial Widget',
            current: 'Industrial Widget Pro',
          },
          sku: {
            previous: 'IW-001',
            current: 'IW-001-PRO',
          },
        },
        updated_fields: ['name', 'sku'],
        updated_by: 'user_123',
      },
    },
  },
]

const verificationExample = {
  nodejs: `import crypto from 'crypto';

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express.js middleware
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-truthsource-signature'];
  const isValid = verifyWebhookSignature(
    req.body,
    signature,
    process.env.WEBHOOK_SECRET
  );
  
  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(req.body);
  console.log('Received event:', event.event);
  
  // Process the event
  switch (event.event) {
    case 'inventory.updated':
      handleInventoryUpdate(event.data);
      break;
    // ... handle other events
  }
  
  res.status(200).send('OK');
});`,
  python: `import hmac
import hashlib
from flask import Flask, request, abort

app = Flask(__name__)

def verify_webhook_signature(payload, signature, secret):
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-TruthSource-Signature')
    
    if not verify_webhook_signature(
        request.data,
        signature,
        os.environ['WEBHOOK_SECRET']
    ):
        abort(401)
    
    event = request.json
    print(f"Received event: {event['event']}")
    
    # Process the event
    if event['event'] == 'inventory.updated':
        handle_inventory_update(event['data'])
    # ... handle other events
    
    return 'OK', 200`,
  php: `<?php
function verifyWebhookSignature($payload, $signature, $secret) {
    $expectedSignature = hash_hmac('sha256', $payload, $secret);
    return hash_equals($signature, $expectedSignature);
}

// Handle webhook endpoint
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_TRUTHSOURCE_SIGNATURE'] ?? '';

if (!verifyWebhookSignature($payload, $signature, $_ENV['WEBHOOK_SECRET'])) {
    http_response_code(401);
    die('Invalid signature');
}

$event = json_decode($payload, true);
error_log('Received event: ' . $event['event']);

// Process the event
switch ($event['event']) {
    case 'inventory.updated':
        handleInventoryUpdate($event['data']);
        break;
    // ... handle other events
}

http_response_code(200);
echo 'OK';`,
}

export default function WebhooksPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Webhook className="h-8 w-8" />
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Receive real-time notifications when events occur in TruthSource. Build reactive
          integrations that respond instantly to inventory changes, price updates, and more.
        </p>
      </div>

      {/* Security Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Security First</AlertTitle>
        <AlertDescription>
          All webhook payloads are signed with HMAC-SHA256. Always verify the signature
          before processing webhook events to ensure they're from TruthSource.
        </AlertDescription>
      </Alert>

      {/* How Webhooks Work */}
      <Card>
        <CardHeader>
          <CardTitle>How Webhooks Work</CardTitle>
          <CardDescription>
            Webhooks provide real-time event notifications to your application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                1
              </div>
              <h4 className="font-semibold">Event Occurs</h4>
              <p className="text-sm text-muted-foreground">
                An action happens in TruthSource (e.g., inventory level changes)
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                2
              </div>
              <h4 className="font-semibold">Webhook Triggered</h4>
              <p className="text-sm text-muted-foreground">
                TruthSource sends a POST request to your configured endpoint
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                3
              </div>
              <h4 className="font-semibold">Your App Responds</h4>
              <p className="text-sm text-muted-foreground">
                Process the event and update your system accordingly
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Events */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Available Events</h2>
        
        <div className="grid gap-4 md:grid-cols-2">
          {webhookEvents.map((event) => {
            const Icon = event.icon
            return (
              <Card key={event.event}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-base font-mono">
                          {event.event}
                        </CardTitle>
                        <CardDescription>{event.description}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline">{event.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-primary hover:underline">
                      View payload example
                    </summary>
                    <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-4">
                      <code className="text-xs">
                        {JSON.stringify(event.payload, null, 2)}
                      </code>
                    </pre>
                  </details>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Webhook Security */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Webhook Security</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Signature Verification</CardTitle>
            <CardDescription>
              Every webhook request includes a signature in the X-TruthSource-Signature header
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="nodejs" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="nodejs">Node.js</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="php">PHP</TabsTrigger>
              </TabsList>
              
              {Object.entries(verificationExample).map(([lang, code]) => (
                <TabsContent key={lang} value={lang}>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4">
                    <code className="text-sm">{code}</code>
                  </pre>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Webhook Configuration */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Configuration</h2>
        
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Setting Up Webhooks</CardTitle>
              <CardDescription>
                Configure webhooks through the API or dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Via API</h4>
                <pre className="overflow-x-auto rounded-lg bg-muted p-4">
                  <code className="text-sm">{`POST /v1/webhooks
{
  "url": "https://your-app.com/webhook",
  "events": [
    "inventory.updated",
    "price.changed"
  ]
}`}</code>
                </pre>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Via Dashboard</h4>
                <p className="text-sm text-muted-foreground">
                  Navigate to Settings → Webhooks in your TruthSource dashboard to
                  configure webhooks with a user-friendly interface.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Best Practices</CardTitle>
              <CardDescription>
                Follow these guidelines for reliable webhook processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                  <span>Always verify webhook signatures</span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                  <span>Respond quickly with 2xx status code</span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                  <span>Process events asynchronously when possible</span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                  <span>Implement idempotent event handling</span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                  <span>Set up retry logic for failed processing</span>
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                  <span>Monitor webhook endpoint availability</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Retry Policy */}
      <Card>
        <CardHeader>
          <CardTitle>Retry Policy</CardTitle>
          <CardDescription>
            How TruthSource handles failed webhook deliveries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium mb-2">Retry Schedule</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• 1st retry: 1 minute after initial failure</li>
              <li>• 2nd retry: 5 minutes after 1st retry</li>
              <li>• 3rd retry: 30 minutes after 2nd retry</li>
              <li>• 4th retry: 2 hours after 3rd retry</li>
              <li>• 5th retry: 12 hours after 4th retry</li>
            </ul>
          </div>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              After 5 failed attempts, the webhook will be automatically disabled.
              You'll receive an email notification and can re-enable it from the dashboard.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Testing Webhooks */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Testing Webhooks</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Webhook Testing Tools</CardTitle>
            <CardDescription>
              Tools and techniques for testing your webhook implementation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-semibold mb-2">Test Events</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Send test events from the dashboard to verify your endpoint
                  is working correctly.
                </p>
                <Button asChild>
                  <Link href="/developers/testing">
                    <Zap className="mr-2 h-4 w-4" />
                    Webhook Tester
                  </Link>
                </Button>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Local Development</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Use ngrok or similar tools to expose your local development
                  server for webhook testing.
                </p>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  ngrok http 3000
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Common Issues */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting Common Issues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm">Webhook not receiving events</h4>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                <li>• Verify your endpoint URL is publicly accessible</li>
                <li>• Check that you've subscribed to the correct events</li>
                <li>• Ensure your endpoint returns a 2xx status code</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm">Signature verification failing</h4>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                <li>• Confirm you're using the correct webhook secret</li>
                <li>• Ensure you're verifying against the raw request body</li>
                <li>• Check for encoding issues in your signature comparison</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm">Duplicate events</h4>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                <li>• Implement idempotency using the event ID</li>
                <li>• Store processed event IDs to prevent reprocessing</li>
                <li>• Handle retries gracefully</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}