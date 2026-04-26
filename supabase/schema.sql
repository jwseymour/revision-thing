-- ============================================================
-- Cambridge CS Revision System — Full Database Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ============================================================
-- 1. CUSTOM TYPES (ENUMS)
-- ============================================================

CREATE TYPE resource_type AS ENUM (
  'notes',
  'past_paper'
);

CREATE TYPE flashcard_type AS ENUM (
  'statement',
  'qna',
  'deep_dive'
);

CREATE TYPE classification_type AS ENUM (
  'correct_confident',
  'correct_guessed',
  'partial',
  'incorrect'
);

CREATE TYPE error_type AS ENUM (
  'conceptual',
  'misapplication',
  'memory',
  'careless'
);

CREATE TYPE question_type AS ENUM (
  'short_answer',
  'proof',
  'calculation',
  'code',
  'explanation'
);

CREATE TYPE resource_status AS ENUM (
  'pending',
  'processing',
  'ready',
  'error'
);

-- ============================================================
-- 2. PROFILES TABLE
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_practice_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 3. RESOURCES TABLE (uploaded PDFs)
-- ============================================================

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  part TEXT,
  paper TEXT,
  module TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  status resource_status DEFAULT 'pending',
  type resource_type DEFAULT 'notes',
  error_message TEXT,
  openai_file_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resources_user ON resources(user_id);
CREATE INDEX idx_resources_module ON resources(module);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view resources"
  ON resources FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own resources"
  ON resources FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert global resources"
  ON resources FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================
-- 4. FLASHCARDS TABLE
-- ============================================================

CREATE TABLE flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  difficulty INT CHECK (difficulty >= 1 AND difficulty <= 5) DEFAULT 3,
  tags TEXT[] DEFAULT '{}',
  card_type flashcard_type DEFAULT 'qna',
  source_rects JSONB,
  cascade_content JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flashcards_user ON flashcards(user_id);
CREATE INDEX idx_flashcards_module ON flashcards(user_id, module);

ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own flashcards"
  ON flashcards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. QUESTIONS TABLE
-- ============================================================

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  text TEXT NOT NULL,
  difficulty INT CHECK (difficulty >= 1 AND difficulty <= 5) DEFAULT 3,
  tags TEXT[] DEFAULT '{}',
  type question_type DEFAULT 'short_answer',
  solution_text TEXT NOT NULL,
  solution_explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_user ON questions(user_id);
CREATE INDEX idx_questions_module ON questions(user_id, module);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own questions"
  ON questions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6. ATTEMPTS TABLE
-- ============================================================

CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('flashcard', 'question')),
  classification classification_type NOT NULL,
  error_classification error_type,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attempts_user ON attempts(user_id);
CREATE INDEX idx_attempts_item ON attempts(user_id, item_id);
CREATE INDEX idx_attempts_created ON attempts(user_id, created_at DESC);

ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own attempts"
  ON attempts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 7. MASTERY SCORES TABLE
-- ============================================================

CREATE TABLE mastery_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  score REAL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  total_attempts INT DEFAULT 0,
  correct_attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module)
);

CREATE INDEX idx_mastery_user ON mastery_scores(user_id);
CREATE INDEX idx_mastery_module ON mastery_scores(user_id, module);

ALTER TABLE mastery_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own mastery scores"
  ON mastery_scores FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 8. SCHEDULING STATE TABLE (Phase 2 — SM-2)
-- ============================================================

CREATE TABLE scheduling_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  stability REAL DEFAULT 0,
  difficulty REAL DEFAULT 0,
  elapsed_days INT DEFAULT 0,
  scheduled_days INT DEFAULT 0,
  reps INT DEFAULT 0,
  lapses INT DEFAULT 0,
  state INT DEFAULT 0,
  next_review_at TIMESTAMPTZ DEFAULT NOW(),

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module)
);

CREATE INDEX idx_scheduling_user ON scheduling_state(user_id);
CREATE INDEX idx_scheduling_next_review ON scheduling_state(user_id, next_review_at);

ALTER TABLE scheduling_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scheduling state"
  ON scheduling_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 8b. ITEM SCHEDULING STATE TABLE (Per-card SM-2)
-- ============================================================

CREATE TABLE item_scheduling_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('flashcard', 'question')),
  stability REAL DEFAULT 0,
  difficulty REAL DEFAULT 0,
  elapsed_days INT DEFAULT 0,
  scheduled_days INT DEFAULT 0,
  reps INT DEFAULT 0,
  lapses INT DEFAULT 0,
  state INT DEFAULT 0,
  next_review_at TIMESTAMPTZ DEFAULT NOW(),

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

CREATE INDEX idx_item_scheduling_user ON item_scheduling_state(user_id);
CREATE INDEX idx_item_scheduling_item ON item_scheduling_state(item_id);
CREATE INDEX idx_item_scheduling_next_review ON item_scheduling_state(user_id, next_review_at);

ALTER TABLE item_scheduling_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own item scheduling state"
  ON item_scheduling_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 9. MISTAKE RECORDS TABLE (Phase 2)
-- ============================================================

CREATE TABLE mistake_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  error_type error_type NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mistakes_user ON mistake_records(user_id);
CREATE INDEX idx_mistakes_module ON mistake_records(user_id, module);
CREATE INDEX idx_mistakes_unresolved ON mistake_records(user_id, resolved) WHERE resolved = FALSE;

ALTER TABLE mistake_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own mistake records"
  ON mistake_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 10. STORAGE BUCKET FOR PDFs
-- ============================================================
-- NOTE: Run this separately in SQL Editor, or create via
-- Supabase Dashboard → Storage → New Bucket
-- Name: "resources", Public: false

INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Admin/Auth users can manage global resources bucket
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
CREATE POLICY "Authenticated users can upload resources"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resources' AND
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
CREATE POLICY "Anyone can view resources objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resources'
  );

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Authenticated users can delete resources"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'resources' AND
    auth.role() = 'authenticated'
  );

-- ============================================================
-- 11. SUPERVISOR SESSIONS TABLE (Phase 3)
-- ============================================================

CREATE TABLE supervisor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  openai_thread_id TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_supervisor_user ON supervisor_sessions(user_id);
CREATE INDEX idx_supervisor_module ON supervisor_sessions(user_id, module);

ALTER TABLE supervisor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own supervisor sessions"
  ON supervisor_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 12. ANNOTATIONS TABLE
-- ============================================================

CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source_rects JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_annotations_user ON annotations(user_id);
CREATE INDEX idx_annotations_resource ON annotations(resource_id);

ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own annotations"
  ON annotations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 13. PAST PAPER ANSWERS TABLE
-- ============================================================

CREATE TABLE past_paper_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, resource_id)
);

CREATE INDEX idx_past_paper_answers_user ON past_paper_answers(user_id);
CREATE INDEX idx_past_paper_answers_resource ON past_paper_answers(resource_id);

ALTER TABLE past_paper_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own past paper answers"
  ON past_paper_answers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 14. MODULE ASSISTANTS TABLE (Phase 4)
-- ============================================================

CREATE TABLE module_assistants (
  module TEXT PRIMARY KEY,
  openai_assistant_id TEXT NOT NULL,
  openai_vector_store_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: This table holds system-wide mapping, so maybe anyone can read it, but only auth can insert.
ALTER TABLE module_assistants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read assistants"
  ON module_assistants FOR SELECT
  USING (true);

CREATE POLICY "Auth users can insert assistants"
  ON module_assistants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

