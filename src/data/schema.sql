-- WMC Operations: Supabase Schema (Start Fresh)
-- Run this in the Supabase SQL Editor to initialize or reset your database.

-- Disable RLS temporarily to ensure tables can be created/dropped easily (they will be re-enabled at the end)

-- Drop existing tables to start fresh
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS log_staff_assignments CASCADE;
DROP TABLE IF EXISTS progress_logs CASCADE;
DROP TABLE IF EXISTS sub_tasks CASCADE;
DROP TABLE IF EXISTS allocations CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS parameters CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;

-- 1. Staff Table
CREATE TABLE staff (
    id TEXT PRIMARY KEY,
    fingerprint_id TEXT,
    full_name TEXT,
    nickname TEXT,
    role TEXT,
    primary_skill TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    phone TEXT,
    additional_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Jobs Table
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    qt_number TEXT,
    project_name TEXT,
    client_name TEXT,
    job_type TEXT,
    status TEXT DEFAULT 'รอดำเนินการ',
    start_date TEXT,
    end_date TEXT,
    default_check_in TEXT,
    default_check_out TEXT,
    priority TEXT DEFAULT 'ปกติ',
    fix_reason TEXT,
    fix_photo TEXT,
    notes TEXT,
    created_by TEXT,
    overall_progress INTEGER DEFAULT 0,
    current_issues TEXT,
    current_issues_date TEXT,
    current_issues_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Allocations Table
CREATE TABLE allocations (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
    staff_id TEXT REFERENCES staff(id) ON DELETE CASCADE,
    date TEXT,
    assigned_hours NUMERIC,
    check_in TEXT,
    check_out TEXT,
    actual_hours NUMERIC,
    overtime_hours NUMERIC,
    task TEXT,
    status TEXT DEFAULT 'ได้รับมอบหมาย',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Parameters Table
CREATE TABLE parameters (
    id TEXT PRIMARY KEY DEFAULT 'default-params',
    work_start_time TEXT,
    work_end_time TEXT,
    lunch_break_start TEXT,
    lunch_break_duration NUMERIC,
    dinner_break_threshold TEXT,
    dinner_break_duration NUMERIC,
    base_daily_rate NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Holidays Table
CREATE TABLE holidays (
    id TEXT PRIMARY KEY,
    date TEXT UNIQUE,
    name TEXT,
    type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Sub Tasks Table
CREATE TABLE sub_tasks (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
    title TEXT,
    is_completed BOOLEAN DEFAULT FALSE
);

-- 7. Progress Logs Table
CREATE TABLE progress_logs (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
    log_date TEXT,
    text TEXT,
    author TEXT
);

-- 8. Log Staff Assignments (Many-to-Many for logs)
CREATE TABLE log_staff_assignments (
    id TEXT PRIMARY KEY,
    log_id TEXT REFERENCES progress_logs(id) ON DELETE CASCADE,
    staff_id TEXT REFERENCES staff(id) ON DELETE CASCADE
);

-- 9. Attachments Table
CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
    name TEXT,
    url TEXT,
    type TEXT
);

-- Enable RLS on all tables
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Create Policies (Allow everything for anon users - FOR DEVELOPMENT ONLY)
-- In production, you should use authenticated users.
CREATE POLICY "Enable all for anon" ON staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON allocations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON parameters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON holidays FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON sub_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON progress_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON log_staff_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON attachments FOR ALL USING (true) WITH CHECK (true);
