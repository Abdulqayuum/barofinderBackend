-- MySQL dump 10.13  Distrib 8.4.8, for Linux (x86_64)
--
-- Host: localhost    Database: barofinder
-- ------------------------------------------------------
-- Server version	8.4.8-0ubuntu0.25.10.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `activity_logs`
--

DROP TABLE IF EXISTS `activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_logs` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `user_id` char(36) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` char(36) DEFAULT NULL,
  `details` json DEFAULT (_utf8mb4'{}'),
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_user` (`user_id`),
  KEY `idx_activity_entity` (`entity_type`,`entity_id`),
  KEY `idx_activity_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_logs`
--

LOCK TABLES `activity_logs` WRITE;
/*!40000 ALTER TABLE `activity_logs` DISABLE KEYS */;
INSERT INTO `activity_logs` VALUES ('081fa495-1b30-11f1-a03a-74d83e7f7e20','c2fcb0ba-0713-47a9-a21c-85308bae7ef0','user.signup','user','c2fcb0ba-0713-47a9-a21c-85308bae7ef0','{\"email\": \"qalintech@gmail.com\"}','::1','2026-03-08 23:47:33');
/*!40000 ALTER TABLE `activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ads`
--

DROP TABLE IF EXISTS `ads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ads` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `company_name` varchar(255) NOT NULL,
  `description` text,
  `image_url` text,
  `image_width` int DEFAULT NULL,
  `image_height` int DEFAULT NULL,
  `link_url` text,
  `placement` varchar(30) NOT NULL DEFAULT 'card',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `start_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `end_date` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ads`
--

LOCK TABLES `ads` WRITE;
/*!40000 ALTER TABLE `ads` DISABLE KEYS */;
/*!40000 ALTER TABLE `ads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_settings` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `key` varchar(100) NOT NULL,
  `value` text,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_settings`
--

LOCK TABLES `app_settings` WRITE;
/*!40000 ALTER TABLE `app_settings` DISABLE KEYS */;
INSERT INTO `app_settings` VALUES ('18d5bd83-1b1e-11f1-a03a-74d83e7f7e20','site_name','BaroFinder','2026-03-08 21:39:10'),('18d5c236-1b1e-11f1-a03a-74d83e7f7e20','admin_signature_name','Platform Administrator','2026-03-08 21:39:10'),('18d5c412-1b1e-11f1-a03a-74d83e7f7e20','support_email','support@barofinder.com','2026-03-08 21:39:10'),('18d5c523-1b1e-11f1-a03a-74d83e7f7e20','currency_default','USD','2026-03-08 21:39:10'),('18d5c60c-1b1e-11f1-a03a-74d83e7f7e20','max_file_upload_mb','5','2026-03-08 21:39:10');
/*!40000 ALTER TABLE `app_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cities`
--

DROP TABLE IF EXISTS `cities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cities` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cities`
--

LOCK TABLES `cities` WRITE;
/*!40000 ALTER TABLE `cities` DISABLE KEYS */;
INSERT INTO `cities` VALUES ('18c88136-1b1e-11f1-a03a-74d83e7f7e20','Mogadishu','2026-03-08 21:39:10'),('18c88605-1b1e-11f1-a03a-74d83e7f7e20','Hargeisa','2026-03-08 21:39:10'),('18c887c6-1b1e-11f1-a03a-74d83e7f7e20','Bosaso','2026-03-08 21:39:10'),('18c888c0-1b1e-11f1-a03a-74d83e7f7e20','Kismayo','2026-03-08 21:39:10'),('18c889a1-1b1e-11f1-a03a-74d83e7f7e20','Garowe','2026-03-08 21:39:10'),('18c88a7f-1b1e-11f1-a03a-74d83e7f7e20','Berbera','2026-03-08 21:39:10'),('18c88c7e-1b1e-11f1-a03a-74d83e7f7e20','Burao','2026-03-08 21:39:10'),('18c88d49-1b1e-11f1-a03a-74d83e7f7e20','Beledweyne','2026-03-08 21:39:10'),('18c88e1b-1b1e-11f1-a03a-74d83e7f7e20','Marka','2026-03-08 21:39:10'),('18c88ee9-1b1e-11f1-a03a-74d83e7f7e20','Jowhar','2026-03-08 21:39:10'),('18c88fb9-1b1e-11f1-a03a-74d83e7f7e20','Galkayo','2026-03-08 21:39:10'),('18c8907e-1b1e-11f1-a03a-74d83e7f7e20','Baidoa','2026-03-08 21:39:10'),('18c8914a-1b1e-11f1-a03a-74d83e7f7e20','Dhusamareb','2026-03-08 21:39:10'),('18c89212-1b1e-11f1-a03a-74d83e7f7e20','Laascaanood','2026-03-08 21:39:10');
/*!40000 ALTER TABLE `cities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversations`
--

DROP TABLE IF EXISTS `conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversations` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `student_id` char(36) NOT NULL,
  `tutor_id` char(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conversation_pair` (`student_id`,`tutor_id`),
  KEY `idx_conversations_student` (`student_id`),
  KEY `idx_conversations_tutor` (`tutor_id`),
  CONSTRAINT `fk_conversations_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_conversations_tutor` FOREIGN KEY (`tutor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversations`
--

LOCK TABLES `conversations` WRITE;
/*!40000 ALTER TABLE `conversations` DISABLE KEYS */;
/*!40000 ALTER TABLE `conversations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `course_enrollments`
--

DROP TABLE IF EXISTS `course_enrollments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_enrollments` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `course_id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `amount` decimal(10,2) DEFAULT NULL,
  `currency` varchar(5) DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `transaction_ref` varchar(255) DEFAULT NULL,
  `enrolled_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_enrollments_course` (`course_id`),
  KEY `idx_enrollments_student` (`student_id`),
  KEY `idx_enrollments_status` (`status`),
  CONSTRAINT `fk_enrollments_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enrollments_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `course_enrollments`
--

LOCK TABLES `course_enrollments` WRITE;
/*!40000 ALTER TABLE `course_enrollments` DISABLE KEYS */;
/*!40000 ALTER TABLE `course_enrollments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `course_lessons`
--

DROP TABLE IF EXISTS `course_lessons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_lessons` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `course_id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `content_type` varchar(20) NOT NULL DEFAULT 'text',
  `content_url` text,
  `external_url` text,
  `text_content` longtext,
  `duration_minutes` int DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lessons_course_id` (`course_id`),
  KEY `idx_lessons_sort` (`course_id`,`sort_order`),
  CONSTRAINT `fk_lessons_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `course_lessons`
--

LOCK TABLES `course_lessons` WRITE;
/*!40000 ALTER TABLE `course_lessons` DISABLE KEYS */;
/*!40000 ALTER TABLE `course_lessons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `course_quizzes`
--

DROP TABLE IF EXISTS `course_quizzes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_quizzes` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `course_id` char(36) NOT NULL,
  `lesson_id` char(36) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `passing_score` int NOT NULL DEFAULT '70',
  `is_required` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_quizzes_lesson` (`lesson_id`),
  KEY `idx_quizzes_course` (`course_id`),
  CONSTRAINT `fk_quizzes_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quizzes_lesson` FOREIGN KEY (`lesson_id`) REFERENCES `course_lessons` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `course_quizzes`
--

LOCK TABLES `course_quizzes` WRITE;
/*!40000 ALTER TABLE `course_quizzes` DISABLE KEYS */;
/*!40000 ALTER TABLE `course_quizzes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `course_reviews`
--

DROP TABLE IF EXISTS `course_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_reviews` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `course_id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `rating` tinyint NOT NULL,
  `comment` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_course_review` (`course_id`,`student_id`),
  KEY `fk_course_reviews_student` (`student_id`),
  KEY `idx_course_reviews_course` (`course_id`),
  CONSTRAINT `fk_course_reviews_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_course_reviews_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_course_review_rating` CHECK (((`rating` >= 1) and (`rating` <= 5)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `course_reviews`
--

LOCK TABLES `course_reviews` WRITE;
/*!40000 ALTER TABLE `course_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `course_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `courses`
--

DROP TABLE IF EXISTS `courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `courses` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `tutor_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `subject` varchar(100) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(5) NOT NULL DEFAULT 'USD',
  `max_students` int DEFAULT '20',
  `cover_image_url` text,
  `is_published` tinyint(1) NOT NULL DEFAULT '0',
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_courses_tutor_id` (`tutor_id`),
  KEY `idx_courses_user_id` (`user_id`),
  KEY `idx_courses_published` (`is_published`),
  KEY `idx_courses_subject` (`subject`),
  CONSTRAINT `fk_courses_tutor` FOREIGN KEY (`tutor_id`) REFERENCES `tutor_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_courses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `courses`
--

LOCK TABLES `courses` WRITE;
/*!40000 ALTER TABLE `courses` DISABLE KEYS */;
/*!40000 ALTER TABLE `courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `languages`
--

DROP TABLE IF EXISTS `languages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `languages` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `languages`
--

LOCK TABLES `languages` WRITE;
/*!40000 ALTER TABLE `languages` DISABLE KEYS */;
INSERT INTO `languages` VALUES ('18cf78ea-1b1e-11f1-a03a-74d83e7f7e20','Somali','2026-03-08 21:39:10'),('18cf7d6f-1b1e-11f1-a03a-74d83e7f7e20','Arabic','2026-03-08 21:39:10'),('18cf7f1c-1b1e-11f1-a03a-74d83e7f7e20','English','2026-03-08 21:39:10'),('18cf801d-1b1e-11f1-a03a-74d83e7f7e20','French','2026-03-08 21:39:10'),('18cf80f7-1b1e-11f1-a03a-74d83e7f7e20','Spanish','2026-03-08 21:39:10'),('18cf81d1-1b1e-11f1-a03a-74d83e7f7e20','German','2026-03-08 21:39:10'),('18cf82a1-1b1e-11f1-a03a-74d83e7f7e20','Italian','2026-03-08 21:39:10'),('18cf836f-1b1e-11f1-a03a-74d83e7f7e20','Turkish','2026-03-08 21:39:10'),('18cf8448-1b1e-11f1-a03a-74d83e7f7e20','Swahili','2026-03-08 21:39:10');
/*!40000 ALTER TABLE `languages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lesson_progress`
--

DROP TABLE IF EXISTS `lesson_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lesson_progress` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `student_id` char(36) NOT NULL,
  `course_id` char(36) NOT NULL,
  `lesson_id` char(36) NOT NULL,
  `completed` tinyint(1) NOT NULL DEFAULT '0',
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_progress` (`student_id`,`lesson_id`),
  KEY `fk_progress_course` (`course_id`),
  KEY `fk_progress_lesson` (`lesson_id`),
  KEY `idx_progress_student_course` (`student_id`,`course_id`),
  CONSTRAINT `fk_progress_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_progress_lesson` FOREIGN KEY (`lesson_id`) REFERENCES `course_lessons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_progress_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lesson_progress`
--

LOCK TABLES `lesson_progress` WRITE;
/*!40000 ALTER TABLE `lesson_progress` DISABLE KEYS */;
/*!40000 ALTER TABLE `lesson_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `levels`
--

DROP TABLE IF EXISTS `levels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `levels` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `levels`
--

LOCK TABLES `levels` WRITE;
/*!40000 ALTER TABLE `levels` DISABLE KEYS */;
INSERT INTO `levels` VALUES ('18cd5152-1b1e-11f1-a03a-74d83e7f7e20','Primary','2026-03-08 21:39:10'),('18cd560f-1b1e-11f1-a03a-74d83e7f7e20','Middle School','2026-03-08 21:39:10'),('18cd57ca-1b1e-11f1-a03a-74d83e7f7e20','High School','2026-03-08 21:39:10'),('18cd58c1-1b1e-11f1-a03a-74d83e7f7e20','Secondary','2026-03-08 21:39:10'),('18cd599e-1b1e-11f1-a03a-74d83e7f7e20','University','2026-03-08 21:39:10'),('18cd5a72-1b1e-11f1-a03a-74d83e7f7e20','Professional','2026-03-08 21:39:10'),('18cd5b3f-1b1e-11f1-a03a-74d83e7f7e20','Exam Prep','2026-03-08 21:39:10');
/*!40000 ALTER TABLE `levels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `conversation_id` char(36) NOT NULL,
  `sender_id` char(36) NOT NULL,
  `content` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_messages_conversation` (`conversation_id`),
  KEY `idx_messages_is_read` (`is_read`),
  KEY `idx_messages_sender` (`sender_id`),
  CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`qalintech`@`localhost`*/ /*!50003 TRIGGER `trg_message_update_conversation` AFTER INSERT ON `messages` FOR EACH ROW BEGIN
  UPDATE conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `notices`
--

DROP TABLE IF EXISTS `notices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notices` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'info',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_banner` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `start_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `end_date` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notices`
--

LOCK TABLES `notices` WRITE;
/*!40000 ALTER TABLE `notices` DISABLE KEYS */;
/*!40000 ALTER TABLE `notices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `user_id` char(36) DEFAULT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `metadata` json DEFAULT (_utf8mb4'{}'),
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`),
  KEY `idx_notifications_read` (`user_id`,`is_read`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_methods`
--

DROP TABLE IF EXISTS `payment_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_methods` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `payment_type` varchar(50) NOT NULL DEFAULT 'mobile_money',
  `merchant_number` varchar(50) NOT NULL,
  `ussd_prefix` varchar(20) NOT NULL,
  `icon_name` varchar(50) NOT NULL DEFAULT 'smartphone',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_methods`
--

LOCK TABLES `payment_methods` WRITE;
/*!40000 ALTER TABLE `payment_methods` DISABLE KEYS */;
INSERT INTO `payment_methods` VALUES ('18d1e29d-1b1e-11f1-a03a-74d83e7f7e20','EVC Plus','mobile_money','615XXXXXXX','*712#','smartphone',1,1,'2026-03-08 21:39:10','2026-03-08 21:39:10'),('18d1e74a-1b1e-11f1-a03a-74d83e7f7e20','Zaad','mobile_money','634XXXXXXX','*222#','smartphone',1,2,'2026-03-08 21:39:10','2026-03-08 21:39:10'),('18d1e8f3-1b1e-11f1-a03a-74d83e7f7e20','eDahab','mobile_money','665XXXXXXX','*663#','smartphone',1,3,'2026-03-08 21:39:10','2026-03-08 21:39:10'),('18d1e9d7-1b1e-11f1-a03a-74d83e7f7e20','Sahal','mobile_money','690XXXXXXX','*727#','smartphone',1,4,'2026-03-08 21:39:10','2026-03-08 21:39:10'),('18d1ea9e-1b1e-11f1-a03a-74d83e7f7e20','MasterCard','card','N/A','N/A','credit-card',1,5,'2026-03-08 21:39:10','2026-03-08 21:39:10'),('18d1eb64-1b1e-11f1-a03a-74d83e7f7e20','Visa','card','N/A','N/A','credit-card',1,6,'2026-03-08 21:39:10','2026-03-08 21:39:10'),('18d1ec25-1b1e-11f1-a03a-74d83e7f7e20','Bank Transfer','bank_transfer','ACCT-XXXXX','N/A','building',1,7,'2026-03-08 21:39:10','2026-03-08 21:39:10');
/*!40000 ALTER TABLE `payment_methods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profiles`
--

DROP TABLE IF EXISTS `profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `profiles` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `user_id` char(36) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'student',
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `is_parent` tinyint(1) DEFAULT '0',
  `student_level` varchar(50) DEFAULT NULL,
  `subjects_interested` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `idx_profiles_user_id` (`user_id`),
  KEY `idx_profiles_role` (`role`),
  KEY `idx_profiles_status` (`status`),
  CONSTRAINT `fk_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profiles`
--

LOCK TABLES `profiles` WRITE;
/*!40000 ALTER TABLE `profiles` DISABLE KEYS */;
INSERT INTO `profiles` VALUES ('081f6977-1b30-11f1-a03a-74d83e7f7e20','c2fcb0ba-0713-47a9-a21c-85308bae7ef0','qalintech','qalintech@gmail.com','7903635','Bosaso','student','active',0,NULL,NULL,'2026-03-08 23:47:33','2026-03-08 23:47:33');
/*!40000 ALTER TABLE `profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quiz_attempts`
--

DROP TABLE IF EXISTS `quiz_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quiz_attempts` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `quiz_id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `score` int NOT NULL DEFAULT '0',
  `passed` tinyint(1) NOT NULL DEFAULT '0',
  `answers` json NOT NULL DEFAULT (_utf8mb4'{}'),
  `completed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_attempts_quiz` (`quiz_id`),
  KEY `idx_attempts_student` (`student_id`),
  CONSTRAINT `fk_attempts_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `course_quizzes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_attempts_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quiz_attempts`
--

LOCK TABLES `quiz_attempts` WRITE;
/*!40000 ALTER TABLE `quiz_attempts` DISABLE KEYS */;
/*!40000 ALTER TABLE `quiz_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quiz_questions`
--

DROP TABLE IF EXISTS `quiz_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quiz_questions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `quiz_id` char(36) NOT NULL,
  `question_text` text NOT NULL,
  `question_type` varchar(30) NOT NULL DEFAULT 'multiple_choice',
  `options` json NOT NULL DEFAULT (_utf8mb4'[]'),
  `correct_answer` varchar(255) NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_questions_quiz` (`quiz_id`),
  CONSTRAINT `fk_questions_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `course_quizzes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quiz_questions`
--

LOCK TABLES `quiz_questions` WRITE;
/*!40000 ALTER TABLE `quiz_questions` DISABLE KEYS */;
/*!40000 ALTER TABLE `quiz_questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviews` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `tutor_id` char(36) NOT NULL,
  `student_id` char(36) NOT NULL,
  `rating` tinyint NOT NULL,
  `comment` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_review_pair` (`tutor_id`,`student_id`),
  KEY `idx_reviews_tutor` (`tutor_id`),
  KEY `idx_reviews_student` (`student_id`),
  CONSTRAINT `fk_reviews_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_tutor` FOREIGN KEY (`tutor_id`) REFERENCES `tutor_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_rating` CHECK (((`rating` >= 1) and (`rating` <= 5)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subjects`
--

DROP TABLE IF EXISTS `subjects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subjects` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subjects`
--

LOCK TABLES `subjects` WRITE;
/*!40000 ALTER TABLE `subjects` DISABLE KEYS */;
INSERT INTO `subjects` VALUES ('18caab68-1b1e-11f1-a03a-74d83e7f7e20','Mathematics','2026-03-08 21:39:10'),('18caaee2-1b1e-11f1-a03a-74d83e7f7e20','Physics','2026-03-08 21:39:10'),('18cab089-1b1e-11f1-a03a-74d83e7f7e20','Chemistry','2026-03-08 21:39:10'),('18cab180-1b1e-11f1-a03a-74d83e7f7e20','Biology','2026-03-08 21:39:10'),('18cab259-1b1e-11f1-a03a-74d83e7f7e20','English','2026-03-08 21:39:10'),('18cab32d-1b1e-11f1-a03a-74d83e7f7e20','Arabic','2026-03-08 21:39:10'),('18cab3f2-1b1e-11f1-a03a-74d83e7f7e20','Somali','2026-03-08 21:39:10'),('18cab4bf-1b1e-11f1-a03a-74d83e7f7e20','French','2026-03-08 21:39:10'),('18cab599-1b1e-11f1-a03a-74d83e7f7e20','History','2026-03-08 21:39:10'),('18cab668-1b1e-11f1-a03a-74d83e7f7e20','Geography','2026-03-08 21:39:10'),('18cab733-1b1e-11f1-a03a-74d83e7f7e20','Computer Science','2026-03-08 21:39:10'),('18cab804-1b1e-11f1-a03a-74d83e7f7e20','Economics','2026-03-08 21:39:10'),('18cab8d3-1b1e-11f1-a03a-74d83e7f7e20','Accounting','2026-03-08 21:39:10'),('18cab99e-1b1e-11f1-a03a-74d83e7f7e20','Statistics','2026-03-08 21:39:10'),('18caba6b-1b1e-11f1-a03a-74d83e7f7e20','Calculus','2026-03-08 21:39:10'),('18cabc77-1b1e-11f1-a03a-74d83e7f7e20','Literature','2026-03-08 21:39:10'),('18cabd5e-1b1e-11f1-a03a-74d83e7f7e20','Quran','2026-03-08 21:39:10'),('18cabe30-1b1e-11f1-a03a-74d83e7f7e20','Coding','2026-03-08 21:39:10');
/*!40000 ALTER TABLE `subjects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscription_plans`
--

DROP TABLE IF EXISTS `subscription_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscription_plans` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(5) NOT NULL DEFAULT 'USD',
  `period` varchar(20) NOT NULL DEFAULT 'month',
  `features` json NOT NULL DEFAULT (_utf8mb4'[]'),
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_popular` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscription_plans`
--

LOCK TABLES `subscription_plans` WRITE;
/*!40000 ALTER TABLE `subscription_plans` DISABLE KEYS */;
INSERT INTO `subscription_plans` VALUES ('18d4190a-1b1e-11f1-a03a-74d83e7f7e20','Free','Get started with basic features',0.00,'USD','month','[\"Listed in search\", \"Receive messages\", \"Up to 3 subjects\", \"Basic profile\"]',1,0,1,'2026-03-08 21:39:10','2026-03-08 21:39:10'),('18d41d69-1b1e-11f1-a03a-74d83e7f7e20','Basic Monthly','Everything you need to start tutoring',9.99,'USD','month','[\"Listed in search\", \"Receive messages\", \"Up to 5 subjects\", \"Profile analytics\", \"Create up to 5 courses\"]',1,0,2,'2026-03-08 21:39:10','2026-03-08 21:39:10'),('18d41f7d-1b1e-11f1-a03a-74d83e7f7e20','Pro Yearly','Best value — save 25% with annual billing',89.99,'USD','year','[\"Priority listing\", \"Unlimited subjects\", \"Featured badge option\", \"Advanced analytics\", \"Unlimited courses\", \"Priority support\", \"25% savings vs monthly\"]',1,1,3,'2026-03-08 21:39:10','2026-03-08 21:39:10');
/*!40000 ALTER TABLE `subscription_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subscriptions`
--

DROP TABLE IF EXISTS `subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscriptions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `tutor_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `plan` varchar(20) NOT NULL DEFAULT 'monthly',
  `status` varchar(20) NOT NULL DEFAULT 'inactive',
  `amount` decimal(10,2) DEFAULT '0.00',
  `currency` varchar(5) DEFAULT 'USD',
  `payment_method` varchar(50) DEFAULT NULL,
  `transaction_ref` varchar(255) DEFAULT NULL,
  `invoice_number` varchar(100) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_subscriptions_user_id` (`user_id`),
  KEY `idx_subscriptions_tutor_id` (`tutor_id`),
  KEY `idx_subscriptions_status` (`status`),
  CONSTRAINT `fk_subscriptions_tutor` FOREIGN KEY (`tutor_id`) REFERENCES `tutor_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_subscriptions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscriptions`
--

LOCK TABLES `subscriptions` WRITE;
/*!40000 ALTER TABLE `subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tutor_profiles`
--

DROP TABLE IF EXISTS `tutor_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tutor_profiles` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `user_id` char(36) NOT NULL,
  `bio` text,
  `education` varchar(500) DEFAULT NULL,
  `teaching_style` varchar(500) DEFAULT NULL,
  `experience_years` int DEFAULT '0',
  `gender` varchar(10) DEFAULT NULL,
  `subjects` json DEFAULT (_utf8mb4'[]'),
  `levels` json DEFAULT (_utf8mb4'[]'),
  `languages` json DEFAULT (_utf8mb4'[]'),
  `service_areas` json DEFAULT (_utf8mb4'[]'),
  `online_available` tinyint(1) DEFAULT '1',
  `offline_available` tinyint(1) DEFAULT '0',
  `online_hourly` decimal(10,2) DEFAULT '0.00',
  `offline_hourly` decimal(10,2) DEFAULT NULL,
  `currency` varchar(5) DEFAULT 'USD',
  `packages` json DEFAULT (_utf8mb4'[]'),
  `availability` json DEFAULT (_utf8mb4'[]'),
  `profile_photo_url` text,
  `verification_status` varchar(20) NOT NULL DEFAULT 'pending',
  `verified_badge` tinyint(1) DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `idx_tutor_profiles_user_id` (`user_id`),
  KEY `idx_tutor_profiles_verification` (`verification_status`),
  CONSTRAINT `fk_tutor_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tutor_profiles`
--

LOCK TABLES `tutor_profiles` WRITE;
/*!40000 ALTER TABLE `tutor_profiles` DISABLE KEYS */;
/*!40000 ALTER TABLE `tutor_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `user_id` char(36) NOT NULL,
  `role` enum('admin','moderator','user') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_role` (`user_id`,`role`),
  KEY `idx_user_roles_user` (`user_id`),
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES ('5e2aebe9-1b30-11f1-a03a-74d83e7f7e20','c2fcb0ba-0713-47a9-a21c-85308bae7ef0','admin'),('081f7ecc-1b30-11f1-a03a-74d83e7f7e20','c2fcb0ba-0713-47a9-a21c-85308bae7ef0','user');
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `verification_token` varchar(255) DEFAULT NULL,
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('c2fcb0ba-0713-47a9-a21c-85308bae7ef0','qalintech@gmail.com','$2a$10$FlXkgl0dMDWaMIR0a187JOuqE4AJTojY7V9/yRbOwGRwETNWmyCgy',1,NULL,NULL,NULL,'2026-03-08 23:47:33','2026-03-08 23:47:33');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-09  8:08:15
