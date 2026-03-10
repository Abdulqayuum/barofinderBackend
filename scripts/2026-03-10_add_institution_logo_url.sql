SET @institution_profiles_has_logo_url := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'institution_profiles'
    AND COLUMN_NAME = 'logo_url'
);

SET @institution_profiles_add_logo_url_sql := IF(
  @institution_profiles_has_logo_url = 0,
  'ALTER TABLE institution_profiles ADD COLUMN logo_url TEXT DEFAULT NULL AFTER description',
  'SELECT 1'
);

PREPARE stmt_add_institution_logo_url FROM @institution_profiles_add_logo_url_sql;
EXECUTE stmt_add_institution_logo_url;
DEALLOCATE PREPARE stmt_add_institution_logo_url;
