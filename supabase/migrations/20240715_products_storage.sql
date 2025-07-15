-- Create products storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for products bucket
CREATE POLICY "Users can upload product images for their organization" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'products' AND
  auth.uid() IN (
    SELECT user_id FROM user_profiles
    WHERE organization_id = SPLIT_PART(name, '/', 1)::uuid
  )
);

CREATE POLICY "Users can update product images for their organization" ON storage.objects
FOR UPDATE WITH CHECK (
  bucket_id = 'products' AND
  auth.uid() IN (
    SELECT user_id FROM user_profiles
    WHERE organization_id = SPLIT_PART(name, '/', 1)::uuid
  )
);

CREATE POLICY "Users can delete product images for their organization" ON storage.objects
FOR DELETE USING (
  bucket_id = 'products' AND
  auth.uid() IN (
    SELECT user_id FROM user_profiles
    WHERE organization_id = SPLIT_PART(name, '/', 1)::uuid
  )
);

CREATE POLICY "Public can view product images" ON storage.objects
FOR SELECT USING (bucket_id = 'products');