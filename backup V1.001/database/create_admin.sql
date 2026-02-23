-- إنشاء مستخدم مسؤول (Admin) جديد في جدول Auth
-- employee_code: 123
-- password: 123
-- email alias: 123@fsc-system.local

-- 1. إضافة المستخدم في جدول auth.users
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), -- ID جديد للمستخدم
    'authenticated',
    'authenticated',
    '123@fsc-system.local',
    crypt('123', gen_salt('bf')), -- تشفير الباسورد باستخدام bcrypt
    now(),
    NULL,
    NULL,
    '{"provider":"email","providers":["email"]}',
    '{"employee_code":"123","full_name":"مدير النظام المركزي","role":"admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
);

-- لا حاجة لإضافة بيانات في جدول profiles يدوياً
-- لأن التريجر (on_auth_user_created) الذي أنشأناه في Schema
-- سيقوم تلقائياً بالتقاط البيانات من raw_user_meta_data 
-- وإضافتها لجدول profiles فور تنفيذ هذا الكود.
