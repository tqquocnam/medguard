BEGIN;

-- Reuse the existing time rule's rule_type to support the installed schema.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM validation.rules WHERE code = 'ORDER_TIME_SEQUENCE') THEN
    RAISE EXCEPTION 'Missing ORDER_TIME_SEQUENCE rule; migration aborted.';
  END IF;
END $$;

INSERT INTO validation.rules
  (code, name, description, rule_type, enabled, severity, priority, config,
   validator_key, source_xml, target_xml, category, required, blocks_ok)
SELECT 'SERVICE_ORDER_BEFORE_EXAM',
  'Y lệnh dịch vụ trước giờ công khám',
  'Đối chiếu y lệnh XML3 với giờ khám của cùng bác sĩ, cùng ngày trong hồ sơ ngoại trú.',
  rule_type, TRUE, 'ERROR', priority + 1, '{}'::jsonb,
  'SERVICE_ORDER_BEFORE_EXAM', 'XML3', 'XML3', category, TRUE, TRUE
FROM validation.rules WHERE code = 'ORDER_TIME_SEQUENCE'
ON CONFLICT (code) DO NOTHING;

-- Branch settings continue to use validation.branch_rules and its defaults.
COMMIT;
