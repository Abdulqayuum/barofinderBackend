-- Demo seed data for local backend testing
-- Run after ../docs/MYSQL_SCHEMA.sql
-- mysql -u root -p barofinder < ./scripts/SEED_DEMO.sql

USE barofinder;

SET @admin_id = UUID();
SET @tutor_user_id = UUID();
SET @student_user_id = UUID();
SET @tutor_profile_id = UUID();
SET @course_id = UUID();
SET @lesson1_id = UUID();
SET @lesson2_id = UUID();
SET @conversation_id = UUID();
SET @message_id = UUID();
SET @enrollment_id = UUID();
SET @subscription_id = UUID();

-- Users (plain text passwords are accepted in local dev by API fallback)
INSERT INTO users (id, email, password_hash, email_verified)
VALUES
(@admin_id, 'admin@barofinder.local', 'admin123', TRUE),
(@tutor_user_id, 'tutor@barofinder.local', 'tutor123', TRUE),
(@student_user_id, 'student@barofinder.local', 'student123', TRUE)
ON DUPLICATE KEY UPDATE email_verified = TRUE;

INSERT INTO profiles (user_id, full_name, email, role, status, city)
VALUES
(@admin_id, 'Platform Admin', 'admin@barofinder.local', 'admin', 'active', 'Mogadishu'),
(@tutor_user_id, 'Ahmed Tutor', 'tutor@barofinder.local', 'tutor', 'active', 'Mogadishu'),
(@student_user_id, 'Amina Student', 'student@barofinder.local', 'student', 'active', 'Hargeisa')
ON DUPLICATE KEY UPDATE status = 'active';

INSERT IGNORE INTO user_roles (user_id, role) VALUES
(@admin_id, 'admin'),
(@admin_id, 'user'),
(@tutor_user_id, 'user'),
(@student_user_id, 'user');

INSERT INTO tutor_profiles (
  id, user_id, bio, education, teaching_style, experience_years, gender,
  subjects, levels, languages, service_areas,
  online_available, offline_available, online_hourly, offline_hourly, currency,
  availability, open_to_work, verification_status, verified_badge
) VALUES (
  @tutor_profile_id, @tutor_user_id,
  'Experienced math tutor for high school and university students.',
  'BSc Mathematics',
  'Interactive and exam-focused',
  6, 'male',
  JSON_ARRAY('Mathematics', 'Physics'),
  JSON_ARRAY('High School', 'University'),
  JSON_ARRAY('Somali', 'English'),
  JSON_ARRAY('Mogadishu'),
  TRUE, TRUE, 10.00, 15.00, 'USD',
  JSON_ARRAY(JSON_OBJECT('day','Monday','startTime','08:00','endTime','17:00')),
  FALSE, 'verified', TRUE
)
ON DUPLICATE KEY UPDATE verification_status = 'verified', verified_badge = TRUE, open_to_work = FALSE;

INSERT INTO courses (
  id, tutor_id, user_id, title, description, subject, pricing_type, price, currency, max_students,
  is_published, status
) VALUES (
  @course_id, @tutor_profile_id, @tutor_user_id,
  'Algebra Foundations',
  'Core algebra concepts from basics to advanced problem solving.',
  'Mathematics', 'paid', 25.00, 'USD', 100,
  TRUE, 'active'
)
ON DUPLICATE KEY UPDATE is_published = TRUE, status = 'active';

INSERT INTO course_lessons (id, course_id, title, description, content_type, sort_order)
VALUES
(@lesson1_id, @course_id, 'Lesson 1: Variables', 'Introduction to variables and expressions', 'text', 1),
(@lesson2_id, @course_id, 'Lesson 2: Linear Equations', 'Solving and graphing linear equations', 'text', 2)
ON DUPLICATE KEY UPDATE title = VALUES(title);

INSERT INTO course_enrollments (
  id, course_id, student_id, status, amount, currency, payment_method, transaction_ref, enrolled_at
) VALUES (
  @enrollment_id, @course_id, @student_user_id, 'approved', 25.00, 'USD', 'EVC Plus', 'TXN-DEMO-001', NOW()
)
ON DUPLICATE KEY UPDATE status = 'approved';

INSERT INTO subscriptions (
  id, tutor_id, user_id, plan, status, amount, currency, payment_method, transaction_ref, invoice_number, start_date, end_date
) VALUES (
  @subscription_id, @tutor_profile_id, @tutor_user_id, 'Pro Monthly', 'active', 19.00, 'USD', 'EVC Plus', 'SUB-DEMO-001',
  'INV-DEMO-0001', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY)
)
ON DUPLICATE KEY UPDATE status = 'active';

INSERT INTO reviews (id, tutor_id, student_id, rating, comment)
VALUES (UUID(), @tutor_profile_id, @student_user_id, 5, 'Excellent explanations and support.')
ON DUPLICATE KEY UPDATE rating = VALUES(rating);

INSERT INTO course_reviews (id, course_id, student_id, rating, comment)
VALUES (UUID(), @course_id, @student_user_id, 5, 'Great course structure and practical examples.')
ON DUPLICATE KEY UPDATE rating = VALUES(rating);

INSERT INTO conversations (id, student_id, tutor_id)
VALUES (@conversation_id, @student_user_id, @tutor_user_id)
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO messages (id, conversation_id, sender_id, content, is_read)
VALUES (@message_id, @conversation_id, @student_user_id, 'Hello tutor, I enrolled in your algebra course.', FALSE)
ON DUPLICATE KEY UPDATE content = VALUES(content);

INSERT INTO notifications (id, user_id, type, title, message, metadata, is_read)
VALUES (
  UUID(), @student_user_id, 'enrollment_approved', 'Enrollment Approved',
  'Your enrollment for Algebra Foundations is approved.',
  JSON_OBJECT('course_id', @course_id, 'enrollment_id', @enrollment_id),
  FALSE
)
ON DUPLICATE KEY UPDATE title = VALUES(title);
