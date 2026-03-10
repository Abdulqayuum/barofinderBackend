CREATE TABLE IF NOT EXISTS institution_profiles (
  id                   CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
  user_id              CHAR(36)     NOT NULL UNIQUE,
  institution_name     VARCHAR(255) NOT NULL,
  institution_type     VARCHAR(30)  NOT NULL DEFAULT 'school',
  description          TEXT         DEFAULT NULL,
  logo_url             TEXT         DEFAULT NULL,
  website_url          TEXT         DEFAULT NULL,
  address              TEXT         DEFAULT NULL,
  city                 VARCHAR(100) DEFAULT NULL,
  contact_person_name  VARCHAR(255) DEFAULT NULL,
  contact_person_title VARCHAR(255) DEFAULT NULL,
  contact_email        VARCHAR(255) DEFAULT NULL,
  contact_phone        VARCHAR(50)  DEFAULT NULL,
  approval_status      VARCHAR(20)  NOT NULL DEFAULT 'pending',
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_institution_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_institution_profiles_type (institution_type),
  INDEX idx_institution_profiles_city (city),
  INDEX idx_institution_profiles_approval (approval_status)
) ENGINE=InnoDB;

SET @institution_profiles_has_approval_status := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'institution_profiles'
    AND COLUMN_NAME = 'approval_status'
);

SET @institution_profiles_add_approval_status_sql := IF(
  @institution_profiles_has_approval_status = 0,
  'ALTER TABLE institution_profiles ADD COLUMN approval_status VARCHAR(20) NOT NULL DEFAULT ''pending'' AFTER contact_phone',
  'SELECT 1'
);

PREPARE stmt_add_institution_approval_status FROM @institution_profiles_add_approval_status_sql;
EXECUTE stmt_add_institution_approval_status;
DEALLOCATE PREPARE stmt_add_institution_approval_status;

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

SET @institution_profiles_has_approval_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'institution_profiles'
    AND INDEX_NAME = 'idx_institution_profiles_approval'
);

SET @institution_profiles_add_approval_index_sql := IF(
  @institution_profiles_has_approval_index = 0,
  'ALTER TABLE institution_profiles ADD INDEX idx_institution_profiles_approval (approval_status)',
  'SELECT 1'
);

PREPARE stmt_add_institution_approval_index FROM @institution_profiles_add_approval_index_sql;
EXECUTE stmt_add_institution_approval_index;
DEALLOCATE PREPARE stmt_add_institution_approval_index;

CREATE TABLE IF NOT EXISTS institution_jobs (
  id               CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
  institution_id   CHAR(36)      NOT NULL,
  user_id          CHAR(36)      NOT NULL,
  title            VARCHAR(255)  NOT NULL,
  description      TEXT          NOT NULL,
  subject          VARCHAR(100)  DEFAULT NULL,
  level            VARCHAR(100)  DEFAULT NULL,
  city             VARCHAR(100)  DEFAULT NULL,
  employment_type  VARCHAR(30)   NOT NULL DEFAULT 'part_time',
  work_mode        VARCHAR(20)   NOT NULL DEFAULT 'on_site',
  salary_amount    DECIMAL(10,2) DEFAULT NULL,
  salary_currency  VARCHAR(5)    NOT NULL DEFAULT 'USD',
  salary_period    VARCHAR(20)   NOT NULL DEFAULT 'month',
  requirements     JSON          DEFAULT ('[]'),
  benefits         JSON          DEFAULT ('[]'),
  application_email VARCHAR(255) DEFAULT NULL,
  application_phone VARCHAR(50)  DEFAULT NULL,
  application_url  TEXT          DEFAULT NULL,
  expires_at       DATETIME      DEFAULT NULL,
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_institution_jobs_institution FOREIGN KEY (institution_id) REFERENCES institution_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_institution_jobs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_institution_jobs_user (user_id),
  INDEX idx_institution_jobs_subject (subject),
  INDEX idx_institution_jobs_city (city),
  INDEX idx_institution_jobs_status (is_active, expires_at),
  INDEX idx_institution_jobs_created (created_at)
) ENGINE=InnoDB;
