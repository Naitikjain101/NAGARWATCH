-- ==============================================================================
-- NAGARWATCH: Community Safety & Neighbourhood Intelligence Platform
-- Migration: 001_nagarwatch_core.sql
-- Description: Core schema, spatial indexes, RLS policies, audit logs, and triggers.
-- Coordinate Reference System: EPSG:4326 (WGS 84 - Standard GPS Longitude/Latitude)
-- Compatibility: Fully preserves existing CivicSnap 'complaints', 'wards', 'profiles'
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ------------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS FOR TIMESTAMPS & GEOMETRY
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. PROFILES TABLE (Extend existing or create if missing)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role VARCHAR(20) DEFAULT 'citizen'
);

-- Safely extend profiles with NagarWatch citizen fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_ward_id INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_neighbourhood_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Harden role constraint to support citizen, admin, super_admin, superadmin
DO $$
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('citizen', 'admin', 'super_admin', 'superadmin'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Trigger to keep profiles.updated_at fresh
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 4. WARDS TABLE (Extend existing CivicSnap wards)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    geom GEOMETRY(Polygon, 4326)
);

ALTER TABLE public.wards ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE public.wards ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Main City';
ALTER TABLE public.wards ADD COLUMN IF NOT EXISTS zone VARCHAR(100);
ALTER TABLE public.wards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.wards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- PostGIS GiST Spatial Index on Ward Polygons
CREATE INDEX IF NOT EXISTS idx_wards_geom ON public.wards USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_wards_name ON public.wards(name);

DROP TRIGGER IF EXISTS trg_wards_updated_at ON public.wards;
CREATE TRIGGER trg_wards_updated_at
BEFORE UPDATE ON public.wards
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. NEIGHBOURHOODS TABLE (New sub-ward locality structure)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.neighbourhoods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id INTEGER REFERENCES public.wards(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE,
    description TEXT,
    geom GEOMETRY(Geometry, 4326),
    health_score NUMERIC(5,2) DEFAULT 100.00 CHECK (health_score >= 0 AND health_score <= 100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- PostGIS GiST Spatial Index on Neighbourhood Polygons
CREATE INDEX IF NOT EXISTS idx_neighbourhoods_geom ON public.neighbourhoods USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_neighbourhoods_ward ON public.neighbourhoods(ward_id);

DROP TRIGGER IF EXISTS trg_neighbourhoods_updated_at ON public.neighbourhoods;
CREATE TRIGGER trg_neighbourhoods_updated_at
BEFORE UPDATE ON public.neighbourhoods
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Wire foreign keys from profiles back to wards and neighbourhoods
DO $$
BEGIN
    ALTER TABLE public.profiles 
        ADD CONSTRAINT fk_profiles_ward 
        FOREIGN KEY (primary_ward_id) REFERENCES public.wards(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.profiles 
        ADD CONSTRAINT fk_profiles_neighbourhood 
        FOREIGN KEY (primary_neighbourhood_id) REFERENCES public.neighbourhoods(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 6. ADMIN_WARDS JUNCTION TABLE (Preserve & Harden)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_wards (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ward_id INTEGER REFERENCES public.wards(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, ward_id)
);

ALTER TABLE public.admin_wards ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.admin_wards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- ------------------------------------------------------------------------------
-- 7. INCIDENTS TABLE (Core NagarWatch Incident Entity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_complaint_id INTEGER UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ward_id INTEGER REFERENCES public.wards(id) ON DELETE SET NULL,
    neighbourhood_id UUID REFERENCES public.neighbourhoods(id) ON DELETE SET NULL,
    title VARCHAR(200),
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'Pothole', 'Streetlight', 'Garbage', 'Graffiti', 
        'Water Leak', 'Signage', 'Safety Hazard', 'Encroachment', 'Other'
    )),
    description TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(30) DEFAULT 'reported' CHECK (status IN (
        'pending', 'reported', 'verified', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected'
    )),
    geom GEOMETRY(Point, 4326),
    latitude NUMERIC(10, 7) GENERATED ALWAYS AS (CASE WHEN geom IS NOT NULL THEN ST_Y(geom) ELSE NULL END) STORED,
    longitude NUMERIC(10, 7) GENERATED ALWAYS AS (CASE WHEN geom IS NOT NULL THEN ST_X(geom) ELSE NULL END) STORED,
    address TEXT,
    source VARCHAR(20) DEFAULT 'web' CHECK (source IN ('web', 'mobile', 'legacy_import', 'sensor')),
    has_exif_gps BOOLEAN DEFAULT FALSE,
    primary_image_url TEXT,
    confirmations_count INTEGER DEFAULT 0 CHECK (confirmations_count >= 0),
    disputes_count INTEGER DEFAULT 0 CHECK (disputes_count >= 0),
    resolved_validations_count INTEGER DEFAULT 0 CHECK (resolved_validations_count >= 0),
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_incident_geom CHECK (source = 'legacy_import' OR geom IS NOT NULL)
);

-- Spatial and B-Tree Indexes for incidents
CREATE INDEX IF NOT EXISTS idx_incidents_geom ON public.incidents USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_incidents_geog ON public.incidents USING GIST((geom::geography));
CREATE INDEX IF NOT EXISTS idx_incidents_ward_id ON public.incidents(ward_id);
CREATE INDEX IF NOT EXISTS idx_incidents_neighbourhood_id ON public.incidents(neighbourhood_id);
CREATE INDEX IF NOT EXISTS idx_incidents_user_id ON public.incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_category ON public.incidents(category);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON public.incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents(created_at DESC);

-- Trigram Text Indexes for Search & Duplicate Similarity
CREATE INDEX IF NOT EXISTS idx_incidents_desc_trgm ON public.incidents USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_incidents_title_trgm ON public.incidents USING GIN (title gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_incidents_updated_at ON public.incidents;
CREATE TRIGGER trg_incidents_updated_at
BEFORE UPDATE ON public.incidents
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 8. INCIDENT_MEDIA TABLE (Multi-image, Evidence & Resolution Proofs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incident_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    media_type VARCHAR(20) DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'document')),
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    is_resolution_proof BOOLEAN DEFAULT FALSE,
    has_exif_gps BOOLEAN DEFAULT FALSE,
    exif_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incident_media_incident ON public.incident_media(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_media_proof ON public.incident_media(incident_id) WHERE is_resolution_proof = TRUE;

-- ------------------------------------------------------------------------------
-- 9. INCIDENT_VERIFICATIONS TABLE (Community Confirmations, Disputes, Resolved)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incident_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    verification_type VARCHAR(20) NOT NULL CHECK (verification_type IN ('confirm', 'dispute', 'resolved')),
    notes TEXT,
    evidence_media_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_incident_verification UNIQUE (incident_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_verifications_incident ON public.incident_verifications(incident_id);
CREATE INDEX IF NOT EXISTS idx_verifications_user ON public.incident_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_type ON public.incident_verifications(verification_type);

-- Trigger to automatically update verification counters on incidents
CREATE OR REPLACE FUNCTION public.sync_incident_verification_counters()
RETURNS TRIGGER AS $$
DECLARE
    target_incident_id UUID;
BEGIN
    target_incident_id := COALESCE(NEW.incident_id, OLD.incident_id);

    UPDATE public.incidents
    SET 
        confirmations_count = (
            SELECT COUNT(*) FROM public.incident_verifications 
            WHERE incident_id = target_incident_id AND verification_type = 'confirm'
        ),
        disputes_count = (
            SELECT COUNT(*) FROM public.incident_verifications 
            WHERE incident_id = target_incident_id AND verification_type = 'dispute'
        ),
        resolved_validations_count = (
            SELECT COUNT(*) FROM public.incident_verifications 
            WHERE incident_id = target_incident_id AND verification_type = 'resolved'
        )
    WHERE id = target_incident_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_verification_counters ON public.incident_verifications;
CREATE TRIGGER trg_sync_verification_counters
AFTER INSERT OR UPDATE OR DELETE ON public.incident_verifications
FOR EACH ROW EXECUTE PROCEDURE public.sync_incident_verification_counters();

-- ------------------------------------------------------------------------------
-- 10. INCIDENT_UPDATES TABLE (Status History & Immutable Audit Log)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incident_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    notes TEXT,
    proof_media_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON public.incident_updates(incident_id, created_at DESC);

-- Trigger to automatically log status transitions on incidents
CREATE OR REPLACE FUNCTION public.log_incident_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.incident_updates (
            incident_id,
            user_id,
            old_status,
            new_status,
            notes,
            proof_media_url
        ) VALUES (
            NEW.id,
            auth.uid(),
            OLD.status,
            NEW.status,
            NEW.resolution_notes,
            NULL
        );

        IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
            NEW.resolved_at = CURRENT_TIMESTAMP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_incident_status ON public.incidents;
CREATE TRIGGER trg_log_incident_status
BEFORE UPDATE ON public.incidents
FOR EACH ROW EXECUTE PROCEDURE public.log_incident_status_change();

-- ------------------------------------------------------------------------------
-- 11. INCIDENT_ASSIGNMENTS TABLE (Department / Worker Assignments & SLA)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incident_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    department VARCHAR(100),
    notes TEXT,
    deadline TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'reassigned', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incident_assignments_incident ON public.incident_assignments(incident_id, status);
CREATE INDEX IF NOT EXISTS idx_incident_assignments_assignee ON public.incident_assignments(assigned_to, status);

DROP TRIGGER IF EXISTS trg_assignments_updated_at ON public.incident_assignments;
CREATE TRIGGER trg_assignments_updated_at
BEFORE UPDATE ON public.incident_assignments
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 12. NOTIFICATIONS TABLE (In-App Notifications)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'status_update' CHECK (type IN (
        'status_update', 'new_nearby_incident', 'verification_received', 'assignment', 'system'
    )),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- ------------------------------------------------------------------------------
-- 13. AUTHENTICATION TRIGGER ON auth.users
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        role, 
        full_name, 
        phone_number, 
        email
    )
    VALUES (
        NEW.id, 
        'citizen',
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', 'Citizen'),
        COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
        COALESCE(NEW.email, NEW.raw_user_meta_data->>'email')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
        email = COALESCE(EXCLUDED.email, public.profiles.email);
  
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Re-attach trigger safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 14. DATA MIGRATION & BACKWARD COMPATIBILITY SYNC
-- ------------------------------------------------------------------------------

-- Migrate any existing CivicSnap complaints into incidents table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'complaints') THEN
        INSERT INTO public.incidents (
            legacy_complaint_id,
            category,
            description,
            status,
            geom,
            ward_id,
            primary_image_url,
            confirmations_count,
            source,
            created_at
        )
        SELECT 
            c.id,
            CASE 
                WHEN c.category IN ('Pothole', 'Streetlight', 'Garbage', 'Graffiti', 'Water Leak', 'Signage') THEN c.category
                ELSE 'Other'
            END,
            COALESCE(c.description, 'Imported from CivicSnap complaint #' || c.id),
            CASE LOWER(COALESCE(c.status, 'pending'))
                WHEN 'pending' THEN 'reported'
                WHEN 'in_progress' THEN 'in_progress'
                WHEN 'resolved' THEN 'resolved'
                WHEN 'rejected' THEN 'rejected'
                ELSE 'reported'
            END,
            c.geom,
            c.ward_id,
            c.image_url,
            COALESCE(c.upvotes, 0),
            'legacy_import',
            c.created_at
        FROM public.complaints c
        ON CONFLICT (legacy_complaint_id) DO NOTHING;

        -- Create initial media record for imported complaints
        INSERT INTO public.incident_media (
            incident_id,
            media_type,
            media_url,
            is_resolution_proof,
            created_at
        )
        SELECT 
            i.id,
            'image',
            c.image_url,
            FALSE,
            c.created_at
        FROM public.complaints c
        JOIN public.incidents i ON i.legacy_complaint_id = c.id
        WHERE c.image_url IS NOT NULL AND c.image_url <> ''
        ON CONFLICT DO NOTHING;

        -- Audit & report unlocated legacy complaints
        DECLARE
            v_unlocated_count INTEGER := 0;
        BEGIN
            SELECT COUNT(*) INTO v_unlocated_count FROM public.complaints WHERE geom IS NULL;
            IF v_unlocated_count > 0 THEN
                RAISE NOTICE 'NagarWatch Migration Notice: % unlocated legacy complaint records imported with NULL geometry (retained without coordinate fabrication).', v_unlocated_count;
            END IF;
        END;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- BI-DIRECTIONAL COMPATIBILITY SYNCHRONIZATION TRIGGERS
-- Authoritative Model:
-- - Modern incident reports originate on public.incidents.
-- - Before insert on incidents automatically provisions a mirror row in public.complaints.
-- - Legacy writes directly to complaints synchronize to public.incidents.
-- - pg_trigger_depth() > 1 checks prevent recursive loops and duplicate record creation.
-- ------------------------------------------------------------------------------

-- Trigger A: Forward Sync (public.incidents -> public.complaints)
CREATE OR REPLACE FUNCTION public.sync_incident_to_complaint()
RETURNS TRIGGER AS $$
DECLARE
    new_complaint_id INTEGER;
BEGIN
    -- Prevent recursive trigger loops or duplicate insertions
    IF pg_trigger_depth() > 1 OR NEW.legacy_complaint_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'complaints') THEN
        INSERT INTO public.complaints (
            image_url,
            description,
            geom,
            ward_id,
            category,
            phone_number,
            upvotes,
            status,
            created_at
        ) VALUES (
            NEW.primary_image_url,
            NEW.description,
            NEW.geom,
            NEW.ward_id,
            NEW.category,
            'nagarwatch',
            COALESCE(NEW.confirmations_count, 0),
            CASE NEW.status
                WHEN 'reported' THEN 'Pending'
                WHEN 'pending' THEN 'Pending'
                WHEN 'in_progress' THEN 'In Progress'
                WHEN 'resolved' THEN 'Resolved'
                WHEN 'rejected' THEN 'Rejected'
                ELSE 'Pending'
            END,
            COALESCE(NEW.created_at, CURRENT_TIMESTAMP)
        ) RETURNING id INTO new_complaint_id;

        NEW.legacy_complaint_id := new_complaint_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_incident_to_complaint ON public.incidents;
CREATE TRIGGER trg_sync_incident_to_complaint
BEFORE INSERT ON public.incidents
FOR EACH ROW EXECUTE PROCEDURE public.sync_incident_to_complaint();

-- Trigger B: Forward Status Sync (public.incidents -> public.complaints)
CREATE OR REPLACE FUNCTION public.sync_incident_status_to_complaint()
RETURNS TRIGGER AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.legacy_complaint_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'complaints') THEN
            UPDATE public.complaints
            SET status = CASE NEW.status
                WHEN 'reported' THEN 'Pending'
                WHEN 'pending' THEN 'Pending'
                WHEN 'in_progress' THEN 'In Progress'
                WHEN 'resolved' THEN 'Resolved'
                WHEN 'rejected' THEN 'Rejected'
                ELSE 'Pending'
            END
            WHERE id = NEW.legacy_complaint_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_incident_status_to_complaint ON public.incidents;
CREATE TRIGGER trg_sync_incident_status_to_complaint
AFTER UPDATE OF status ON public.incidents
FOR EACH ROW EXECUTE PROCEDURE public.sync_incident_status_to_complaint();

-- Trigger C: Backward Sync (public.complaints -> public.incidents)
CREATE OR REPLACE FUNCTION public.sync_complaint_to_incident()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent recursive trigger loops or duplicate insertions when write originated from incidents
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- If an incident already references this legacy complaint, update it in place
    IF EXISTS (SELECT 1 FROM public.incidents WHERE legacy_complaint_id = NEW.id) THEN
        UPDATE public.incidents SET
            category = CASE 
                WHEN NEW.category IN ('Pothole', 'Streetlight', 'Garbage', 'Graffiti', 'Water Leak', 'Signage') THEN NEW.category
                ELSE 'Other'
            END,
            description = COALESCE(NEW.description, 'Complaint #' || NEW.id),
            status = CASE LOWER(COALESCE(NEW.status, 'pending'))
                WHEN 'pending' THEN 'reported'
                WHEN 'reported' THEN 'reported'
                WHEN 'in_progress' THEN 'in_progress'
                WHEN 'resolved' THEN 'resolved'
                WHEN 'rejected' THEN 'rejected'
                ELSE 'reported'
            END,
            primary_image_url = NEW.image_url,
            confirmations_count = COALESCE(NEW.upvotes, 0)
        WHERE legacy_complaint_id = NEW.id;

        RETURN NEW;
    END IF;

    -- Otherwise, insert a new incident record
    INSERT INTO public.incidents (
        legacy_complaint_id,
        category,
        description,
        status,
        geom,
        ward_id,
        primary_image_url,
        confirmations_count,
        source,
        created_at
    )
    VALUES (
        NEW.id,
        CASE 
            WHEN NEW.category IN ('Pothole', 'Streetlight', 'Garbage', 'Graffiti', 'Water Leak', 'Signage') THEN NEW.category
            ELSE 'Other'
        END,
        COALESCE(NEW.description, 'Complaint #' || NEW.id),
        CASE LOWER(COALESCE(NEW.status, 'pending'))
            WHEN 'pending' THEN 'reported'
            WHEN 'reported' THEN 'reported'
            WHEN 'in_progress' THEN 'in_progress'
            WHEN 'resolved' THEN 'resolved'
            WHEN 'rejected' THEN 'rejected'
            ELSE 'reported'
        END,
        NEW.geom,
        NEW.ward_id,
        NEW.image_url,
        COALESCE(NEW.upvotes, 0),
        'legacy_import',
        COALESCE(NEW.created_at, CURRENT_TIMESTAMP)
    )
    ON CONFLICT (legacy_complaint_id) DO UPDATE SET
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        primary_image_url = EXCLUDED.primary_image_url,
        confirmations_count = EXCLUDED.confirmations_count;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'complaints') THEN
        DROP TRIGGER IF EXISTS trg_sync_complaint_to_incident ON public.complaints;
        CREATE TRIGGER trg_sync_complaint_to_incident
        AFTER INSERT OR UPDATE ON public.complaints
        FOR EACH ROW EXECUTE PROCEDURE public.sync_complaint_to_incident();
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 15. ROW-LEVEL SECURITY (RLS) & NON-RECURSIVE SECURITY DEFINER FUNCTIONS
-- ------------------------------------------------------------------------------

-- Helper 1: Is caller super admin? (Bypasses RLS to prevent recursion)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'superadmin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

-- Helper 2: Is caller an admin or super admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

-- Helper 3: Is caller assigned as admin to the given ward?
CREATE OR REPLACE FUNCTION public.is_ward_admin(check_ward_id INTEGER)
RETURNS BOOLEAN AS $$
  SELECT (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_wards aw
      JOIN public.profiles p ON p.id = aw.user_id
      WHERE aw.user_id = auth.uid() 
        AND aw.ward_id = check_ward_id
        AND p.role IN ('admin', 'super_admin', 'superadmin')
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

-- Prevent non-superadmins from escalating their own or other users' roles
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF NOT public.is_super_admin() THEN
            RAISE EXCEPTION 'Unauthorized: Only super administrators can modify user roles.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.prevent_role_escalation();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighbourhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'complaints') THEN
        ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Clear previous policies before applying new policies cleanly
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename IN (
            'profiles', 'wards', 'neighbourhoods', 'admin_wards',
            'incidents', 'incident_media', 'incident_verifications',
            'incident_updates', 'incident_assignments', 'notifications', 'complaints'
        )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ==============================================================================
-- RLS POLICIES SPECIFICATION
-- ==============================================================================

-- 1. PROFILES
-- Citizen can read own profile; Admin/SuperAdmin can read all profiles
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING (
    auth.uid() = id OR public.is_admin()
);

-- Users can update own profile (role modification intercepted by trigger)
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING (
    auth.uid() = id OR public.is_super_admin()
);

-- 2. WARDS
-- Publicly readable boundaries
CREATE POLICY "wards_select_policy" ON public.wards
FOR SELECT USING (true);

-- Only superadmins can create, edit, or delete ward geometries
CREATE POLICY "wards_insert_policy" ON public.wards
FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "wards_update_policy" ON public.wards
FOR UPDATE USING (public.is_super_admin());

CREATE POLICY "wards_delete_policy" ON public.wards
FOR DELETE USING (public.is_super_admin());

-- 3. NEIGHBOURHOODS
-- Publicly readable communities
CREATE POLICY "neighbourhoods_select_policy" ON public.neighbourhoods
FOR SELECT USING (true);

-- Only superadmins can create, edit, or delete neighbourhood boundaries
CREATE POLICY "neighbourhoods_insert_policy" ON public.neighbourhoods
FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "neighbourhoods_update_policy" ON public.neighbourhoods
FOR UPDATE USING (public.is_super_admin());

CREATE POLICY "neighbourhoods_delete_policy" ON public.neighbourhoods
FOR DELETE USING (public.is_super_admin());

-- 4. ADMIN_WARDS
-- Admins can view assignments; Superadmins have full authority
CREATE POLICY "admin_wards_select_policy" ON public.admin_wards
FOR SELECT USING (
    user_id = auth.uid() OR public.is_admin()
);

CREATE POLICY "admin_wards_all_superadmin" ON public.admin_wards
FOR ALL USING (public.is_super_admin());

-- 5. INCIDENTS
-- Public visibility: Anyone can view active civic reports (rejected visible to author & admins)
CREATE POLICY "incidents_select_policy" ON public.incidents
FOR SELECT USING (
    status != 'rejected' 
    OR user_id = auth.uid() 
    OR public.is_ward_admin(ward_id)
);

-- Citizen can insert their own reports
CREATE POLICY "incidents_insert_policy" ON public.incidents
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid())
);

-- Citizen can update their own reported incidents while status = 'reported';
-- Ward admin or superadmin can update status, notes, severity
CREATE POLICY "incidents_update_policy" ON public.incidents
FOR UPDATE USING (
    (auth.uid() = user_id AND status = 'reported')
    OR public.is_ward_admin(ward_id)
);

-- Only superadmin can hard delete an incident
CREATE POLICY "incidents_delete_policy" ON public.incidents
FOR DELETE USING (public.is_super_admin());

-- 6. INCIDENT_MEDIA
-- Media visible if attached to an existing incident
CREATE POLICY "incident_media_select_policy" ON public.incident_media
FOR SELECT USING (true);

-- Authenticated user or authorized admin can upload media
CREATE POLICY "incident_media_insert_policy" ON public.incident_media
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
);

-- Media author or superadmin can delete media
CREATE POLICY "incident_media_delete_policy" ON public.incident_media
FOR DELETE USING (
    auth.uid() = user_id OR public.is_super_admin()
);

-- 7. INCIDENT_VERIFICATIONS
-- Verifications are public transparency records
CREATE POLICY "verifications_select_policy" ON public.incident_verifications
FOR SELECT USING (true);

-- Authenticated citizens can submit one verification (enforced by UNIQUE constraint)
CREATE POLICY "verifications_insert_policy" ON public.incident_verifications
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND auth.uid() = user_id
);

-- Citizens can update or retract their own verification
CREATE POLICY "verifications_update_policy" ON public.incident_verifications
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "verifications_delete_policy" ON public.incident_verifications
FOR DELETE USING (auth.uid() = user_id OR public.is_super_admin());

-- 8. INCIDENT_UPDATES (Audit Log)
-- Audit history is transparent to all authenticated viewers
CREATE POLICY "incident_updates_select_policy" ON public.incident_updates
FOR SELECT USING (true);

-- Only admins or database triggers can insert into status audit log
CREATE POLICY "incident_updates_insert_policy" ON public.incident_updates
FOR INSERT WITH CHECK (public.is_admin());

-- Updates log is immutable
CREATE POLICY "incident_updates_no_update" ON public.incident_updates
FOR UPDATE USING (false);

CREATE POLICY "incident_updates_no_delete" ON public.incident_updates
FOR DELETE USING (public.is_super_admin());

-- 9. INCIDENT_ASSIGNMENTS
-- Assigned worker, ward admin, or superadmin can view assignments
CREATE POLICY "assignments_select_policy" ON public.incident_assignments
FOR SELECT USING (
    assigned_to = auth.uid() OR public.is_admin()
);

-- Ward admin or superadmin can manage assignments
CREATE POLICY "assignments_insert_policy" ON public.incident_assignments
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "assignments_update_policy" ON public.incident_assignments
FOR UPDATE USING (public.is_admin());

CREATE POLICY "assignments_delete_policy" ON public.incident_assignments
FOR DELETE USING (public.is_super_admin());

-- 10. NOTIFICATIONS
-- Users can only read, update, or delete their own notifications
CREATE POLICY "notifications_select_policy" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_policy" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notifications_delete_policy" ON public.notifications
FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_policy" ON public.notifications
FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 11. LEGACY COMPLAINTS TABLE (Harden backward compatibility & protect citizen PII)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'complaints') THEN
        -- Strictly restrict direct PostgREST complaint queries to administrators
        -- Prevents anonymous or unauthorized users from harvesting citizen phone numbers
        EXECUTE 'CREATE POLICY "complaints_select_policy" ON public.complaints FOR SELECT USING (public.is_admin());';
        EXECUTE 'CREATE POLICY "complaints_insert_policy" ON public.complaints FOR INSERT WITH CHECK (public.is_admin());';
        EXECUTE 'CREATE POLICY "complaints_update_policy" ON public.complaints FOR UPDATE USING (public.is_admin());';
        EXECUTE 'CREATE POLICY "complaints_delete_policy" ON public.complaints FOR DELETE USING (public.is_super_admin());';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 16. LEAST-PRIVILEGE POSTGREST PRIVILEGES (GRANTS & REVOKES)
-- ------------------------------------------------------------------------------
-- Ensure PostgREST roles (anon, authenticated) possess exact required table grants.
-- RLS policies further restrict individual rows.

-- Schema Access
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Anonymous Role: Read-only access to public civic data only
GRANT SELECT ON public.wards TO anon;
GRANT SELECT ON public.neighbourhoods TO anon;
GRANT SELECT ON public.incidents TO anon;
GRANT SELECT ON public.incident_media TO anon;
GRANT SELECT ON public.incident_verifications TO anon;
GRANT SELECT ON public.incident_updates TO anon;

-- Protect sensitive tables from anonymous access
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.admin_wards FROM anon;
REVOKE ALL ON public.incident_assignments FROM anon;
REVOKE ALL ON public.notifications FROM anon;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'complaints') THEN
        REVOKE ALL ON public.complaints FROM anon;
        GRANT SELECT ON public.complaints TO authenticated; -- Governed by complaints_select_policy (admin only)
    END IF;
END $$;

-- Authenticated Role: Full civic engagement privileges (strictly constrained by RLS)
GRANT SELECT ON public.wards TO authenticated;
GRANT SELECT ON public.neighbourhoods TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.incidents TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.incident_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_verifications TO authenticated;
GRANT SELECT ON public.incident_updates TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.admin_wards TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT ON public.incident_assignments TO authenticated;

-- Sequences: Allow superadmin ward creation sequence increment
GRANT USAGE, SELECT ON SEQUENCE public.wards_id_seq TO authenticated;


