-- Run as database owner after 20261115_paper_review.sql.
BEGIN;
ALTER TABLE paper_review.files ADD COLUMN IF NOT EXISTS reprocess_token uuid;
ALTER TABLE paper_review.files ADD COLUMN IF NOT EXISTS reader text NOT NULL DEFAULT 'tesseract' CHECK (reader IN ('tesseract','openai'));
CREATE TABLE IF NOT EXISTS paper_review.ai_requests (
  id uuid PRIMARY KEY,
  branch_id varchar(5) NOT NULL REFERENCES auth.branches(id),
  file_id uuid NOT NULL,
  page_number integer NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  succeeded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paper_review_ai_daily ON paper_review.ai_requests(branch_id,created_at);
ALTER TABLE paper_review.ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_review.ai_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS branch_isolation ON paper_review.ai_requests;
CREATE POLICY branch_isolation ON paper_review.ai_requests
 USING (branch_id=auth.current_branch_id()) WITH CHECK (branch_id=auth.current_branch_id());
GRANT SELECT,INSERT,UPDATE ON paper_review.ai_requests TO medguard_branch;
COMMIT;
