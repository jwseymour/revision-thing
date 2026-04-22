-- ============================================================
-- Cambridge CS Revision System — Full Database Teardown
-- Run this in your Supabase SQL Editor BEFORE running schema.sql
-- WARNING: This will permanently delete all app data (flashcards, notes, states)
-- ============================================================

-- 1. Drop trigger & function attached to Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- 2. Drop all tables (CASCADE handles foreign key dependencies)
DROP TABLE IF EXISTS module_assistants CASCADE;
DROP TABLE IF EXISTS past_paper_answers CASCADE;
DROP TABLE IF EXISTS annotations CASCADE;
DROP TABLE IF EXISTS supervisor_sessions CASCADE;
DROP TABLE IF EXISTS mistake_records CASCADE;
DROP TABLE IF EXISTS item_scheduling_state CASCADE;
DROP TABLE IF EXISTS scheduling_state CASCADE;
DROP TABLE IF EXISTS mastery_scores CASCADE;
DROP TABLE IF EXISTS attempts CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS flashcards CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 3. Drop all custom types (ENUMs)
DROP TYPE IF EXISTS resource_type CASCADE;
DROP TYPE IF EXISTS flashcard_type CASCADE;
DROP TYPE IF EXISTS classification_type CASCADE;
DROP TYPE IF EXISTS error_type CASCADE;
DROP TYPE IF EXISTS question_type CASCADE;
DROP TYPE IF EXISTS resource_status CASCADE;

-- (Optional) If you want to reset storage policies on the 'resources' bucket:
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
-- We do not drop the bucket itself because Supabase UI handles storage deletion better.
