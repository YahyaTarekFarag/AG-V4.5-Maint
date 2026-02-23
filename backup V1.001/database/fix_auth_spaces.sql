-- ==========================================
-- FSC-MAINT-APP Fix Employee Auth Accounts
-- ⚠️ Run this file to fix the email format for already created accounts
-- and update the RPC to use trim() on employee code
-- ==========================================

-- 1. Update the RPC function to ensure employee_code is trimmed when creating the email
-- This prevents issues where spaces in the Employee Code cause login failures
CREATE OR REPLACE FUNCTION public.create_employee_user(
    p_employee_code text,
    p_full_name text,
    p_role text,
    p_password text
) RETURNS void AS $$
DECLARE
    new_user_id uuid;
    encrypted_pw text;
    clean_code text;
BEGIN
    new_user_id := gen_random_uuid();
    encrypted_pw := crypt(p_password, gen_salt('bf'));
    clean_code := trim(p_employee_code); -- Ensure no leading/trailing spaces
    
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id, 'authenticated', 'authenticated',
        clean_code || '@fsc-system.local',
        encrypted_pw,
        now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('employee_code', clean_code, 'full_name', p_full_name, 'role', p_role),
        now(), now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up any existing records in auth.users that might have spaces
UPDATE auth.users
SET email = trim(split_part(email, '@', 1)) || '@fsc-system.local'
WHERE email LIKE '%@fsc-system.local%' AND email != trim(split_part(email, '@', 1)) || '@fsc-system.local';

-- 3. Also update any raw_user_meta_data that might have spaces in employee_code
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    raw_user_meta_data, 
    '{employee_code}', 
    to_jsonb(trim(raw_user_meta_data->>'employee_code'))
)
WHERE raw_user_meta_data->>'employee_code' != trim(raw_user_meta_data->>'employee_code');

-- 4. Sync profiles table with trimmed employee_code just in case
UPDATE public.profiles
SET employee_code = trim(employee_code)
WHERE employee_code != trim(employee_code);
