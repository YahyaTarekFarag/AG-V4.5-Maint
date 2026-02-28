-- V29__asset_name_sync_trigger.sql
-- ==========================================
-- مزامنة اسم المعدة تلقائياً في جدول البلاغات
-- ==========================================

CREATE OR REPLACE FUNCTION public.sync_ticket_asset_name()
RETURNS TRIGGER AS $$
BEGIN
    -- تحديث اسم المعدة من جدول الأصول عند ربط المعدة بالبلاغ
    IF NEW.asset_id IS NOT NULL THEN
        SELECT name INTO NEW.asset_name 
        FROM public.maintenance_assets 
        WHERE id = NEW.asset_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_ticket_asset_change_sync_name ON public.tickets;
CREATE TRIGGER on_ticket_asset_change_sync_name
BEFORE INSERT OR UPDATE OF asset_id ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.sync_ticket_asset_name();

-- تحديث البيانات التاريخية لضمان النظافة
UPDATE public.tickets t
SET asset_name = ma.name
FROM public.maintenance_assets ma
WHERE t.asset_id = ma.id
AND t.asset_name IS DISTINCT FROM ma.name;
