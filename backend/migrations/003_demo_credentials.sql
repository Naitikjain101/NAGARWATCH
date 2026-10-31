-- ==============================================================================
-- NAGARWATCH: Supabase Demo Credentials & Seed Data Migration (v4 - Schema Fixed)
-- File: backend/migrations/003_demo_credentials.sql
-- 
-- Credentials:
-- 1. Citizen Demo:       citizen@nagarwatch.org     / NagarWatch@2026
-- 2. Ward Admin Demo:    admin@nagarwatch.org       / NagarWatch@2026 (Ward 1)
-- 3. Super Admin Demo:   superadmin@nagarwatch.org  / NagarWatch@2026
-- ==============================================================================

SET search_path = public, auth, extensions;

-- 1. Ensure required cryptographic extension exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Refine prevent_role_escalation function to safely allow SQL Editor execution
-- (auth.uid() IS NULL when running directly in the Supabase SQL editor)
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
            RAISE EXCEPTION 'Unauthorized: Only super administrators can modify user roles.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 3. Ensure default demo wards exist (with valid polygons)
INSERT INTO public.wards (id, name, code, city, zone, geom)
OVERRIDING SYSTEM VALUE
VALUES 
    (1, 'Ward 1 - Central Zone', 'W01', 'NagarWatch Metro', 'Central', ST_GeomFromText('POLYGON((76.51 9.58, 76.53 9.58, 76.53 9.60, 76.51 9.60, 76.51 9.58))', 4326)),
    (2, 'Ward 2 - East Zone', 'W02', 'NagarWatch Metro', 'East', ST_GeomFromText('POLYGON((76.53 9.58, 76.55 9.58, 76.55 9.60, 76.53 9.60, 76.53 9.58))', 4326)),
    (3, 'Ward 3 - West Zone', 'W03', 'NagarWatch Metro', 'West', ST_GeomFromText('POLYGON((76.49 9.58, 76.51 9.58, 76.51 9.60, 76.49 9.60, 76.49 9.58))', 4326))
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    city = EXCLUDED.city,
    zone = EXCLUDED.zone,
    geom = EXCLUDED.geom;

-- Advance sequence safely
SELECT setval('public.wards_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.wards), 3));

-- 4. Clean up any existing broken demo records in identities & users
DELETE FROM auth.identities WHERE user_id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
);
DELETE FROM auth.users WHERE email IN (
    'citizen@nagarwatch.org',
    'admin@nagarwatch.org',
    'superadmin@nagarwatch.org'
);

-- 5. Insert Demo Users into auth.users (password: NagarWatch@2026)
-- Crucial: GoTrue requires empty string '' (not NULL) for token columns to prevent
-- "Database error querying schema" Go struct scan panic.
INSERT INTO auth.users (
    id,
    instance_id,
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
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'citizen@nagarwatch.org',
        crypt('NagarWatch@2026', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Aarav Sharma (Demo Citizen)","role":"citizen","phone":"+919876543210"}'::jsonb,
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'admin@nagarwatch.org',
        crypt('NagarWatch@2026', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Rajesh Verma (Ward Admin)","role":"admin","phone":"+919876543211"}'::jsonb,
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'superadmin@nagarwatch.org',
        crypt('NagarWatch@2026', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Dr. Priya Nair (Super Administrator)","role":"super_admin","phone":"+919876543212"}'::jsonb,
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    );

-- 6. Dynamically ensure any optional token/boolean columns in auth.users are non-null
DO $$
DECLARE
    col text;
    null_token_cols text[] := ARRAY[
        'confirmation_token',
        'recovery_token',
        'email_change_token_new',
        'email_change',
        'email_change_token_current',
        'phone_change',
        'phone_change_token',
        'reauthentication_token'
    ];
BEGIN
    FOR col IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'auth' 
          AND table_name = 'users' 
          AND column_name = ANY(null_token_cols)
    LOOP
        EXECUTE format('UPDATE auth.users SET %I = '''' WHERE %I IS NULL AND email IN (''citizen@nagarwatch.org'', ''admin@nagarwatch.org'', ''superadmin@nagarwatch.org'')', col, col);
    END LOOP;
END $$;

-- 7. Insert into auth.identities (Mandatory for GoTrue password sign-in)
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111',
        format('{"sub":"%s","email":"%s","email_verified":true,"phone_verified":false}', '11111111-1111-1111-1111-111111111111', 'citizen@nagarwatch.org')::jsonb,
        'email',
        '11111111-1111-1111-1111-111111111111',
        NOW(),
        NOW(),
        NOW()
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222222',
        format('{"sub":"%s","email":"%s","email_verified":true,"phone_verified":false}', '22222222-2222-2222-2222-222222222222', 'admin@nagarwatch.org')::jsonb,
        'email',
        '22222222-2222-2222-2222-222222222222',
        NOW(),
        NOW(),
        NOW()
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        '33333333-3333-3333-3333-333333333333',
        format('{"sub":"%s","email":"%s","email_verified":true,"phone_verified":false}', '33333333-3333-3333-3333-333333333333', 'superadmin@nagarwatch.org')::jsonb,
        'email',
        '33333333-3333-3333-3333-333333333333',
        NOW(),
        NOW(),
        NOW()
    );

-- 8. Temporarily disable role escalation trigger during profile provisioning
ALTER TABLE public.profiles DISABLE TRIGGER trg_prevent_role_escalation;

-- 9. Ensure Profiles table has authoritative roles and metadata
INSERT INTO public.profiles (
    id,
    role,
    full_name,
    email,
    phone_number,
    is_verified,
    reputation_score,
    primary_ward_id,
    created_at
)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'citizen',
        'Aarav Sharma (Demo Citizen)',
        'citizen@nagarwatch.org',
        '+919876543210',
        TRUE,
        25,
        1,
        NOW()
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'admin',
        'Rajesh Verma (Ward Admin)',
        'admin@nagarwatch.org',
        '+919876543211',
        TRUE,
        100,
        1,
        NOW()
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'super_admin',
        'Dr. Priya Nair (Super Administrator)',
        'superadmin@nagarwatch.org',
        '+919876543212',
        TRUE,
        500,
        1,
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone_number = EXCLUDED.phone_number,
    is_verified = TRUE,
    reputation_score = EXCLUDED.reputation_score,
    primary_ward_id = EXCLUDED.primary_ward_id;

-- 10. Re-enable role escalation trigger immediately
ALTER TABLE public.profiles ENABLE TRIGGER trg_prevent_role_escalation;

-- 11. Assign Ward Admin to Ward 1
INSERT INTO public.admin_wards (user_id, ward_id, assigned_by, created_at)
VALUES
    ('22222222-2222-2222-2222-222222222222', 1, '33333333-3333-3333-3333-333333333333', NOW())
ON CONFLICT (user_id, ward_id) DO NOTHING;

-- 12. Insert Sample Incidents in Ward 1 for Triage & Tracking
-- NOTE: latitude & longitude are GENERATED ALWAYS AS ... STORED from geom, so omitted here
INSERT INTO public.incidents (
    id,
    user_id,
    ward_id,
    category,
    title,
    description,
    severity,
    status,
    geom,
    confirmations_count,
    disputes_count,
    created_at,
    updated_at
)
VALUES
    (
        '44444444-4444-4444-4444-444444444401',
        '11111111-1111-1111-1111-111111111111',
        1,
        'Pothole',
        'Severe pothole causing vehicle damage',
        'Dangerous 2-foot pothole near Main Market junction. Two two-wheelers skidded this morning.',
        'high',
        'reported',
        ST_SetSRID(ST_MakePoint(76.521500, 9.591500), 4326),
        4,
        0,
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days'
    ),
    (
        '44444444-4444-4444-4444-444444444402',
        '11111111-1111-1111-1111-111111111111',
        1,
        'Streetlight',
        'Dark corridor near Community Park',
        'Pole #18 fixture completely non-functional for 4 days, causing safety concerns for evening pedestrians.',
        'medium',
        'in_progress',
        ST_SetSRID(ST_MakePoint(76.523800, 9.593200), 4326),
        7,
        0,
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '1 day'
    ),
    (
        '44444444-4444-4444-4444-444444444403',
        '11111111-1111-1111-1111-111111111111',
        1,
        'Garbage',
        'Cleared commercial waste dumping point',
        'Accumulated vegetable market refuse causing foul odour near bus stand.',
        'low',
        'resolved',
        ST_SetSRID(ST_MakePoint(76.525200, 9.595100), 4326),
        11,
        0,
        NOW() - INTERVAL '7 days',
        NOW() - INTERVAL '2 days'
    )
ON CONFLICT (id) DO NOTHING;

-- 13. Add Audit Updates for in_progress and resolved incidents
INSERT INTO public.incident_updates (incident_id, old_status, new_status, notes, created_at)
VALUES
    ('44444444-4444-4444-4444-444444444402', 'reported', 'verified', 'Verified on-site by Ward Inspector Rajesh Verma. Component replacement requisitioned.', NOW() - INTERVAL '3 days'),
    ('44444444-4444-4444-4444-444444444402', 'verified', 'in_progress', 'Electrical maintenance team dispatched with replacement LED sodium ballast.', NOW() - INTERVAL '1 day'),
    ('44444444-4444-4444-4444-444444444403', 'reported', 'verified', 'Verified by Sanitation Inspector.', NOW() - INTERVAL '6 days'),
    ('44444444-4444-4444-4444-444444444403', 'verified', 'resolved', 'Municipal sanitation team cleared entire perimeter and placed covered mobile compactor.', NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- 14. Add notifications for Demo Citizen
INSERT INTO public.notifications (user_id, incident_id, title, body, type, is_read, created_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444402', 'Maintenance Crew Dispatched', 'Your reported Streetlight has been assigned to Ward Works Crew #3.', 'status_update', FALSE, NOW() - INTERVAL '1 day'),
    ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444403', 'Incident Resolved', 'Your reported Garbage issue has been cleaned by Municipal Sanitation.', 'status_update', TRUE, NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- 15. Verification Output
SELECT 
    p.email,
    p.role,
    p.full_name,
    w.name AS assigned_ward
FROM public.profiles p
LEFT JOIN public.admin_wards aw ON p.id = aw.user_id
LEFT JOIN public.wards w ON aw.ward_id = w.id
WHERE p.email IN ('citizen@nagarwatch.org', 'admin@nagarwatch.org', 'superadmin@nagarwatch.org');
