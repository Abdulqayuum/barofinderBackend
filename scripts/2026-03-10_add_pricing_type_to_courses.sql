ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS pricing_type ENUM('free', 'paid') NOT NULL DEFAULT 'free'
  AFTER subject;

UPDATE courses
SET pricing_type = CASE
  WHEN price > 0 THEN 'paid'
  ELSE 'free'
END;
