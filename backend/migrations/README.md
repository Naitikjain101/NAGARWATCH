# NAGARWATCH Database Architecture & Migrations

This directory contains versioned SQL migrations and validation suites establishing the database foundation for **NAGARWATCH: Community Safety & Neighbourhood Intelligence Platform**.

---

## 📁 Migration Files

1. **`001_nagarwatch_core.sql`**:
   - Enables `uuid-ossp`, `postgis`, and `pg_trgm` extensions.
   - Extends `public.profiles` with rich citizen profile attributes and role constraints (`citizen`, `admin`, `super_admin`, `superadmin`).
   - Extends `public.wards` and creates `public.neighbourhoods` (hierarchical spatial boundaries).
   - Preserves and hardens `public.admin_wards`.
   - Creates the core `public.incidents` table with UUID keys, PostGIS coordinates (SRID 4326), severity levels, generated lat/long columns, and foreign keys.
   - Creates supporting tables:
     - `public.incident_media` (multi-photo and resolution proof storage)
     - `public.incident_verifications` (anti-Sybil community confirmations, disputes, and resolutions with unique constraints)
     - `public.incident_updates` (immutable status transition audit log)
     - `public.incident_assignments` (department & worker assignment with SLA deadlines)
     - `public.notifications` (citizen in-app alerts)
   - Configures spatial GiST indexes on all geometry columns and Trigram GIN indexes for duplicate text search.
   - Migrates existing CivicSnap `complaints` into `incidents` and configures a synchronization trigger.
   - Applies strict, non-recursive Row-Level Security (RLS) policies.

2. **`002_verification_tests.sql`**:
   - Diagnostic queries inspecting spatial indexes and RLS coverage.
   - An automated test block running assertions across all 8 security rules:
     - Citizen cross-incident edit blocking
     - User PII isolation
     - Self-promotion / role escalation prevention
     - Duplicate community vote prevention
     - Ward-scoped administrative boundaries
     - Super-admin governance
     - Spatial index verification
     - Legacy data retention verification

---

## 🚀 Execution Instructions

### Method 1: Supabase Dashboard SQL Editor (Recommended)

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your project.
3. In the left navigation menu, click **SQL Editor**.
4. Click **New query**.
5. Copy the entire contents of `backend/migrations/001_nagarwatch_core.sql` into the query editor.
6. Click **Run**. Verify the green success confirmation message.
7. Open a new query window, paste the contents of `backend/migrations/002_verification_tests.sql`, and click **Run**.
8. Inspect the output notices in the Messages console:
   ```text
   VALIDATION COMPLETE: 8 / 8 TESTS PASSED
   ```

### Method 2: Command Line via `psql`

Connect using your Supabase PostgreSQL connection string (obtainable from Project Settings -> Database):

```bash
# 1. Execute the core migration
psql -h <db_host> -p 5432 -d postgres -U postgres -f backend/migrations/001_nagarwatch_core.sql

# 2. Run the security verification suite
psql -h <db_host> -p 5432 -d postgres -U postgres -f backend/migrations/002_verification_tests.sql
```

---

## 🔒 Security & Data Safety Guarantees

* **Zero Data Loss**: Existing `complaints`, `wards`, `profiles`, and `admin_wards` tables are **not dropped**. All existing complaint records are imported into `incidents`.
* **Backward Compatibility**: A two-way trigger `trg_sync_complaint_to_incident` ensures that any legacy endpoint writing to `complaints` automatically synchronizes to `incidents`.
* **Idempotency**: All statements use `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and `DROP ... IF EXISTS` clauses so the migration can be safely rerun without errors.
* **Role Escalation Protection**: An explicit `BEFORE UPDATE` trigger on `public.profiles` (`prevent_role_escalation`) rejects any attempt by non-superadmins to modify the `role` column.
* **No Recursive RLS**: RLS helper functions are designated `SECURITY DEFINER` and bypass RLS internally, preventing PostgreSQL 42P17 infinite recursion errors.

