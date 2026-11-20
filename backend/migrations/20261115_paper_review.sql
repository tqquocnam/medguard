-- Run as database owner after branch isolation migration. No existing data is changed.
BEGIN;
CREATE SCHEMA IF NOT EXISTS paper_review;
CREATE TABLE IF NOT EXISTS paper_review.batches (
  id uuid PRIMARY KEY,
  branch_id varchar(5) NOT NULL REFERENCES auth.branches(id),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, id)
);
CREATE TABLE IF NOT EXISTS paper_review.files (
  id uuid PRIMARY KEY,
  branch_id varchar(5) NOT NULL,
  batch_id uuid NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','PROCESSING','COMPLETED','FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_until timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, id),
  UNIQUE(branch_id, batch_id, sha256),
  FOREIGN KEY(branch_id, batch_id) REFERENCES paper_review.batches(branch_id, id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS paper_review.pages (
  id uuid PRIMARY KEY,
  branch_id varchar(5) NOT NULL,
  file_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  page_number integer NOT NULL,
  image_name text NOT NULL,
  ocr jsonb NOT NULL,
  fields jsonb NOT NULL,
  document_type text NOT NULL DEFAULT 'UNKNOWN',
  case_key text NOT NULL DEFAULT '',
  confirmed boolean NOT NULL DEFAULT false,
  review_status text NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING','NEEDS_FIX','RESOLVED')),
  note text NOT NULL DEFAULT '',
  reviewed_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  UNIQUE(branch_id, file_id, page_number),
  FOREIGN KEY(branch_id, file_id) REFERENCES paper_review.files(branch_id, id) ON DELETE CASCADE,
  FOREIGN KEY(branch_id, batch_id) REFERENCES paper_review.batches(branch_id, id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS paper_review.settings (
  branch_id varchar(5) PRIMARY KEY REFERENCES auth.branches(id),
  rules jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS paper_review.audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branch_id varchar(5) NOT NULL,
  page_id uuid NOT NULL,
  user_id uuid NOT NULL,
  change jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paper_review_queue ON paper_review.files(branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS paper_review_batch_pages ON paper_review.pages(branch_id, batch_id);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['batches','files','pages','settings','audit'] LOOP
    EXECUTE format('ALTER TABLE paper_review.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE paper_review.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS branch_isolation ON paper_review.%I', t);
    EXECUTE format('CREATE POLICY branch_isolation ON paper_review.%I USING (branch_id = auth.current_branch_id()) WITH CHECK (branch_id = auth.current_branch_id())', t);
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA paper_review TO medguard_branch;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA paper_review TO medguard_branch;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA paper_review TO medguard_branch;
COMMIT;
