-- ==========================================
-- FSC-MAINT-APP Storage & Final UI Sync Fix
-- ==========================================

-- 1. Create Media Bucket for Photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies (Allow anyone to view, authenticated to upload)
-- Drop existing to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;

CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'media' );

CREATE POLICY "Authenticated Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'media' AND auth.role() = 'authenticated' );

-- 3. Ensure profiles table doesn't have password column (Cleanup if needed)
-- (Supabase Auth handles passwords in auth.users, public.profiles should NOT have it)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='password') THEN
        ALTER TABLE public.profiles DROP COLUMN password;
    END IF;
END $$;

-- 4. Sync Maintenance Schema Metadata
UPDATE public.ui_schemas 
SET form_config = '{
    "title": "تفاصيل بلاغ الصيانة",
    "fields": [
      { "key": "branch_id", "label": "الفرع", "type": "select", "required": true, "dataSource": "branches" },
      { "key": "asset_name", "label": "المعدة المعطلة", "type": "text", "required": true },
      { "key": "description", "label": "وصف العطل", "type": "textarea", "required": true },
      { "key": "reported_image_url", "label": "صورة العطل (قبل)", "type": "image" }
    ]
  }'::jsonb
WHERE table_name = 'tickets';
