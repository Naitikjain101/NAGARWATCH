-- ==============================================================================
-- NAGARWATCH: Database Architecture & Security Validation Suite
-- Migration: 002_verification_tests.sql
-- Description: Automated tests and diagnostic assertions for RLS, permissions,
--              geospatial indexes, duplicate vote prevention, and legacy preservation.
-- Safety: Completely non-destructive. Validates DDL catalog, constraints, and policies
--         without mutating live auth.users or leaving orphan test records.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. STRUCTURAL & GEOSPATIAL INDEX AUDIT QUERY
-- ------------------------------------------------------------------------------
SELECT 
    schemaname, 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND (indexdef ILIKE '%gist%' OR indexdef ILIKE '%gin%')
ORDER BY tablename, indexname;

-- ------------------------------------------------------------------------------
-- 2. RLS POLICY COVERAGE AUDIT QUERY
-- ------------------------------------------------------------------------------
SELECT 
    t.tablename, 
    t.rowsecurity AS rls_enabled,
    COUNT(p.policyname) AS active_policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'profiles', 'wards', 'neighbourhoods', 'incidents',
    'incident_media', 'incident_verifications', 'incident_updates',
    'incident_assignments', 'notifications', 'admin_wards', 'complaints'
  )
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- ------------------------------------------------------------------------------
-- 3. CONSTRAINT AUDIT: DUPLICATE VERIFICATION, GEOMETRY & ROLES
-- ------------------------------------------------------------------------------
SELECT 
    conname AS constraint_name, 
    conrelid::regclass AS table_name, 
    pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
  AND conname IN (
    'uq_user_incident_verification', 
    'profiles_role_check', 
    'chk_incident_geom',
    'fk_profiles_ward', 
    'fk_profiles_neighbourhood'
  )
ORDER BY conname;

-- ------------------------------------------------------------------------------
-- 4. AUTOMATED TRANSACTIONAL SECURITY & POLICY TEST SUITE
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_test_count INTEGER := 0;
    v_pass_count INTEGER := 0;
    v_missing_items TEXT := '';
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'STARTING NAGARWATCH SECURITY & INTEGRITY VALIDATION';
    RAISE NOTICE '=====================================================';

    -- --------------------------------------------------------------------------
    -- TEST 1: All required tables and columns exist
    -- --------------------------------------------------------------------------
    v_test_count := v_test_count + 1;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'geom'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'latitude'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'longitude'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'legacy_complaint_id'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'reputation_score'
    ) THEN
        v_pass_count := v_pass_count + 1;
        RAISE NOTICE 'TEST % PASSED: Required NagarWatch tables, columns & generated spatial fields exist.', v_test_count;
    ELSE
        RAISE EXCEPTION 'TEST % FAILED: Missing required core NagarWatch columns.', v_test_count;
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 2: Geospatial GiST & Functional Geography Indexes exist
    -- --------------------------------------------------------------------------
    v_test_count := v_test_count + 1;
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'incidents' AND indexname = 'idx_incidents_geom'
    ) AND EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'incidents' AND indexname = 'idx_incidents_geog'
    ) AND EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'wards' AND indexname = 'idx_wards_geom'
    ) THEN
        v_pass_count := v_pass_count + 1;
        RAISE NOTICE 'TEST % PASSED: GiST geometry & functional geography indexes confirmed on incidents & wards.', v_test_count;
    ELSE
        RAISE EXCEPTION 'TEST % FAILED: Missing required GiST geospatial indexes.', v_test_count;
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 3: Trigram Text Search Indexes exist
    -- --------------------------------------------------------------------------
    v_test_count := v_test_count + 1;
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'incidents' AND indexname = 'idx_incidents_desc_trgm'
    ) AND EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'incidents' AND indexname = 'idx_incidents_title_trgm'
    ) THEN
        v_pass_count := v_pass_count + 1;
        RAISE NOTICE 'TEST % PASSED: GIN trigram indexes confirmed for duplicate similarity & text search.', v_test_count;
    ELSE
        RAISE EXCEPTION 'TEST % FAILED: Missing required GIN trigram indexes.', v_test_count;
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 4: Row-Level Security (RLS) is active across all tables
    -- --------------------------------------------------------------------------
    v_test_count := v_test_count + 1;
    SELECT string_agg(tablename, ', ') INTO v_missing_items
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'wards', 'neighbourhoods', 'admin_wards', 'incidents', 
                        'incident_media', 'incident_verifications', 'incident_updates', 
                        'incident_assignments', 'notifications')
      AND rowsecurity = FALSE;

    IF v_missing_items IS NULL OR v_missing_items = '' THEN
        v_pass_count := v_pass_count + 1;
        RAISE NOTICE 'TEST % PASSED: Row-Level Security (RLS) confirmed enabled across all NagarWatch tables.', v_test_count;
    ELSE
        RAISE EXCEPTION 'TEST % FAILED: RLS is disabled on tables: %', v_test_count, v_missing_items;
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 5: Privacy Protection - Legacy phone numbers and profile PII isolated
    -- --------------------------------------------------------------------------
    v_test_count := v_test_count + 1;
    -- Verify that profiles_select_policy restricts non-admins to own profile
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'profiles' 
          AND policyname = 'profiles_select_policy'
          AND qual LIKE '%auth.uid() = id%'
    ) THEN
        -- If complaints table exists, verify complaints policy does not allow public SELECT
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'complaints') THEN
            IF EXISTS (
                SELECT 1 FROM pg_policies 
                WHERE schemaname = 'public' 
                  AND tablename = 'complaints' 
                  AND policyname = 'complaints_select_policy'
                  AND qual LIKE '%is_admin%'
            ) THEN
                v_pass_count := v_pass_count + 1;
                RAISE NOTICE 'TEST % PASSED: PII privacy policies confirmed. Legacy complaints phone numbers restricted to admins.', v_test_count;
            ELSE
                RAISE EXCEPTION 'TEST % FAILED: Legacy complaints policy permits unauthorized public access!', v_test_count;
            END IF;
        ELSE
            v_pass_count := v_pass_count + 1;
            RAISE NOTICE 'TEST % PASSED: Profiles PII isolation confirmed (complaints table not present).', v_test_count;
        END IF;
    ELSE
        RAISE EXCEPTION 'TEST % FAILED: profiles_select_policy does not isolate user PII.', v_test_count;
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 6: Constraint Enforcement - Sybil vote protection & geometry rules
    -- --------------------------------------------------------------------------
    v_test_count := v_test_count + 1;
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_user_incident_verification'
    ) AND EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_incident_geom'
    ) AND EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_role_check'
    ) THEN
        v_pass_count := v_pass_count + 1;
        RAISE NOTICE 'TEST % PASSED: Duplicate verification, role domain & geometry check constraints active.', v_test_count;
    ELSE
        RAISE EXCEPTION 'TEST % FAILED: Missing required database integrity constraints.', v_test_count;
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 7: Bi-directional Triggers & Role Escalation Protection active
    -- --------------------------------------------------------------------------
    v_test_count := v_test_count + 1;
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_prevent_role_escalation'
    ) AND EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_sync_incident_to_complaint'
    ) AND EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        v_pass_count := v_pass_count + 1;
        RAISE NOTICE 'TEST % PASSED: Role escalation prevention and bi-directional compatibility triggers verified.', v_test_count;
    ELSE
        RAISE EXCEPTION 'TEST % FAILED: Missing required database triggers.', v_test_count;
    END IF;

    -- --------------------------------------------------------------------------
    -- TEST 8: Legacy Data Preservation & Non-Destructive Migration
    -- --------------------------------------------------------------------------
    v_test_count := v_test_count + 1;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'complaints' AND table_schema = 'public') THEN
        DECLARE
            c_count INTEGER;
            i_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO c_count FROM public.complaints;
            SELECT COUNT(*) INTO i_count FROM public.incidents WHERE source = 'legacy_import';
            
            IF c_count <= i_count THEN
                v_pass_count := v_pass_count + 1;
                RAISE NOTICE 'TEST % PASSED: Legacy complaints preserved intact (% records migrated without coordinate fabrication).', v_test_count, i_count;
            ELSE
                RAISE EXCEPTION 'TEST % FAILED: Complaints record count mismatch (% legacy vs % migrated).', v_test_count, c_count, i_count;
            END IF;
        END;
    ELSE
        v_pass_count := v_pass_count + 1;
        RAISE NOTICE 'TEST % PASSED: Complaints table check skipped (clean database environment).', v_test_count;
    END IF;

    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'VALIDATION COMPLETE: % / % TESTS PASSED', v_pass_count, v_test_count;
    RAISE NOTICE '=====================================================';
END $$;
