ALTER TABLE tutor_profiles
  ADD COLUMN IF NOT EXISTS pricing_type ENUM('hour', 'week', 'month', 'contract') NOT NULL DEFAULT 'hour'
  AFTER offline_available;

UPDATE tutor_profiles
SET pricing_type = 'hour'
WHERE pricing_type IS NULL;
