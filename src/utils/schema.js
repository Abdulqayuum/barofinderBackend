import db from '../config/database.js';

async function readColumn(tableName, columnName) {
  const [rows] = await db.query(
    `SELECT
       DATA_TYPE AS data_type,
       COLUMN_TYPE AS column_type,
       IS_NULLABLE AS is_nullable,
       CHARACTER_MAXIMUM_LENGTH AS max_length
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName],
  );

  return rows[0] || null;
}

export async function ensureOtpCodesSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      email VARCHAR(255) NOT NULL,
      otp CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (email)
    )
  `);

  const emailColumn = await readColumn('otp_codes', 'email');
  if (!emailColumn || Number(emailColumn.max_length || 0) < 255 || emailColumn.is_nullable === 'YES') {
    await db.query('ALTER TABLE otp_codes MODIFY COLUMN email VARCHAR(255) NOT NULL');
  }

  const otpColumn = await readColumn('otp_codes', 'otp');
  if (!otpColumn || Number(otpColumn.max_length || 0) < 64 || otpColumn.is_nullable === 'YES') {
    await db.query('ALTER TABLE otp_codes MODIFY COLUMN otp CHAR(64) NOT NULL');
  }

  const expiresAtColumn = await readColumn('otp_codes', 'expires_at');
  if (!expiresAtColumn || expiresAtColumn.is_nullable === 'YES') {
    await db.query('ALTER TABLE otp_codes MODIFY COLUMN expires_at DATETIME NOT NULL');
  }
}
