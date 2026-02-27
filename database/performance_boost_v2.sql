-- ==========================================
-- تحسينات الأداء الفائقة (Performance Boost V2)
-- زيادة سرعة الاستجابة للروابط العميقة والفلترة المعقدة
-- ==========================================

-- تفعيل الامتدادات اللازمة للبحث النصي السريع
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. فهارس مركبة لتسريع الفلترة السيادية (RBAC Coverage)
-- تسرع الاستعلامات التي تطلب بيانات بناءً على البراند، القطاع، والمنطقة معاً
CREATE INDEX IF NOT EXISTS idx_profiles_hierarchy ON public.profiles(brand_id, sector_id, area_id, branch_id);

-- 2. تحسين البحث في البلاغات (Tickets Deep Filter)
-- الفهرس المركب التالي يسرع عمليات الفلترة الشائعة في لوحة التحكم
CREATE INDEX IF NOT EXISTS idx_tickets_composite_status_branch ON public.tickets(branch_id, status, created_at DESC);

-- 3. تسريع روابط الفروع والمناطق (Join Optimization)
CREATE INDEX IF NOT EXISTS idx_branches_area_id ON public.branches(area_id);
CREATE INDEX IF NOT EXISTS idx_areas_sector_id ON public.areas(sector_id);
CREATE INDEX IF NOT EXISTS idx_sectors_brand_id ON public.sectors(brand_id);

-- 4. فهرس نصي لتسريع البحث في الأصول (Full-Text Search Support)
-- يدعم البحث السريع في أسماء الأصول وأكواد الـ QR
CREATE INDEX IF NOT EXISTS idx_assets_name_trgm ON public.maintenance_assets USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tickets_desc_trgm ON public.tickets USING gin (description gin_trgm_ops);

-- 5. تحديث الإحصائيات لضمان اختيار Query Planner لأفضل مسار
ANALYZE public.profiles;
ANALYZE public.tickets;
ANALYZE public.branches;
ANALYZE public.inventory;

-- 6. تحسين دالة جلب المقاييس (Metric Aggregator RPC)
-- هذه الدالة ستستخدم لدمج طلبات الـ Count في طلب واحد مستقبلاً
CREATE OR REPLACE FUNCTION public.get_table_metrics(p_table_name text, p_where_clauses text[])
RETURNS jsonb AS $$
DECLARE
    v_results jsonb := '{}'::jsonb;
    v_clause text;
    v_count bigint;
BEGIN
    FOREACH v_clause IN ARRAY p_where_clauses
    LOOP
        EXECUTE format('SELECT count(*) FROM %I WHERE %s', p_table_name, v_clause) INTO v_count;
        v_results := v_results || jsonb_build_object(v_clause, v_count);
    END LOOP;
    RETURN v_results;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
