-- Create email_queue table for managing email sending
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_email_queue_status ON public.email_queue(status);
CREATE INDEX idx_email_queue_created_at ON public.email_queue(created_at);
CREATE INDEX idx_email_queue_processing ON public.email_queue(status, attempts) 
  WHERE status IN ('pending', 'processing') AND attempts < max_attempts;

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Only authenticated admin users can view email queue
CREATE POLICY "Admins can view email queue" ON public.email_queue
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('admin', 'owner')
    )
  );

-- Only authenticated admin users can update email queue
CREATE POLICY "Admins can update email queue" ON public.email_queue
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('admin', 'owner')
    )
  );

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role has full access" ON public.email_queue
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_email_queue_updated_at BEFORE UPDATE ON public.email_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();