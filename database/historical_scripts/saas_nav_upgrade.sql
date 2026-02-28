-- ==========================================
-- SaaS & Dynamic Navigation Patch
-- Purpose: Enable dynamic sidebar registration for the Sovereign Engine.
-- ==========================================

-- 1. Upgrade ui_schemas to support full navigation metadata
ALTER TABLE public.ui_schemas ADD COLUMN IF NOT EXISTS page_config jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.ui_schemas ADD COLUMN IF NOT EXISTS nav_config jsonb DEFAULT '{
    "is_visible": true,
    "icon": "Layout",
    "roles": ["admin"]
}'::jsonb;

-- 2. Grant necessary permissions
GRANT SELECT, UPDATE, INSERT ON public.ui_schemas TO authenticated;

-- 3. Initial sync: Ensure core tables have navigation config if missing
UPDATE public.ui_schemas 
SET nav_config = jsonb_build_object(
    'is_visible', true,
    'icon', CASE 
        WHEN table_name = 'tickets' THEN 'Ticket'
        WHEN table_name = 'profiles' THEN 'Users'
        WHEN table_name = 'branches' THEN 'Store'
        WHEN table_name = 'inventory' THEN 'Package'
        WHEN table_name = 'maintenance_assets' THEN 'Box'
        ELSE 'Layout'
    END,
    'roles', ARRAY['admin', 'maint_manager', 'brand_ops_manager']
)
WHERE nav_config = '{}'::jsonb OR nav_config IS NULL;

-- 4. Notify completion
COMMENT ON COLUMN public.ui_schemas.nav_config IS 'Stores sidebar metadata: is_visible, icon, roles, etc.';
