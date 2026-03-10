ALTER TABLE tutor_profiles
  ADD COLUMN IF NOT EXISTS open_to_work TINYINT(1) NOT NULL DEFAULT 0
  AFTER profile_photo_url;
