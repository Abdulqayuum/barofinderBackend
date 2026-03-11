SET @institution_jobs_has_max_applications := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'institution_jobs'
    AND COLUMN_NAME = 'max_applications'
);

SET @institution_jobs_add_max_applications_sql := IF(
  @institution_jobs_has_max_applications = 0,
  'ALTER TABLE institution_jobs ADD COLUMN max_applications INT NULL DEFAULT NULL AFTER application_url',
  'SELECT 1'
);

PREPARE stmt_add_institution_jobs_max_applications FROM @institution_jobs_add_max_applications_sql;
EXECUTE stmt_add_institution_jobs_max_applications;
DEALLOCATE PREPARE stmt_add_institution_jobs_max_applications;

SET @job_applications_has_archived_by_institution := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'institution_job_applications'
    AND COLUMN_NAME = 'archived_by_institution'
);

SET @job_applications_add_archived_by_institution_sql := IF(
  @job_applications_has_archived_by_institution = 0,
  'ALTER TABLE institution_job_applications ADD COLUMN archived_by_institution BOOLEAN NOT NULL DEFAULT FALSE AFTER reviewed_at',
  'SELECT 1'
);

PREPARE stmt_add_job_applications_archived_by_institution FROM @job_applications_add_archived_by_institution_sql;
EXECUTE stmt_add_job_applications_archived_by_institution;
DEALLOCATE PREPARE stmt_add_job_applications_archived_by_institution;

SET @job_applications_has_archived_at := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'institution_job_applications'
    AND COLUMN_NAME = 'archived_at'
);

SET @job_applications_add_archived_at_sql := IF(
  @job_applications_has_archived_at = 0,
  'ALTER TABLE institution_job_applications ADD COLUMN archived_at DATETIME NULL AFTER archived_by_institution',
  'SELECT 1'
);

PREPARE stmt_add_job_applications_archived_at FROM @job_applications_add_archived_at_sql;
EXECUTE stmt_add_job_applications_archived_at;
DEALLOCATE PREPARE stmt_add_job_applications_archived_at;

SET @job_applications_has_archive_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'institution_job_applications'
    AND INDEX_NAME = 'idx_job_applications_institution_archive'
);

SET @job_applications_add_archive_index_sql := IF(
  @job_applications_has_archive_index = 0,
  'ALTER TABLE institution_job_applications ADD INDEX idx_job_applications_institution_archive (institution_user_id, archived_by_institution, status, created_at)',
  'SELECT 1'
);

PREPARE stmt_add_job_applications_archive_index FROM @job_applications_add_archive_index_sql;
EXECUTE stmt_add_job_applications_archive_index;
DEALLOCATE PREPARE stmt_add_job_applications_archive_index;
