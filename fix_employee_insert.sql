-- ==========================================
-- FSC-MAINT-APP Create Employee Admin RPC
-- ⚠️ Run this file to add the create_employee_user function and update ui_schemas for profiles
-- ==========================================

-- 1. Create a secure function to insert users into auth.users directly
-- This bypasses the need for the user to sign up via email and allows Admin to create users
CREATE OR REPLACE FUNCTION public.create_employee_user(
    p_employee_code text,
    p_full_name text,
    p_role text,
    p_password text
) RETURNS void AS $$
DECLARE
    new_user_id uuid;
    encrypted_pw text;
BEGIN
    new_user_id := gen_random_uuid();
    encrypted_pw := crypt(p_password, gen_salt('bf'));
    
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id, 'authenticated', 'authenticated',
        p_employee_code || '@fsc-system.local',
        encrypted_pw,
        now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('employee_code', p_employee_code, 'full_name', p_full_name, 'role', p_role),
        now(), now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update the ui_schemas for profiles to include password field
UPDATE public.ui_schemas
SET form_config = '{
  "title": "إضافة / تعديل موظف",
  "fields": [
    { "key": "full_name", "label": "الاسم الرباعي", "type": "text", "required": true },
    { "key": "employee_code", "label": "كود الدخول التعريفي", "type": "text", "required": true },
    { "key": "password", "label": "كلمة المرور", "type": "text", "required": true, "placeholder": "أدخل كلمة مرور قوية" },
    { "key": "role", "label": "صلاحية النظام", "type": "select", "required": true, "options": [
      { "label": "مدير نظام مركزي", "value": "admin" },
      { "label": "مدير فرع", "value": "manager" },
      { "label": "فني صيانة", "value": "technician" }
    ]}
  ]
}'::jsonb
WHERE table_name = 'profiles';
