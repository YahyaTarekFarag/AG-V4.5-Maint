-- V10__fix_technician_attendance_rls_and_categories.sql
-- ==========================================
-- المرحلة السادسة: معالجة أخطاء ما بعد التحديث الدقيقة
-- ==========================================

-- 1. إصلاح سياسات أمان صفوف الحضور للفنيين (RLS)
-- لم يكن هناك سياسات INSERT أو UPDATE لجدول الحضور، مما أدى لمنع الفنيين من تسجيل حضورهم.

DO $$
BEGIN
  -- للسماح للفنيين بتسجيل حضورهم (INSERT)
  CREATE POLICY "Technicians can insert own attendance" ON public.technician_attendance
      FOR INSERT WITH CHECK (auth.uid() = profile_id);

  -- للسماح للفنيين بإنهاء مناوبتهم (UPDATE)
  CREATE POLICY "Technicians can update own attendance" ON public.technician_attendance
      FOR UPDATE USING (auth.uid() = profile_id);

  -- السماح للمديرين بتعديل الإدخالات أو إضافتها في الحالات الاستثنائية
  CREATE POLICY "Managers can insert attendance" ON public.technician_attendance
      FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'maint_manager'))
      );

  CREATE POLICY "Managers can update attendance" ON public.technician_attendance
      FOR UPDATE USING (
          EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'maint_manager'))
      );
      
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


-- 2. إعادة تهيئة السجل الفني (تصنيفات الصيانة والمعدات)
-- جدول maintenance_categories كان فارغاً مما أدى لتعطل القوائم المنسدلة في شاشة فتح البلاغات.

INSERT INTO public.maintenance_categories (name) VALUES 
('تبريد وتكييف'), 
('كهرباء'), 
('ميكانيكا'), 
('سباكة'), 
('معدات مطبخ'), 
('أعمال مدنية'), 
('أنظمة سلامة'),
('أخرى')
ON CONFLICT (name) DO NOTHING;
