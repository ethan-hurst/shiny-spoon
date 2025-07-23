-- Create article feedback table
CREATE TABLE IF NOT EXISTS article_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id TEXT NOT NULL,
  helpful BOOLEAN NOT NULL,
  feedback TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for querying by article
CREATE INDEX idx_article_feedback_article_id ON article_feedback(article_id);

-- Create index for querying by user
CREATE INDEX idx_article_feedback_user_id ON article_feedback(user_id);

-- Enable RLS
ALTER TABLE article_feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (even anonymous users)
CREATE POLICY "Anyone can insert article feedback" ON article_feedback
  FOR INSERT
  WITH CHECK (true);

-- Allow users to view their own feedback
CREATE POLICY "Users can view own feedback" ON article_feedback
  FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Allow admins to view all feedback
CREATE POLICY "Admins can view all feedback" ON article_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );