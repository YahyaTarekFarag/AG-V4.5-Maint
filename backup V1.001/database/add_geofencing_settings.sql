-- Add dynamic geofencing settings if they don't exist
INSERT INTO public.system_settings (key, value)
VALUES 
    ('geofencing_enabled', 'true'),
    ('geofencing_radius', '100')
ON CONFLICT (key) DO NOTHING;
