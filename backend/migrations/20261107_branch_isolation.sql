-- Run with the backend stopped, using the database owner/admin.
-- Requires the earlier branch_id / branch_rule_settings preparation migration.
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION auth.current_branch_id()
RETURNS VARCHAR(5) LANGUAGE SQL STABLE AS $$
  SELECT NULLIF(current_setting('medguard.branch_id', true), '')::VARCHAR(5)
$$;

DO $$
DECLARE t RECORD; missing BIGINT;
BEGIN
  FOR t IN SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname IN ('catalog', 'core', 'validation')
      AND NOT (schemaname = 'validation' AND tablename = 'rules')
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = t.schemaname AND table_name = t.tablename AND column_name = 'branch_id') THEN
      RAISE EXCEPTION 'Thiếu branch_id ở %.%. Chạy migration chuẩn bị trước.', t.schemaname, t.tablename;
    END IF;
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE branch_id IS NULL', t.schemaname, t.tablename) INTO missing;
    IF missing > 0 THEN
      RAISE EXCEPTION 'Có % dòng chưa gán chi nhánh tại %.%. Dừng, không tự gán dữ liệu.', missing, t.schemaname, t.tablename;
    END IF;
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN branch_id SET NOT NULL', t.schemaname, t.tablename);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN branch_id SET DEFAULT auth.current_branch_id()', t.schemaname, t.tablename);
  END LOOP;
END $$;

-- Rebuild business foreign keys with branch ownership included.
CREATE TEMP TABLE branch_foreign_keys ON COMMIT DROP AS
SELECT c.conname, c.conrelid, c.confrelid, cn.nspname AS child_schema,
  ct.relname AS child_table, pn.nspname AS parent_schema, pt.relname AS parent_table,
  c.confupdtype, c.confdeltype, c.condeferrable, c.condeferred,
  (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
   FROM unnest(c.conkey) WITH ORDINALITY k(num, ord)
   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num
   WHERE a.attname <> 'branch_id') AS child_columns,
  (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
   FROM unnest(c.confkey) WITH ORDINALITY k(num, ord)
   JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.num
   WHERE a.attname <> 'branch_id') AS parent_columns
FROM pg_constraint c
JOIN pg_class ct ON ct.oid = c.conrelid
JOIN pg_namespace cn ON cn.oid = ct.relnamespace
JOIN pg_class pt ON pt.oid = c.confrelid
JOIN pg_namespace pn ON pn.oid = pt.relnamespace
WHERE c.contype = 'f'
  AND cn.nspname IN ('core','catalog','validation')
  AND pn.nspname IN ('core','catalog','validation')
  AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attname = 'branch_id' AND NOT a.attisdropped)
  AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attname = 'branch_id' AND NOT a.attisdropped);

DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN SELECT * FROM branch_foreign_keys LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', f.child_schema, f.child_table, f.conname);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I.%I (branch_id, %s)',
      'uq_branch_fk_' || f.confrelid || '_' || substr(md5(f.parent_columns),1,8),
      f.parent_schema, f.parent_table, f.parent_columns);
  END LOOP;
END $$;

-- Natural codes can be reused by different branches.
DO $$
DECLARE t RECORD; c RECORD; cols TEXT;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('departments'), ('machines'), ('services'), ('staff'), ('service_groups'), ('icd_codes'), ('service_machines')
  ) AS x(name) LOOP
    FOR c IN SELECT con.oid, con.conname, con.conkey FROM pg_constraint con
      WHERE con.conrelid = format('catalog.%I', t.name)::regclass AND con.contype = 'p'
    LOOP
      IF NOT EXISTS (SELECT 1 FROM unnest(c.conkey) k JOIN pg_attribute a
        ON a.attrelid = format('catalog.%I', t.name)::regclass AND a.attnum = k
        WHERE a.attname = 'branch_id') THEN
        SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord) INTO cols
        FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
        JOIN pg_attribute a ON a.attrelid = format('catalog.%I',t.name)::regclass AND a.attnum = k.num;
        EXECUTE format('ALTER TABLE catalog.%I DROP CONSTRAINT %I', t.name, c.conname);
        EXECUTE format('ALTER TABLE catalog.%I ADD CONSTRAINT %I PRIMARY KEY (branch_id, %s)', t.name, c.conname, cols);
      END IF;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE catalog.icd_warning_rules DROP CONSTRAINT IF EXISTS icd_warning_rules_icd_code_error_code_key;
ALTER TABLE catalog.icd_warning_rules ADD CONSTRAINT icd_warning_rules_icd_code_error_code_key UNIQUE (branch_id, icd_code, error_code);
ALTER TABLE catalog.medical_staff_aliases DROP CONSTRAINT IF EXISTS medical_staff_aliases_alias_code_key;
ALTER TABLE catalog.medical_staff_aliases ADD CONSTRAINT medical_staff_aliases_alias_code_key UNIQUE (branch_id, alias_code);
ALTER TABLE catalog.service_group_members DROP CONSTRAINT IF EXISTS service_group_members_group_code_service_code_key;
ALTER TABLE catalog.service_group_members ADD CONSTRAINT service_group_members_group_code_service_code_key UNIQUE (branch_id, group_code, service_code);
ALTER TABLE catalog.examination_services DROP CONSTRAINT IF EXISTS uq_examination_services_code;
ALTER TABLE catalog.examination_services ADD CONSTRAINT uq_examination_services_code UNIQUE (branch_id, code);

DROP INDEX IF EXISTS catalog.drug_icd_interactions_unique;
CREATE UNIQUE INDEX drug_icd_interactions_unique ON catalog.drug_icd_interactions
  (branch_id, lower(btrim(active_ingredient)), upper(btrim(icd_code)), match_type);
DROP INDEX IF EXISTS catalog.uq_service_icd_rules_service_icd_match;
CREATE UNIQUE INDEX uq_service_icd_rules_service_icd_match ON catalog.service_icd_rules
  (branch_id, service_code, icd_code, match_type);

DO $$
DECLARE f RECORD; update_action TEXT; delete_action TEXT;
BEGIN
  FOR f IN SELECT * FROM branch_foreign_keys LOOP
    update_action := CASE f.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END;
    delete_action := CASE f.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL (' || f.child_columns || ')'
      WHEN 'd' THEN 'SET DEFAULT (' || f.child_columns || ')' END;
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (branch_id, %s) REFERENCES %I.%I (branch_id, %s) ON UPDATE %s ON DELETE %s %s',
      f.child_schema, f.child_table, f.conname, f.child_columns,
      f.parent_schema, f.parent_table, f.parent_columns, update_action, delete_action,
      CASE WHEN f.condeferrable THEN 'DEFERRABLE ' || CASE WHEN f.condeferred THEN 'INITIALLY DEFERRED' ELSE 'INITIALLY IMMEDIATE' END ELSE 'NOT DEFERRABLE' END);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medguard_branch') THEN
    CREATE ROLE medguard_branch NOLOGIN;
  END IF;
END $$;
ALTER ROLE medguard_branch NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
GRANT medguard_branch TO CURRENT_USER;
GRANT USAGE ON SCHEMA auth, core, catalog, validation TO medguard_branch;
GRANT SELECT ON auth.branches TO medguard_branch;
GRANT SELECT, INSERT, UPDATE ON auth.users TO medguard_branch;
REVOKE ALL ON validation.rules FROM medguard_branch;
GRANT SELECT ON validation.rules TO medguard_branch;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA core, catalog, validation TO medguard_branch;

DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname IN ('catalog','core','validation')
      AND NOT (schemaname='validation' AND tablename='rules')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.schemaname,t.tablename);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', t.schemaname,t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS medguard_branch_scope ON %I.%I', t.schemaname,t.tablename);
    EXECUTE format('CREATE POLICY medguard_branch_scope ON %I.%I AS RESTRICTIVE FOR ALL TO medguard_branch USING (branch_id = auth.current_branch_id()) WITH CHECK (branch_id = auth.current_branch_id())', t.schemaname,t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS medguard_branch_access ON %I.%I', t.schemaname,t.tablename);
    EXECUTE format('CREATE POLICY medguard_branch_access ON %I.%I FOR ALL TO medguard_branch USING (true) WITH CHECK (true)', t.schemaname,t.tablename);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I.%I TO medguard_branch', t.schemaname,t.tablename);
  END LOOP;
END $$;

-- Effective rules combine shared definitions and the current branch's settings.
CREATE OR REPLACE VIEW validation.branch_rules WITH (security_invoker = true) AS
SELECT r.id, r.code, r.name, r.description, r.rule_type,
  COALESCE(s.enabled,r.enabled) AS enabled,
  COALESCE(s.severity,r.severity) AS severity,
  COALESCE(s.priority,r.priority) AS priority,
  COALESCE(s.config,r.config) AS config,
  r.created_at, GREATEST(r.updated_at,s.updated_at) AS updated_at,
  r.validator_key, r.source_xml, r.target_xml, r.category,
  COALESCE(s.required,r.required) AS required,
  COALESCE(s.blocks_ok,r.blocks_ok) AS blocks_ok
FROM validation.rules r
LEFT JOIN validation.branch_rule_settings s
  ON s.rule_id=r.id AND s.branch_id=auth.current_branch_id()
WHERE auth.current_branch_id() IS NOT NULL;

CREATE OR REPLACE FUNCTION validation.update_branch_rule()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF auth.current_branch_id() IS NULL THEN RAISE EXCEPTION 'Chưa xác định chi nhánh.'; END IF;
  IF (to_jsonb(NEW) - ARRAY['enabled','severity','priority','config','required','blocks_ok','updated_at'])
    IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['enabled','severity','priority','config','required','blocks_ok','updated_at']) THEN
    RAISE EXCEPTION 'Không được thay đổi định nghĩa rule chung.';
  END IF;
  INSERT INTO validation.branch_rule_settings
    (branch_id,rule_id,enabled,severity,priority,config,required,blocks_ok)
  VALUES (auth.current_branch_id(),OLD.id,NEW.enabled,NEW.severity,NEW.priority,NEW.config,NEW.required,NEW.blocks_ok)
  ON CONFLICT (branch_id,rule_id) DO UPDATE SET
    enabled=EXCLUDED.enabled,severity=EXCLUDED.severity,priority=EXCLUDED.priority,
    config=EXCLUDED.config,required=EXCLUDED.required,blocks_ok=EXCLUDED.blocks_ok,updated_at=NOW();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS update_branch_rule ON validation.branch_rules;
CREATE TRIGGER update_branch_rule INSTEAD OF UPDATE ON validation.branch_rules
FOR EACH ROW EXECUTE FUNCTION validation.update_branch_rule();
GRANT SELECT, UPDATE ON validation.branch_rules TO medguard_branch;

CREATE OR REPLACE FUNCTION core.check_xml_branch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE facility TEXT;
BEGIN
  facility := CASE WHEN TG_TABLE_NAME='medical_cases' THEN to_jsonb(NEW)->>'ma_cskcb'
                  ELSE to_jsonb(NEW)->>'facility_code' END;
  IF NULLIF(btrim(facility),'') IS DISTINCT FROM NEW.branch_id THEN
    RAISE EXCEPTION 'Mã CSKCB trong XML không khớp chi nhánh %.', NEW.branch_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS check_xml_branch ON core.medical_cases;
CREATE TRIGGER check_xml_branch BEFORE INSERT OR UPDATE ON core.medical_cases
FOR EACH ROW EXECUTE FUNCTION core.check_xml_branch();
DROP TRIGGER IF EXISTS check_xml_branch ON core.import_batches;
CREATE TRIGGER check_xml_branch BEFORE INSERT OR UPDATE ON core.import_batches
FOR EACH ROW EXECUTE FUNCTION core.check_xml_branch();

COMMIT;
