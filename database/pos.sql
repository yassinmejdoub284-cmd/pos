-- MySQL dump 10.13  Distrib 8.0.36, for Linux (x86_64)
--
-- Host: localhost    Database: pos_patisserie
-- ------------------------------------------------------
-- Server version	8.0.36

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
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('8e33dd46-4ed7-4448-b971-2eba2ab37407','0cedf75c78d9b0cb5adbedeab92a1a0023893fc593b435f9100084afc896c46d','2025-09-27 18:07:03.672','20250101000000_initial_baseline',NULL,NULL,'2025-09-27 18:07:03.670',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `loyalty_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `loyalty_rate` decimal(8,3) NOT NULL DEFAULT '1.000',
  `max_discount_percent` decimal(5,2) NOT NULL DEFAULT '50.00',
  `default_client_max_debt` decimal(12,3) NOT NULL DEFAULT '0.000',
  `keyboardShortcuts` longtext COLLATE utf8mb4_unicode_ci,
  `devices_config` longtext COLLATE utf8mb4_unicode_ci,
  `audit_retention_days` int NOT NULL DEFAULT '90',
  `variance_threshold` decimal(8,3) NOT NULL DEFAULT '5.000',
  `default_fonds` decimal(12,3) NOT NULL DEFAULT '50.000',
  `denominations` longtext COLLATE utf8mb4_unicode_ci,
  `require_approval_for_variance` tinyint(1) NOT NULL DEFAULT '1',
  `ticket_width` int NOT NULL DEFAULT '58',
  `droit_de_timbre` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `company_address` text COLLATE utf8mb4_unicode_ci,
  `company_email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_mf` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_rc` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `print_settings` longtext COLLATE utf8mb4_unicode_ci,
  `is_desktop_version` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_settings`
--

LOCK TABLES `app_settings` WRITE;
/*!40000 ALTER TABLE `app_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `app_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_corrections`
--

DROP TABLE IF EXISTS `attendance_corrections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_corrections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `day_id` int NOT NULL,
  `requested_by` int NOT NULL,
  `reviewed_by` int DEFAULT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `proposed_first_in` datetime(3) DEFAULT NULL,
  `proposed_last_out` datetime(3) DEFAULT NULL,
  `proposedPauses` text COLLATE utf8mb4_unicode_ci,
  `review_notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewed_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `attendance_corrections_status_idx` (`status`),
  KEY `attendance_corrections_day_id_fkey` (`day_id`),
  KEY `attendance_corrections_requested_by_fkey` (`requested_by`),
  KEY `attendance_corrections_reviewed_by_fkey` (`reviewed_by`),
  CONSTRAINT `attendance_corrections_day_id_fkey` FOREIGN KEY (`day_id`) REFERENCES `attendance_days` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `attendance_corrections_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `attendance_corrections_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_corrections`
--

LOCK TABLES `attendance_corrections` WRITE;
/*!40000 ALTER TABLE `attendance_corrections` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_corrections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_days`
--

DROP TABLE IF EXISTS `attendance_days`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_days` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `depotId` int DEFAULT NULL,
  `date` date NOT NULL,
  `firstCheckIn` datetime(3) DEFAULT NULL,
  `lastCheckOut` datetime(3) DEFAULT NULL,
  `pausesSeconds` int NOT NULL DEFAULT '0',
  `workedSeconds` int NOT NULL DEFAULT '0',
  `overtimeSeconds` int NOT NULL DEFAULT '0',
  `isLate` tinyint(1) NOT NULL DEFAULT '0',
  `isAbsent` tinyint(1) NOT NULL DEFAULT '0',
  `isComplete` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `attendance_days_userId_date_key` (`userId`,`date`),
  KEY `attendance_days_depotId_date_idx` (`depotId`,`date`),
  CONSTRAINT `attendance_days_depotId_fkey` FOREIGN KEY (`depotId`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `attendance_days_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_days`
--

LOCK TABLES `attendance_days` WRITE;
/*!40000 ALTER TABLE `attendance_days` DISABLE KEYS */;
INSERT INTO `attendance_days` VALUES (1,4,1,'2025-09-28','2025-09-28 20:33:32.307',NULL,0,3,0,1,0,1,'2025-09-28 06:59:00.322','2025-09-28 20:33:32.315'),(2,6,2,'2025-09-28','2025-09-28 14:40:38.915','2025-09-28 14:40:48.574',0,9,0,1,0,1,'2025-09-28 14:40:38.924','2025-09-28 14:40:48.583'),(3,7,4,'2025-09-28','2025-09-28 14:49:28.551',NULL,0,9,0,1,0,1,'2025-09-28 14:40:58.850','2025-09-28 14:49:28.560'),(4,4,1,'2025-09-29','2025-09-29 11:10:35.164',NULL,0,0,0,1,0,0,'2025-09-29 11:10:35.175','2025-09-29 11:10:35.175');
/*!40000 ALTER TABLE `attendance_days` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_punches`
--

DROP TABLE IF EXISTS `attendance_punches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_punches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `type` enum('CHECK_IN','CHECK_OUT','PAUSE_START','PAUSE_END') COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `attendance_punches_userId_timestamp_idx` (`userId`,`timestamp`),
  CONSTRAINT `attendance_punches_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_punches`
--

LOCK TABLES `attendance_punches` WRITE;
/*!40000 ALTER TABLE `attendance_punches` DISABLE KEYS */;
INSERT INTO `attendance_punches` VALUES (1,4,'CHECK_IN','2025-09-28 05:59:00','SYSTEM','2025-09-28 06:59:00.312'),(2,4,'CHECK_OUT','2025-09-28 06:00:38','SYSTEM','2025-09-28 07:00:37.639'),(3,4,'CHECK_IN','2025-09-28 06:01:35','SYSTEM','2025-09-28 07:01:35.185'),(4,4,'CHECK_OUT','2025-09-28 06:11:38','SYSTEM','2025-09-28 07:11:38.060'),(5,4,'CHECK_IN','2025-09-28 06:11:41','SYSTEM','2025-09-28 07:11:41.119'),(6,4,'CHECK_OUT','2025-09-28 06:20:04','SYSTEM','2025-09-28 07:20:03.768'),(7,4,'CHECK_IN','2025-09-28 06:20:11','SYSTEM','2025-09-28 07:20:11.432'),(8,4,'CHECK_IN','2025-09-28 06:20:20','SYSTEM','2025-09-28 07:20:20.314'),(9,4,'CHECK_OUT','2025-09-28 06:20:29','SYSTEM','2025-09-28 07:20:29.482'),(10,4,'CHECK_IN','2025-09-28 06:20:35','SYSTEM','2025-09-28 07:20:35.321'),(11,4,'CHECK_IN','2025-09-28 06:32:49','SYSTEM','2025-09-28 07:32:48.775'),(12,4,'CHECK_IN','2025-09-28 07:41:50','SYSTEM','2025-09-28 08:41:50.357'),(13,4,'CHECK_IN','2025-09-28 07:43:45','SYSTEM','2025-09-28 08:43:44.879'),(14,4,'CHECK_IN','2025-09-28 08:15:30','SYSTEM','2025-09-28 09:15:29.612'),(15,4,'CHECK_IN','2025-09-28 08:23:16','SYSTEM','2025-09-28 09:23:15.519'),(16,4,'CHECK_IN','2025-09-28 13:40:28','SYSTEM','2025-09-28 14:40:27.662'),(17,4,'CHECK_OUT','2025-09-28 13:40:32','SYSTEM','2025-09-28 14:40:32.094'),(18,6,'CHECK_IN','2025-09-28 13:40:39','SYSTEM','2025-09-28 14:40:38.916'),(19,6,'CHECK_OUT','2025-09-28 13:40:49','SYSTEM','2025-09-28 14:40:48.575'),(20,7,'CHECK_IN','2025-09-28 13:40:59','SYSTEM','2025-09-28 14:40:58.844'),(21,7,'CHECK_OUT','2025-09-28 13:41:08','SYSTEM','2025-09-28 14:41:07.934'),(22,7,'CHECK_IN','2025-09-28 13:41:13','SYSTEM','2025-09-28 14:41:13.027'),(23,7,'CHECK_IN','2025-09-28 13:44:09','SYSTEM','2025-09-28 14:44:09.145'),(24,7,'CHECK_IN','2025-09-28 13:45:21','SYSTEM','2025-09-28 14:45:21.491'),(25,7,'CHECK_IN','2025-09-28 13:48:08','SYSTEM','2025-09-28 14:48:07.514'),(26,4,'CHECK_IN','2025-09-28 13:49:21','SYSTEM','2025-09-28 14:49:20.648'),(27,4,'CHECK_OUT','2025-09-28 13:49:24','SYSTEM','2025-09-28 14:49:24.003'),(28,7,'CHECK_IN','2025-09-28 13:49:29','SYSTEM','2025-09-28 14:49:28.551'),(29,4,'CHECK_IN','2025-09-28 19:33:32','SYSTEM','2025-09-28 20:33:32.308'),(30,4,'CHECK_IN','2025-09-29 10:10:35','SYSTEM','2025-09-29 11:10:35.164');
/*!40000 ALTER TABLE `attendance_punches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` int NOT NULL,
  `action` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_values` longtext COLLATE utf8mb4_unicode_ci,
  `new_values` longtext COLLATE utf8mb4_unicode_ci,
  `user_id` int NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id_fkey` (`user_id`),
  CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=59 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,'attendance_punches',1,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T06:59:00.310Z\"}',4,NULL,NULL,'2025-09-28 06:59:00.329'),(2,'attendance_punches',2,'CREATE',NULL,'{\"type\":\"CHECK_OUT\",\"timestamp\":\"2025-09-28T07:00:37.639Z\"}',4,NULL,NULL,'2025-09-28 07:00:37.654'),(3,'attendance_punches',3,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T07:01:35.184Z\"}',4,NULL,NULL,'2025-09-28 07:01:35.197'),(4,'session_caisse',1,'CREATE',NULL,'{\"posId\":1,\"openingFund\":\"0\",\"note\":\"Session automatique\"}',4,NULL,NULL,'2025-09-28 07:05:59.739'),(5,'attendance_punches',4,'CREATE',NULL,'{\"type\":\"CHECK_OUT\",\"timestamp\":\"2025-09-28T07:11:38.059Z\"}',4,NULL,NULL,'2025-09-28 07:11:38.075'),(6,'attendance_punches',5,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T07:11:41.118Z\"}',4,NULL,NULL,'2025-09-28 07:11:41.130'),(7,'attendance_punches',6,'CREATE',NULL,'{\"type\":\"CHECK_OUT\",\"timestamp\":\"2025-09-28T07:20:03.767Z\"}',4,NULL,NULL,'2025-09-28 07:20:03.784'),(8,'attendance_punches',7,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T07:20:11.431Z\"}',4,NULL,NULL,'2025-09-28 07:20:11.443'),(9,'attendance_punches',8,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T07:20:20.313Z\"}',4,NULL,NULL,'2025-09-28 07:20:20.327'),(10,'session_caisse',2,'CREATE',NULL,'{\"posId\":1,\"openingFund\":\"0\",\"note\":\"Session automatique\"}',4,NULL,NULL,'2025-09-28 07:20:20.796'),(11,'attendance_punches',9,'CREATE',NULL,'{\"type\":\"CHECK_OUT\",\"timestamp\":\"2025-09-28T07:20:29.481Z\"}',4,NULL,NULL,'2025-09-28 07:20:29.492'),(12,'attendance_punches',10,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T07:20:35.320Z\"}',4,NULL,NULL,'2025-09-28 07:20:35.335'),(13,'products',30,'UPDATE','{\"id\":30,\"name\":\"EAU 0.5L\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.391Z\",\"updatedAt\":\"2025-09-28T07:10:31.323Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"0.6\",\"tva\":\"0\",\"unite\":\"NON\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":1,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":false,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":7,\"designation_legale\":null,\"prix_achat\":\"0.45\"}','{\"photo\":\"http://localhost:3255/uploads/products/product-1759044666765-270237641_medium.webp\"}',4,NULL,NULL,'2025-09-28 07:31:07.035'),(14,'products',30,'UPDATE','{\"id\":30,\"name\":\"EAU 0.5L\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.391Z\",\"updatedAt\":\"2025-09-28T07:31:07.028Z\",\"duree_conservation\":null,\"photo\":\"http://localhost:3255/uploads/products/product-1759044666765-270237641_medium.webp\",\"prix_vente_TTC\":\"0.6\",\"tva\":\"0\",\"unite\":\"NON\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":1,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":false,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":7,\"designation_legale\":null,\"prix_achat\":\"0.45\"}','{\"photo\":\"https://otrity.com/wp-content/uploads/2020/09/eau-minerale-7.webp\"}',4,NULL,NULL,'2025-09-28 07:31:59.703'),(15,'attendance_punches',11,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T07:32:48.774Z\"}',4,NULL,NULL,'2025-09-28 07:32:48.792'),(16,'products',72,'UPDATE','{\"id\":72,\"name\":\"VERRE GRANITE\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.438Z\",\"updatedAt\":\"2025-09-28T07:10:31.324Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"2.5\",\"tva\":\"0.19\",\"unite\":\"NON\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":2,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":false,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":14,\"designation_legale\":null,\"prix_achat\":\"0.85\"}','{\"photo\":\"https://iceloops.com/wp-content/uploads/2021/09/granite.png\"}',4,NULL,NULL,'2025-09-28 07:34:00.065'),(17,'products',65,'UPDATE','{\"id\":65,\"name\":\"PETIT FOUR\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.429Z\",\"updatedAt\":\"2025-09-28T07:10:31.325Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"18\",\"tva\":\"0.07\",\"unite\":\"1\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":9,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":true,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":16,\"designation_legale\":null,\"prix_achat\":\"12\"}','{\"photo\":\"https://recette4saisons.fr/wp-content/uploads/2023/10/petit-au-four.png\"}',4,NULL,NULL,'2025-09-28 07:34:35.703'),(18,'products',66,'UPDATE','{\"id\":66,\"name\":\"SABLE\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.430Z\",\"updatedAt\":\"2025-09-28T07:10:31.324Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"18\",\"tva\":\"0.07\",\"unite\":\"1\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":7,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":true,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":17,\"designation_legale\":null,\"prix_achat\":\"10\"}','{\"photo\":\"https://recette4saisons.fr/wp-content/uploads/2023/10/ezgif.com-webp-maker-5.webp\"}',4,NULL,NULL,'2025-09-28 07:35:00.867'),(19,'stock_documents',1,'CREATE',NULL,'{\"id\":1,\"numero\":\"BEXP-202509-1052\",\"type\":\"BON_EXPEDITION\",\"status\":\"PREPARED\",\"emetteurId\":1,\"destinataireId\":3,\"notes\":null,\"createdAt\":\"2025-09-28T07:36:31.150Z\",\"updatedAt\":\"2025-09-28T07:36:31.150Z\",\"emetteur\":{\"id\":1,\"name\":\"Dépôt Principal Sfax\",\"code\":\"SFX-MAIN\",\"type\":\"MAIN\",\"address\":\"123 Rue de la Liberté\",\"city\":\"Sfax\",\"phone\":\"+216 74 123 456\",\"email\":\"sfax@patisserie.tn\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T18:07:19.743Z\",\"updatedAt\":\"2025-09-27T18:07:19.743Z\",\"companyId\":null},\"destinataire\":{\"id\":3,\"name\":\"Boutique Centre Ville\",\"code\":\"SHOP-CV\",\"type\":\"SHOP\",\"address\":\"789 Place de la République\",\"city\":\"Sfax\",\"phone\":\"+216 74 345 678\",\"email\":\"shop@patisserie.tn\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T18:07:19.743Z\",\"updatedAt\":\"2025-09-27T21:12:45.279Z\",\"companyId\":null},\"items\":[{\"id\":1,\"documentId\":1,\"productId\":9,\"famille\":\"SCAN\",\"quantity\":\"0.564\",\"batch\":null,\"notes\":null,\"barcode\":null,\"purchasePrice\":null,\"count\":1,\"montantHT\":\"0\",\"montantTTC\":\"0\",\"montantTVA\":\"0\",\"prixUnitaire\":\"0\",\"tva\":\"19\",\"product\":{\"id\":9,\"name\":\"CHAHRAZED 2 KG FS\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.370Z\",\"updatedAt\":\"2025-09-28T06:32:30.370Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"54\",\"tva\":\"0.19\",\"unite\":\"NON\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":null,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":false,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":2,\"designation_legale\":null,\"prix_achat\":\"43.407\"}}]}',4,NULL,NULL,'2025-09-28 07:36:31.175'),(20,'products',41,'UPDATE','{\"id\":41,\"name\":\"HLOU LOUZ\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.402Z\",\"updatedAt\":\"2025-09-28T07:10:31.327Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"58\",\"tva\":\"0.07\",\"unite\":\"1\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":10,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":true,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":12,\"designation_legale\":null,\"prix_achat\":\"42\"}','{\"photo\":\"https://static.vecteezy.com/system/resources/thumbnails/012/596/329/small/almond-nut-with-leaves-png.png\"}',4,NULL,NULL,'2025-09-28 07:36:31.821'),(21,'products',39,'UPDATE','{\"id\":39,\"name\":\"HLOU ARBI\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.400Z\",\"updatedAt\":\"2025-09-28T07:10:31.328Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"18\",\"tva\":\"0.07\",\"unite\":\"1\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":16,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":true,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":10,\"designation_legale\":null,\"prix_achat\":\"12\"}','{\"photo\":\"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-v8cl9Ia-BcUiFzpyKDqZybVxu3f2h0EAoE_MVT97FCEG63_TDe3Us6FsLLAtIuX3oVw&usqp=CAU\"}',4,NULL,NULL,'2025-09-28 07:39:03.702'),(22,'products',40,'UPDATE','{\"id\":40,\"name\":\"HLOU KAKAWIA\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.402Z\",\"updatedAt\":\"2025-09-28T07:10:31.324Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"30\",\"tva\":\"0.07\",\"unite\":\"1\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":5,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":true,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":11,\"designation_legale\":null,\"prix_achat\":\"22\"}','{\"photo\":\"https://freepngimg.com/thumb/peanut/4-2-peanut-transparent-thumb.png\"}',4,NULL,NULL,'2025-09-28 07:40:21.191'),(23,'products',29,'UPDATE','{\"id\":29,\"name\":\"CROCANT\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.390Z\",\"updatedAt\":\"2025-09-28T07:40:33.288Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"12\",\"tva\":\"0.07\",\"unite\":\"1\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":25,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":true,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":4,\"designation_legale\":null,\"prix_achat\":\"9\"}','{\"photo\":\"https://recette4saisons.fr/wp-content/uploads/2023/10/CROQUANT.png\"}',4,NULL,NULL,'2025-09-28 07:44:28.716'),(24,'products',3,'UPDATE','{\"id\":3,\"name\":\"ARGENT\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.363Z\",\"updatedAt\":\"2025-09-28T07:40:33.289Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"1\",\"tva\":\"0\",\"unite\":\"NON\",\"isStockable\":false,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":26,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":false,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":1,\"designation_legale\":null,\"prix_achat\":\"1\"}','{\"photo\":\"https://www.changedelabourse.com/1124-large_default/dinar-tunisien-tnd.webp\"}',4,NULL,NULL,'2025-09-28 07:46:42.182'),(25,'products',3,'UPDATE','{\"id\":3,\"name\":\"ARGENT\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.363Z\",\"updatedAt\":\"2025-09-28T07:46:42.177Z\",\"duree_conservation\":null,\"photo\":\"https://www.changedelabourse.com/1124-large_default/dinar-tunisien-tnd.webp\",\"prix_vente_TTC\":\"1\",\"tva\":\"0\",\"unite\":\"NON\",\"isStockable\":false,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":26,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":false,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":1,\"designation_legale\":null,\"prix_achat\":\"1\"}','{\"photo\":\"https://image.winudf.com/v2/image/dHVuX2RpbmFycy5maWtyYV9wbHVzcGx1cy5jb20udHVuZGluYXJzX2ljb25fMF9jZmM5ZTcxMw/icon.png?w=140&fakeurl=1\"}',4,NULL,NULL,'2025-09-28 07:48:57.143'),(26,'products',3,'UPDATE','{\"id\":3,\"name\":\"ARGENT\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.363Z\",\"updatedAt\":\"2025-09-28T07:48:57.135Z\",\"duree_conservation\":null,\"photo\":\"https://image.winudf.com/v2/image/dHVuX2RpbmFycy5maWtyYV9wbHVzcGx1cy5jb20udHVuZGluYXJzX2ljb25fMF9jZmM5ZTcxMw/icon.png?w=140&fakeurl=1\",\"prix_vente_TTC\":\"1\",\"tva\":\"0\",\"unite\":\"NON\",\"isStockable\":false,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":26,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":false,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":1,\"designation_legale\":null,\"prix_achat\":\"1\"}','{\"photo\":\"https://www.changedelabourse.com/1126-thickbox_default/dinar-tunisien-tnd.jpg\"}',4,NULL,NULL,'2025-09-28 07:49:42.048'),(27,'products',54,'UPDATE','{\"id\":54,\"name\":\"LOUZIA\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.415Z\",\"updatedAt\":\"2025-09-28T07:40:33.287Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"1.2\",\"tva\":\"0.07\",\"unite\":\"NON\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":12,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":false,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":16,\"designation_legale\":null,\"prix_achat\":\"0.7\"}','{\"photo\":\"https://www.geantdrive.tn/tunis-city/1220534-home_default/tarte-amandine-6-8-parts.jpg\"}',4,NULL,NULL,'2025-09-28 07:51:04.085'),(28,'stock_documents',2,'CREATE',NULL,'{\"id\":2,\"numero\":\"BEXP-202509-6056\",\"type\":\"BON_EXPEDITION\",\"status\":\"PREPARED\",\"emetteurId\":1,\"destinataireId\":3,\"notes\":null,\"createdAt\":\"2025-09-28T07:53:06.184Z\",\"updatedAt\":\"2025-09-28T07:53:06.184Z\",\"emetteur\":{\"id\":1,\"name\":\"Dépôt Principal Sfax\",\"code\":\"SFX-MAIN\",\"type\":\"MAIN\",\"address\":\"123 Rue de la Liberté\",\"city\":\"Sfax\",\"phone\":\"+216 74 123 456\",\"email\":\"sfax@patisserie.tn\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T18:07:19.743Z\",\"updatedAt\":\"2025-09-28T07:50:36.868Z\",\"companyId\":1},\"destinataire\":{\"id\":3,\"name\":\"Boutique Centre Ville\",\"code\":\"SHOP-CV\",\"type\":\"SHOP\",\"address\":\"789 Place de la République\",\"city\":\"Sfax\",\"phone\":\"+216 74 345 678\",\"email\":\"shop@patisserie.tn\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T18:07:19.743Z\",\"updatedAt\":\"2025-09-28T07:50:36.868Z\",\"companyId\":1},\"items\":[{\"id\":2,\"documentId\":2,\"productId\":8,\"famille\":\"SCAN\",\"quantity\":\"0.1\",\"batch\":null,\"notes\":null,\"barcode\":null,\"purchasePrice\":null,\"count\":10,\"montantHT\":\"0\",\"montantTTC\":\"0\",\"montantTVA\":\"0\",\"prixUnitaire\":\"0\",\"tva\":\"19\",\"product\":{\"id\":8,\"name\":\"CHAHRAZED 2 KG AM COLORE MET\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.369Z\",\"updatedAt\":\"2025-09-28T06:32:30.369Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"37\",\"tva\":\"0.19\",\"unite\":\"NON\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":null,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":false,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":2,\"designation_legale\":null,\"prix_achat\":\"31.82\"}}]}',4,NULL,NULL,'2025-09-28 07:53:06.202'),(29,'stock_documents',3,'CREATE',NULL,'{\"id\":3,\"numero\":\"BT-202509-3202\",\"type\":\"BON_TRANSFERT\",\"status\":\"PREPARED\",\"emetteurId\":1,\"destinataireId\":2,\"notes\":null,\"createdAt\":\"2025-09-28T07:57:03.276Z\",\"updatedAt\":\"2025-09-28T07:57:03.276Z\",\"emetteur\":{\"id\":1,\"name\":\"Dépôt Principal Sfax\",\"code\":\"SFX-MAIN\",\"type\":\"MAIN\",\"address\":\"123 Rue de la Liberté\",\"city\":\"Sfax\",\"phone\":\"+216 74 123 456\",\"email\":\"sfax@patisserie.tn\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T18:07:19.743Z\",\"updatedAt\":\"2025-09-28T07:50:36.868Z\",\"companyId\":1},\"destinataire\":{\"id\":2,\"name\":\"Dépôt Tunis\",\"code\":\"TUN-BRANCH\",\"type\":\"BRANCH\",\"address\":\"456 Avenue Habib Bourguiba\",\"city\":\"Tunis\",\"phone\":\"+216 71 234 567\",\"email\":\"tunis@patisserie.tn\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T18:07:19.743Z\",\"updatedAt\":\"2025-09-28T07:50:26.587Z\",\"companyId\":2},\"items\":[{\"id\":3,\"documentId\":3,\"productId\":7,\"famille\":\"SCAN\",\"quantity\":\"1.46\",\"batch\":null,\"notes\":null,\"barcode\":null,\"purchasePrice\":null,\"count\":1,\"montantHT\":\"36.807\",\"montantTTC\":\"43.8\",\"montantTVA\":\"6.993\",\"prixUnitaire\":\"30\",\"tva\":\"19\",\"product\":{\"id\":7,\"name\":\"CHAHRAZED 2 KG AM\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.368Z\",\"updatedAt\":\"2025-09-28T06:32:30.368Z\",\"duree_conservation\":null,\"photo\":null,\"prix_vente_TTC\":\"34.5\",\"tva\":\"0.19\",\"unite\":\"NON\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":null,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":false,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":2,\"designation_legale\":null,\"prix_achat\":\"29.67\"}}]}',4,NULL,NULL,'2025-09-28 07:57:03.291'),(30,'inventory_sessions',1,'CREATE',NULL,'{\"id\":1,\"numero\":\"INV-20250928-0911\",\"depotId\":3,\"status\":\"DRAFT\",\"startedBy\":4,\"closedBy\":null,\"postedBy\":null,\"startedAt\":\"2025-09-28T08:11:49.481Z\",\"closedAt\":null,\"postedAt\":null,\"notes\":null,\"totalEcartValue\":null,\"totalEcartQty\":null,\"createdAt\":\"2025-09-28T08:11:49.481Z\",\"updatedAt\":\"2025-09-28T08:11:49.481Z\"}',4,NULL,NULL,'2025-09-28 08:11:49.489'),(31,'inventory_items',1,'CREATE',NULL,'{\"id\":1,\"sessionId\":1,\"productId\":40,\"theoreticalQuantity\":\"0\",\"countedQuantity\":null,\"ecartQuantity\":null,\"ecartValue\":null,\"reason\":\"PHYSICAL_COUNT_DIFFERENCE\",\"notes\":null,\"countedAt\":null,\"countedBy\":null,\"createdAt\":\"2025-09-28T08:12:15.362Z\",\"updatedAt\":\"2025-09-28T08:12:15.362Z\",\"product\":{\"id\":40,\"name\":\"HLOU KAKAWIA\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.402Z\",\"updatedAt\":\"2025-09-28T07:51:09.669Z\",\"duree_conservation\":null,\"photo\":\"https://freepngimg.com/thumb/peanut/4-2-peanut-transparent-thumb.png\",\"prix_vente_TTC\":\"30\",\"tva\":\"0.07\",\"unite\":\"1\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":4,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":true,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":11,\"designation_legale\":null,\"prix_achat\":\"22\",\"famille\":{\"id\":11,\"name\":\"HLOU KAKAWIA\",\"description\":null,\"photo\":null,\"isActive\":true,\"createdAt\":\"2025-09-28T06:32:21.882Z\",\"updatedAt\":\"2025-09-28T07:11:32.230Z\"}}}',4,NULL,NULL,'2025-09-28 08:12:15.369'),(32,'inventory_items',1,'UPDATE','{\"id\":1,\"sessionId\":1,\"productId\":40,\"theoreticalQuantity\":\"0\",\"countedQuantity\":null,\"ecartQuantity\":null,\"ecartValue\":null,\"reason\":\"PHYSICAL_COUNT_DIFFERENCE\",\"notes\":null,\"countedAt\":null,\"countedBy\":null,\"createdAt\":\"2025-09-28T08:12:15.362Z\",\"updatedAt\":\"2025-09-28T08:12:15.362Z\",\"product\":{\"id\":40,\"name\":\"HLOU KAKAWIA\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.402Z\",\"updatedAt\":\"2025-09-28T07:51:09.669Z\",\"duree_conservation\":null,\"photo\":\"https://freepngimg.com/thumb/peanut/4-2-peanut-transparent-thumb.png\",\"prix_vente_TTC\":\"30\",\"tva\":\"0.07\",\"unite\":\"1\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":4,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":true,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":11,\"designation_legale\":null,\"prix_achat\":\"22\"}}','{\"id\":1,\"sessionId\":1,\"productId\":40,\"theoreticalQuantity\":\"0\",\"countedQuantity\":\"20\",\"ecartQuantity\":\"20\",\"ecartValue\":\"600\",\"reason\":\"PHYSICAL_COUNT_DIFFERENCE\",\"notes\":\"PA=0;PV=0\",\"countedAt\":\"2025-09-28T08:12:15.483Z\",\"countedBy\":4,\"createdAt\":\"2025-09-28T08:12:15.362Z\",\"updatedAt\":\"2025-09-28T08:12:15.485Z\",\"product\":{\"id\":40,\"name\":\"HLOU KAKAWIA\",\"barcode\":null,\"unite\":\"1\",\"prix_vente_TTC\":\"30\",\"famille\":{\"name\":\"HLOU KAKAWIA\"}},\"counter\":{\"firstName\":\"Admin\",\"lastName\":\"Principal\",\"username\":\"admin\"}}',4,NULL,NULL,'2025-09-28 08:12:15.496'),(33,'inventory_sessions',1,'UPDATE','{\"id\":1,\"numero\":\"INV-20250928-0911\",\"depotId\":3,\"status\":\"DRAFT\",\"startedBy\":4,\"closedBy\":null,\"postedBy\":null,\"startedAt\":\"2025-09-28T08:11:49.481Z\",\"closedAt\":null,\"postedAt\":null,\"notes\":null,\"totalEcartValue\":null,\"totalEcartQty\":null,\"createdAt\":\"2025-09-28T08:11:49.481Z\",\"updatedAt\":\"2025-09-28T08:11:49.481Z\",\"items\":[{\"id\":1,\"sessionId\":1,\"productId\":40,\"theoreticalQuantity\":\"0\",\"countedQuantity\":\"20\",\"ecartQuantity\":\"20\",\"ecartValue\":\"600\",\"reason\":\"PHYSICAL_COUNT_DIFFERENCE\",\"notes\":\"PA=0;PV=0\",\"countedAt\":\"2025-09-28T08:12:15.483Z\",\"countedBy\":4,\"createdAt\":\"2025-09-28T08:12:15.362Z\",\"updatedAt\":\"2025-09-28T08:12:15.485Z\"}]}','{\"id\":1,\"numero\":\"INV-20250928-0911\",\"depotId\":3,\"status\":\"CLOSED\",\"startedBy\":4,\"closedBy\":4,\"postedBy\":null,\"startedAt\":\"2025-09-28T08:11:49.481Z\",\"closedAt\":\"2025-09-28T08:12:21.379Z\",\"postedAt\":null,\"notes\":null,\"totalEcartValue\":null,\"totalEcartQty\":null,\"createdAt\":\"2025-09-28T08:11:49.481Z\",\"updatedAt\":\"2025-09-28T08:12:21.380Z\"}',4,NULL,NULL,'2025-09-28 08:12:21.388'),(34,'inventory_sessions',1,'UPDATE','{\"id\":1,\"numero\":\"INV-20250928-0911\",\"depotId\":3,\"status\":\"CLOSED\",\"startedBy\":4,\"closedBy\":4,\"postedBy\":null,\"startedAt\":\"2025-09-28T08:11:49.481Z\",\"closedAt\":\"2025-09-28T08:12:21.379Z\",\"postedAt\":null,\"notes\":null,\"totalEcartValue\":null,\"totalEcartQty\":null,\"createdAt\":\"2025-09-28T08:11:49.481Z\",\"updatedAt\":\"2025-09-28T08:12:21.380Z\",\"items\":[{\"id\":1,\"sessionId\":1,\"productId\":40,\"theoreticalQuantity\":\"0\",\"countedQuantity\":\"20\",\"ecartQuantity\":\"20\",\"ecartValue\":\"600\",\"reason\":\"PHYSICAL_COUNT_DIFFERENCE\",\"notes\":\"PA=0;PV=0\",\"countedAt\":\"2025-09-28T08:12:15.483Z\",\"countedBy\":4,\"createdAt\":\"2025-09-28T08:12:15.362Z\",\"updatedAt\":\"2025-09-28T08:12:15.485Z\",\"product\":{\"id\":40,\"name\":\"HLOU KAKAWIA\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.402Z\",\"updatedAt\":\"2025-09-28T07:51:09.669Z\",\"duree_conservation\":null,\"photo\":\"https://freepngimg.com/thumb/peanut/4-2-peanut-transparent-thumb.png\",\"prix_vente_TTC\":\"30\",\"tva\":\"0.07\",\"unite\":\"1\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":4,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":true,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":11,\"designation_legale\":null,\"prix_achat\":\"22\"}}]}','{\"id\":1,\"numero\":\"INV-20250928-0911\",\"depotId\":3,\"status\":\"POSTED\",\"startedBy\":4,\"closedBy\":4,\"postedBy\":4,\"startedAt\":\"2025-09-28T08:11:49.481Z\",\"closedAt\":\"2025-09-28T08:12:21.379Z\",\"postedAt\":\"2025-09-28T08:12:21.519Z\",\"notes\":null,\"totalEcartValue\":\"600\",\"totalEcartQty\":\"20\",\"createdAt\":\"2025-09-28T08:11:49.481Z\",\"updatedAt\":\"2025-09-28T08:12:21.520Z\"}',4,NULL,NULL,'2025-09-28 08:12:21.537'),(35,'stock_documents',4,'CREATE',NULL,'{\"id\":4,\"numero\":\"BED-202509-5137\",\"type\":\"BON_ENTREE_DEPOT\",\"status\":\"RECEIVED\",\"emetteurId\":4,\"destinataireId\":4,\"notes\":null,\"createdAt\":\"2025-09-28T08:17:05.141Z\",\"updatedAt\":\"2025-09-28T08:17:05.141Z\",\"emetteur\":{\"id\":4,\"name\":\"Boutique Ariana\",\"code\":\"002\",\"type\":\"SHOP\",\"address\":\"Avenue sidi Ammar Ariana Tunis\",\"city\":\"TUNIS ARIANA\",\"phone\":\"22 212 319\",\"email\":\"groupehentati.contact@gmail.com\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T21:09:50.321Z\",\"updatedAt\":\"2025-09-28T07:50:26.587Z\",\"companyId\":2},\"destinataire\":{\"id\":4,\"name\":\"Boutique Ariana\",\"code\":\"002\",\"type\":\"SHOP\",\"address\":\"Avenue sidi Ammar Ariana Tunis\",\"city\":\"TUNIS ARIANA\",\"phone\":\"22 212 319\",\"email\":\"groupehentati.contact@gmail.com\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T21:09:50.321Z\",\"updatedAt\":\"2025-09-28T07:50:26.587Z\",\"companyId\":2},\"items\":[{\"id\":4,\"documentId\":4,\"productId\":40,\"famille\":\"HLOU KAKAWIA\",\"quantity\":\"10\",\"batch\":null,\"notes\":null,\"barcode\":null,\"purchasePrice\":\"22\",\"count\":1,\"montantHT\":null,\"montantTTC\":null,\"montantTVA\":null,\"prixUnitaire\":null,\"tva\":\"19\",\"product\":{\"id\":40,\"name\":\"HLOU KAKAWIA\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.402Z\",\"updatedAt\":\"2025-09-28T07:51:09.669Z\",\"duree_conservation\":null,\"photo\":\"https://freepngimg.com/thumb/peanut/4-2-peanut-transparent-thumb.png\",\"prix_vente_TTC\":\"30\",\"tva\":\"0.07\",\"unite\":\"1\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":4,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":true,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":11,\"designation_legale\":null,\"prix_achat\":\"22\"}}]}',4,NULL,NULL,'2025-09-28 08:17:05.163'),(36,'stock_documents',5,'CREATE',NULL,'{\"id\":5,\"numero\":\"BED-202509-8298\",\"type\":\"BON_ENTREE_DEPOT\",\"status\":\"RECEIVED\",\"emetteurId\":4,\"destinataireId\":4,\"notes\":\"Supplier:1\",\"createdAt\":\"2025-09-28T08:18:48.301Z\",\"updatedAt\":\"2025-09-28T08:18:48.301Z\",\"emetteur\":{\"id\":4,\"name\":\"Boutique Ariana\",\"code\":\"002\",\"type\":\"SHOP\",\"address\":\"Avenue sidi Ammar Ariana Tunis\",\"city\":\"TUNIS ARIANA\",\"phone\":\"22 212 319\",\"email\":\"groupehentati.contact@gmail.com\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T21:09:50.321Z\",\"updatedAt\":\"2025-09-28T07:50:26.587Z\",\"companyId\":2},\"destinataire\":{\"id\":4,\"name\":\"Boutique Ariana\",\"code\":\"002\",\"type\":\"SHOP\",\"address\":\"Avenue sidi Ammar Ariana Tunis\",\"city\":\"TUNIS ARIANA\",\"phone\":\"22 212 319\",\"email\":\"groupehentati.contact@gmail.com\",\"managerId\":null,\"isActive\":true,\"createdAt\":\"2025-09-27T21:09:50.321Z\",\"updatedAt\":\"2025-09-28T07:50:26.587Z\",\"companyId\":2},\"items\":[{\"id\":5,\"documentId\":5,\"productId\":41,\"famille\":\"HLOU LOUZ\",\"quantity\":\"20\",\"batch\":null,\"notes\":null,\"barcode\":null,\"purchasePrice\":\"42\",\"count\":1,\"montantHT\":null,\"montantTTC\":null,\"montantTVA\":null,\"prixUnitaire\":null,\"tva\":\"19\",\"product\":{\"id\":41,\"name\":\"HLOU LOUZ\",\"description\":null,\"barcode\":null,\"createdAt\":\"2025-09-28T06:32:30.402Z\",\"updatedAt\":\"2025-09-28T07:51:09.669Z\",\"duree_conservation\":null,\"photo\":\"https://static.vecteezy.com/system/resources/thumbnails/012/596/329/small/almond-nut-with-leaves-png.png\",\"prix_vente_TTC\":\"58\",\"tva\":\"0.07\",\"unite\":\"1\",\"isStockable\":true,\"originalProductId\":null,\"isVrac\":false,\"displayIndex\":3,\"bundlePrice\":null,\"bundleSize\":null,\"isWholesale\":true,\"minMargin\":null,\"requiresApproval\":false,\"familleId\":12,\"designation_legale\":null,\"prix_achat\":\"42\"}}]}',4,NULL,NULL,'2025-09-28 08:18:48.320'),(37,'attendance_punches',12,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T08:41:50.357Z\"}',4,NULL,NULL,'2025-09-28 08:41:50.372'),(38,'attendance_punches',13,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T08:43:44.878Z\"}',4,NULL,NULL,'2025-09-28 08:43:44.890'),(39,'attendance_punches',14,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T09:15:29.611Z\"}',4,NULL,NULL,'2025-09-28 09:15:29.628'),(40,'attendance_punches',15,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T09:23:15.518Z\"}',4,NULL,NULL,'2025-09-28 09:23:15.534'),(41,'attendance_punches',16,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T14:40:27.661Z\"}',4,NULL,NULL,'2025-09-28 14:40:27.684'),(42,'attendance_punches',17,'CREATE',NULL,'{\"type\":\"CHECK_OUT\",\"timestamp\":\"2025-09-28T14:40:32.093Z\"}',4,NULL,NULL,'2025-09-28 14:40:32.107'),(43,'attendance_punches',18,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T14:40:38.915Z\"}',6,NULL,NULL,'2025-09-28 14:40:38.931'),(44,'attendance_punches',19,'CREATE',NULL,'{\"type\":\"CHECK_OUT\",\"timestamp\":\"2025-09-28T14:40:48.574Z\"}',6,NULL,NULL,'2025-09-28 14:40:48.588'),(45,'attendance_punches',20,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T14:40:58.843Z\"}',7,NULL,NULL,'2025-09-28 14:40:58.855'),(46,'session_caisse',3,'CREATE',NULL,'{\"posId\":1,\"openingFund\":\"0\",\"note\":\"Session automatique\"}',7,NULL,NULL,'2025-09-28 14:40:59.951'),(47,'attendance_punches',21,'CREATE',NULL,'{\"type\":\"CHECK_OUT\",\"timestamp\":\"2025-09-28T14:41:07.933Z\"}',7,NULL,NULL,'2025-09-28 14:41:07.947'),(48,'attendance_punches',22,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T14:41:13.026Z\"}',7,NULL,NULL,'2025-09-28 14:41:13.039'),(49,'attendance_punches',23,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T14:44:09.144Z\"}',7,NULL,NULL,'2025-09-28 14:44:09.161'),(50,'attendance_punches',24,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T14:45:21.490Z\"}',7,NULL,NULL,'2025-09-28 14:45:21.503'),(51,'attendance_punches',25,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T14:48:07.513Z\"}',7,NULL,NULL,'2025-09-28 14:48:07.532'),(52,'attendance_punches',26,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T14:49:20.647Z\"}',4,NULL,NULL,'2025-09-28 14:49:20.659'),(53,'attendance_punches',27,'CREATE',NULL,'{\"type\":\"CHECK_OUT\",\"timestamp\":\"2025-09-28T14:49:24.002Z\"}',4,NULL,NULL,'2025-09-28 14:49:24.017'),(54,'attendance_punches',28,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T14:49:28.551Z\"}',7,NULL,NULL,'2025-09-28 14:49:28.566'),(55,'attendance_punches',29,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-28T20:33:32.307Z\"}',4,NULL,NULL,'2025-09-28 20:33:32.319'),(56,'attendance_punches',30,'CREATE',NULL,'{\"type\":\"CHECK_IN\",\"timestamp\":\"2025-09-29T11:10:35.164Z\"}',4,NULL,NULL,'2025-09-29 11:10:35.181'),(57,'session_caisse',1,'CREATE',NULL,'{\"posId\":1,\"openingFund\":\"0\",\"note\":\"Session automatique\"}',4,NULL,NULL,'2025-09-29 11:24:53.735'),(58,'session_caisse',1,'CREATE',NULL,'{\"posId\":1,\"openingFund\":\"0\",\"note\":\"Session automatique\"}',4,NULL,NULL,'2025-09-29 11:27:03.755');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cash_movements`
--

DROP TABLE IF EXISTS `cash_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_movements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` int NOT NULL,
  `type` enum('ENTREE','SORTIE','DEPOT_COFFRE','RETRAIT_CENTRALE','AJUSTEMENT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,3) NOT NULL,
  `reason` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ticket_id` int DEFAULT NULL,
  `created_by_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `cash_movements_created_by_id_fkey` (`created_by_id`),
  KEY `cash_movements_session_id_fkey` (`session_id`),
  CONSTRAINT `cash_movements_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `cash_movements_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `session_caisse` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cash_movements`
--

LOCK TABLES `cash_movements` WRITE;
/*!40000 ALTER TABLE `cash_movements` DISABLE KEYS */;
/*!40000 ALTER TABLE `cash_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `change_requests`
--

DROP TABLE IF EXISTS `change_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `change_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int NOT NULL,
  `entity_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `requested_by` int NOT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `rejection_notes` text COLLATE utf8mb4_unicode_ci,
  `rejection_reason_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `change_requests_approved_by_fkey` (`approved_by`),
  KEY `change_requests_requested_by_fkey` (`requested_by`),
  CONSTRAINT `change_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `change_requests_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `change_requests`
--

LOCK TABLES `change_requests` WRITE;
/*!40000 ALTER TABLE `change_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `change_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `client_debt_transactions`
--

DROP TABLE IF EXISTS `client_debt_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_debt_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `sale_id` int DEFAULT NULL,
  `amount` decimal(12,3) NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `user_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `client_debt_transactions_client_id_fkey` (`client_id`),
  KEY `client_debt_transactions_sale_id_fkey` (`sale_id`),
  KEY `client_debt_transactions_user_id_fkey` (`user_id`),
  CONSTRAINT `client_debt_transactions_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `client_debt_transactions_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `client_debt_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `client_debt_transactions`
--

LOCK TABLES `client_debt_transactions` WRITE;
/*!40000 ALTER TABLE `client_debt_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `client_debt_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `city` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `birthday` date DEFAULT NULL,
  `client_type` enum('INDIVIDUAL','BUSINESS','WHOLESALE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INDIVIDUAL',
  `loyalty_points` int NOT NULL DEFAULT '0',
  `total_spent` decimal(12,3) NOT NULL DEFAULT '0.000',
  `favorite_products` text COLLATE utf8mb4_unicode_ci,
  `allergies` text COLLATE utf8mb4_unicode_ci,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `age_group` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `allow_debt` tinyint(1) NOT NULL DEFAULT '1',
  `current_debt` decimal(12,3) NOT NULL DEFAULT '0.000',
  `max_debt` decimal(12,3) DEFAULT NULL,
  `depot_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clients_code_key` (`code`),
  UNIQUE KEY `clients_email_key` (`email`),
  KEY `clients_depot_id_fkey` (`depot_id`),
  CONSTRAINT `clients_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clients`
--

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
INSERT INTO `clients` VALUES (1,'CLI0001','Chawki','Hentati',NULL,'','','Tunis',NULL,NULL,'INDIVIDUAL',0,58.000,NULL,NULL,'',1,'2025-09-28 09:19:20.811','2025-09-28 09:20:11.704',NULL,1,0.000,NULL,4);
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companies`
--

DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `raisonSociale` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `formeJuridique` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activite` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dateCreation` datetime(3) DEFAULT NULL,
  `logoUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brandColor` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `statut` enum('ACTIF','ARCHIVE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIF',
  `adresse` text COLLATE utf8mb4_unicode_ci,
  `ville` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delegation` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gouvernorat` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `codePostal` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telephone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `siteWeb` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `matriculeFiscal` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rne` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registreCommerce` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tvaAssujetti` tinyint(1) NOT NULL DEFAULT '0',
  `numeroTva` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tauxTva` decimal(5,2) NOT NULL DEFAULT '19.00',
  `capitalSocial` decimal(14,3) NOT NULL DEFAULT '0.000',
  `representantNom` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `representantCin` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rib` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banque` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bic` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companies`
--

LOCK TABLES `companies` WRITE;
/*!40000 ALTER TABLE `companies` DISABLE KEYS */;
INSERT INTO `companies` VALUES (1,'SOCIETE PATISSERIE HENTATI','SARL','','2025-09-28 00:00:00.000','/uploads/logos/logo-1759045412531-707364921.png','#3B82F6','ACTIF','SOUK OMRAN BEB JEBLI SFAX ','SFAX','SFAX','SFAX','3000','22212319','','','1151916J/P/M/000','1151916J','1151916J',1,'',19.00,0.000,'','','','','','2025-09-28 07:44:58.917','2025-09-28 07:44:58.917'),(2,'STE HENTATI FRERES DISTRIBUTION','SARL','','2025-09-28 00:00:00.000','','#3B82F6','ACTIF','ROUTE AIN KM 2 IM NOUR HOUDA SFAX','','','','','22212319','','','1920243W/N/M/000','1920243W','',0,'',19.00,0.000,'','','','','','2025-09-28 07:47:48.198','2025-09-28 07:47:48.198');
/*!40000 ALTER TABLE `companies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `depots`
--

DROP TABLE IF EXISTS `depots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `depots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('MAIN','BRANCH','SHOP','WAREHOUSE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `manager_id` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `company_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `depots_code_key` (`code`),
  UNIQUE KEY `depots_manager_id_key` (`manager_id`),
  KEY `depots_company_id_fkey` (`company_id`),
  CONSTRAINT `depots_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `depots_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `depots`
--

LOCK TABLES `depots` WRITE;
/*!40000 ALTER TABLE `depots` DISABLE KEYS */;
INSERT INTO `depots` VALUES (1,'Dépôt Principal Sfax','SFX-MAIN','MAIN','123 Rue de la Liberté','Sfax','+216 74 123 456','sfax@patisserie.tn',NULL,1,'2025-09-27 18:07:19.743','2025-09-28 07:50:36.868',1),(2,'Dépôt Tunis','TUN-BRANCH','BRANCH','456 Avenue Habib Bourguiba','Tunis','+216 71 234 567','tunis@patisserie.tn',NULL,1,'2025-09-27 18:07:19.743','2025-09-28 07:50:26.587',2),(3,'Boutique Centre Ville','SHOP-CV','SHOP','789 Place de la République','Sfax','+216 74 345 678','shop@patisserie.tn',NULL,1,'2025-09-27 18:07:19.743','2025-09-28 07:50:36.868',1),(4,'Boutique Ariana','002','SHOP','Avenue sidi Ammar Ariana Tunis','TUNIS ARIANA','22 212 319','groupehentati.contact@gmail.com',NULL,1,'2025-09-27 21:09:50.321','2025-09-28 07:50:26.587',2);
/*!40000 ALTER TABLE `depots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `document_status_history`
--

DROP TABLE IF EXISTS `document_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_status_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` int NOT NULL,
  `status` enum('PREPARED','SENT','RECEIVED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `document_status_history_document_id_fkey` (`document_id`),
  KEY `document_status_history_user_id_fkey` (`user_id`),
  CONSTRAINT `document_status_history_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `stock_documents` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `document_status_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_status_history`
--

LOCK TABLES `document_status_history` WRITE;
/*!40000 ALTER TABLE `document_status_history` DISABLE KEYS */;
INSERT INTO `document_status_history` VALUES (1,1,'PREPARED',4,'Document créé par scan','2025-09-28 07:36:31.150'),(2,2,'PREPARED',4,'Document créé par scan','2025-09-28 07:53:06.184'),(3,3,'PREPARED',4,'Document créé par scan','2025-09-28 07:57:03.276'),(4,4,'RECEIVED',4,'Bon d\'entrée fournisseur','2025-09-28 08:17:05.141'),(5,5,'RECEIVED',4,'Bon d\'entrée fournisseur','2025-09-28 08:18:48.301');
/*!40000 ALTER TABLE `document_status_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `drivers`
--

DROP TABLE IF EXISTS `drivers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `drivers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prenom` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cin` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `licenseNumber` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `licenseExpiry` datetime(3) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `depot_id` int DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `drivers_cin_key` (`cin`),
  KEY `drivers_depot_id_fkey` (`depot_id`),
  CONSTRAINT `drivers_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drivers`
--

LOCK TABLES `drivers` WRITE;
/*!40000 ALTER TABLE `drivers` DISABLE KEYS */;
INSERT INTO `drivers` VALUES (1,'safi','Med','11111111',NULL,NULL,NULL,NULL,NULL,1,1,'2025-09-28 07:21:07.212','2025-09-28 07:21:07.212');
/*!40000 ALTER TABLE `drivers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expense_categories`
--

DROP TABLE IF EXISTS `expense_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expense_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `color` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expense_categories`
--

LOCK TABLES `expense_categories` WRITE;
/*!40000 ALTER TABLE `expense_categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `expense_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expenses`
--

DROP TABLE IF EXISTS `expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `amount` decimal(10,2) NOT NULL,
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` int NOT NULL,
  `depot_id` int NOT NULL,
  `user_id` int NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `receipt_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `is_approved` tinyint(1) NOT NULL DEFAULT '0',
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `collection_date` datetime(3) DEFAULT NULL,
  `payment_type` enum('CASH','CHECK','BANK_TRANSFER','WIRE_TRANSFER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CASH',
  `due_date` datetime(3) DEFAULT NULL,
  `is_paid` tinyint(1) NOT NULL DEFAULT '0',
  `paid_at` datetime(3) DEFAULT NULL,
  `paid_by` int DEFAULT NULL,
  `supplier_id` int DEFAULT NULL,
  `is_advance` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `expenses_approved_by_fkey` (`approved_by`),
  KEY `expenses_category_id_fkey` (`category_id`),
  KEY `expenses_depot_id_fkey` (`depot_id`),
  KEY `expenses_paid_by_fkey` (`paid_by`),
  KEY `expenses_supplier_id_fkey` (`supplier_id`),
  KEY `expenses_user_id_fkey` (`user_id`),
  CONSTRAINT `expenses_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `expenses_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `expenses_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `expenses_paid_by_fkey` FOREIGN KEY (`paid_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `expenses_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `expenses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenses`
--

LOCK TABLES `expenses` WRITE;
/*!40000 ALTER TABLE `expenses` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory`
--

DROP TABLE IF EXISTS `inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory` (
  `id` int NOT NULL AUTO_INCREMENT,
  `depot_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` decimal(10,3) NOT NULL DEFAULT '0.000',
  `reserved_quantity` decimal(10,3) NOT NULL DEFAULT '0.000',
  `last_updated` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_depot_id_product_id_key` (`depot_id`,`product_id`),
  KEY `inventory_product_id_fkey` (`product_id`),
  CONSTRAINT `inventory_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory`
--

LOCK TABLES `inventory` WRITE;
/*!40000 ALTER TABLE `inventory` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_items`
--

DROP TABLE IF EXISTS `inventory_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` int NOT NULL,
  `product_id` int NOT NULL,
  `theoretical_quantity` decimal(10,3) NOT NULL,
  `counted_quantity` decimal(10,3) DEFAULT NULL,
  `ecart_quantity` decimal(10,3) DEFAULT NULL,
  `ecart_value` decimal(12,3) DEFAULT NULL,
  `reason` enum('PHYSICAL_COUNT_DIFFERENCE','SUSPICION_OF_ANOMALY') COLLATE utf8mb4_unicode_ci DEFAULT 'PHYSICAL_COUNT_DIFFERENCE',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `counted_at` datetime(3) DEFAULT NULL,
  `counted_by` int DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_items_session_id_product_id_key` (`session_id`,`product_id`),
  KEY `inventory_items_counted_by_fkey` (`counted_by`),
  KEY `inventory_items_product_id_fkey` (`product_id`),
  CONSTRAINT `inventory_items_counted_by_fkey` FOREIGN KEY (`counted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_items_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `inventory_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_items`
--

LOCK TABLES `inventory_items` WRITE;
/*!40000 ALTER TABLE `inventory_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_sessions`
--

DROP TABLE IF EXISTS `inventory_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `numero` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `depot_id` int NOT NULL,
  `status` enum('DRAFT','IN_PROGRESS','CLOSED','POSTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `started_by` int NOT NULL,
  `closed_by` int DEFAULT NULL,
  `posted_by` int DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `closed_at` datetime(3) DEFAULT NULL,
  `posted_at` datetime(3) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `total_ecart_value` decimal(12,3) DEFAULT NULL,
  `total_ecart_qty` decimal(10,3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_sessions_numero_key` (`numero`),
  KEY `inventory_sessions_closed_by_fkey` (`closed_by`),
  KEY `inventory_sessions_depot_id_fkey` (`depot_id`),
  KEY `inventory_sessions_posted_by_fkey` (`posted_by`),
  KEY `inventory_sessions_started_by_fkey` (`started_by`),
  CONSTRAINT `inventory_sessions_closed_by_fkey` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_sessions_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_sessions_posted_by_fkey` FOREIGN KEY (`posted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_sessions_started_by_fkey` FOREIGN KEY (`started_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_sessions`
--

LOCK TABLES `inventory_sessions` WRITE;
/*!40000 ALTER TABLE `inventory_sessions` DISABLE KEYS */;
INSERT INTO `inventory_sessions` VALUES (1,'INV-20250928-0911',3,'POSTED',4,4,4,'2025-09-28 08:11:49.481','2025-09-28 08:12:21.379','2025-09-28 08:12:21.519',NULL,600.000,20.000,'2025-09-28 08:11:49.481','2025-09-28 08:12:21.520');
/*!40000 ALTER TABLE `inventory_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_lines`
--

DROP TABLE IF EXISTS `invoice_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `product_id` int NOT NULL,
  `famille_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `legal_designation` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unite` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `prix_vente_ttc` decimal(10,2) NOT NULL,
  `prix_vente_htva` decimal(10,2) NOT NULL,
  `tva_percent` decimal(5,2) NOT NULL,
  `montant_tva` decimal(10,2) NOT NULL,
  `sous_total_ttc` decimal(10,2) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `invoice_lines_invoice_id_fkey` (`invoice_id`),
  KEY `invoice_lines_product_id_fkey` (`product_id`),
  CONSTRAINT `invoice_lines_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `invoice_lines_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_lines`
--

LOCK TABLES `invoice_lines` WRITE;
/*!40000 ALTER TABLE `invoice_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoice_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_requests`
--

DROP TABLE IF EXISTS `invoice_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `status` enum('PENDING','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `invoice_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sale_id` int NOT NULL,
  `requested_by_id` int NOT NULL,
  `approved_by_id` int DEFAULT NULL,
  `approved_at` datetime(3) DEFAULT NULL,
  `invoice_id` int DEFAULT NULL,
  `request_notes` text COLLATE utf8mb4_unicode_ci,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_requests_invoice_id_key` (`invoice_id`),
  KEY `invoice_requests_approved_by_id_fkey` (`approved_by_id`),
  KEY `invoice_requests_requested_by_id_fkey` (`requested_by_id`),
  KEY `invoice_requests_sale_id_fkey` (`sale_id`),
  CONSTRAINT `invoice_requests_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoice_requests_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoice_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `invoice_requests_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_requests`
--

LOCK TABLES `invoice_requests` WRITE;
/*!40000 ALTER TABLE `invoice_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoice_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('DRAFT','ISSUED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `source` enum('DAILY_EXTRACT','TICKET_REQUEST') COLLATE utf8mb4_unicode_ci NOT NULL,
  `issue_date` datetime(3) NOT NULL,
  `due_date` datetime(3) DEFAULT NULL,
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `company_address` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `company_matricule` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_address` text COLLATE utf8mb4_unicode_ci,
  `customer_matricule` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subtotal_htva` decimal(12,3) NOT NULL,
  `total_tva` decimal(12,3) NOT NULL,
  `total_ttc` decimal(12,3) NOT NULL,
  `amount_in_words` text COLLATE utf8mb4_unicode_ci,
  `depot_id` int NOT NULL,
  `client_id` int DEFAULT NULL,
  `created_by_id` int NOT NULL,
  `sale_id` int DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `quantity_note` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `company_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoices_invoice_number_key` (`invoice_number`),
  KEY `invoices_client_id_fkey` (`client_id`),
  KEY `invoices_company_id_fkey` (`company_id`),
  KEY `invoices_created_by_id_fkey` (`created_by_id`),
  KEY `invoices_depot_id_fkey` (`depot_id`),
  KEY `invoices_sale_id_fkey` (`sale_id`),
  CONSTRAINT `invoices_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoices_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoices_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `invoices_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `invoices_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` longtext COLLATE utf8mb4_unicode_ci,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_fkey` (`user_id`),
  CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `outbox`
--

DROP TABLE IF EXISTS `outbox`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `outbox` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `aggregate_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_data` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','PROCESSING','COMPLETED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `retry_count` int NOT NULL DEFAULT '0',
  `last_attempt` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `processed_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `outbox`
--

LOCK TABLES `outbox` WRITE;
/*!40000 ALTER TABLE `outbox` DISABLE KEYS */;
/*!40000 ALTER TABLE `outbox` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_methods`
--

DROP TABLE IF EXISTS `payment_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_methods` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('CASH','CARD','MOBILE','BANK_TRANSFER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_methods`
--

LOCK TABLES `payment_methods` WRITE;
/*!40000 ALTER TABLE `payment_methods` DISABLE KEYS */;
INSERT INTO `payment_methods` VALUES (1,'Espèces','CASH',1,'2025-09-27 18:07:19.914'),(2,'Carte Bancaire','CARD',1,'2025-09-27 18:07:19.915'),(3,'Mobile Money','MOBILE',1,'2025-09-27 18:07:19.917'),(4,'Virement Bancaire','BANK_TRANSFER',1,'2025-09-27 18:07:19.919');
/*!40000 ALTER TABLE `payment_methods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_conservation`
--

DROP TABLE IF EXISTS `product_conservation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_conservation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `depot_id` int NOT NULL,
  `batch_quantity` decimal(10,3) NOT NULL,
  `remaining_quantity` decimal(10,3) NOT NULL,
  `production_date` datetime(3) NOT NULL,
  `expiration_date` datetime(3) NOT NULL,
  `is_expired` tinyint(1) NOT NULL DEFAULT '0',
  `is_warning_shown` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `product_conservation_depot_id_fkey` (`depot_id`),
  KEY `product_conservation_product_id_fkey` (`product_id`),
  CONSTRAINT `product_conservation_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_conservation_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_conservation`
--

LOCK TABLES `product_conservation` WRITE;
/*!40000 ALTER TABLE `product_conservation` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_conservation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_depots`
--

DROP TABLE IF EXISTS `product_depots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_depots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `depot_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_depots_product_id_depot_id_key` (`product_id`,`depot_id`),
  KEY `product_depots_product_id_fkey` (`product_id`),
  KEY `product_depots_depot_id_fkey` (`depot_id`),
  CONSTRAINT `product_depots_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_depots_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=135 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_depots`
--

LOCK TABLES `product_depots` WRITE;
/*!40000 ALTER TABLE `product_depots` DISABLE KEYS */;
INSERT INTO `product_depots` VALUES (1,1,1,'2025-09-28 06:33:28.700','2025-09-28 06:33:28.700'),(2,1,2,'2025-09-28 06:33:28.707','2025-09-28 06:33:28.707'),(3,1,3,'2025-09-28 06:33:28.708','2025-09-28 06:33:28.708'),(4,1,4,'2025-09-28 06:33:28.710','2025-09-28 06:33:28.710'),(5,2,1,'2025-09-28 06:33:28.710','2025-09-28 06:33:28.710'),(6,2,2,'2025-09-28 06:33:28.711','2025-09-28 06:33:28.711'),(7,2,3,'2025-09-28 06:33:28.712','2025-09-28 06:33:28.712'),(8,2,4,'2025-09-28 06:33:28.712','2025-09-28 06:33:28.712'),(9,3,3,'2025-09-28 06:33:28.713','2025-09-28 06:33:28.713'),(10,3,4,'2025-09-28 06:33:28.714','2025-09-28 06:33:28.714'),(11,4,3,'2025-09-28 06:33:28.714','2025-09-28 06:33:28.714'),(12,5,3,'2025-09-28 06:33:28.715','2025-09-28 06:33:28.715'),(13,6,3,'2025-09-28 06:33:28.716','2025-09-28 06:33:28.716'),(14,7,3,'2025-09-28 06:33:28.716','2025-09-28 06:33:28.716'),(15,8,3,'2025-09-28 06:33:28.717','2025-09-28 06:33:28.717'),(16,9,3,'2025-09-28 06:33:28.717','2025-09-28 06:33:28.717'),(17,10,3,'2025-09-28 06:33:28.718','2025-09-28 06:33:28.718'),(18,11,3,'2025-09-28 06:33:28.719','2025-09-28 06:33:28.719'),(19,12,3,'2025-09-28 06:33:28.719','2025-09-28 06:33:28.719'),(20,13,3,'2025-09-28 06:33:28.720','2025-09-28 06:33:28.720'),(21,14,3,'2025-09-28 06:33:28.720','2025-09-28 06:33:28.720'),(22,15,3,'2025-09-28 06:33:28.721','2025-09-28 06:33:28.721'),(23,16,3,'2025-09-28 06:33:28.722','2025-09-28 06:33:28.722'),(24,17,3,'2025-09-28 06:33:28.722','2025-09-28 06:33:28.722'),(25,18,3,'2025-09-28 06:33:28.723','2025-09-28 06:33:28.723'),(26,19,3,'2025-09-28 06:33:28.725','2025-09-28 06:33:28.725'),(27,20,3,'2025-09-28 06:33:28.726','2025-09-28 06:33:28.726'),(28,21,3,'2025-09-28 06:33:28.727','2025-09-28 06:33:28.727'),(29,22,3,'2025-09-28 06:33:28.727','2025-09-28 06:33:28.727'),(30,23,3,'2025-09-28 06:33:28.728','2025-09-28 06:33:28.728'),(31,24,3,'2025-09-28 06:33:28.729','2025-09-28 06:33:28.729'),(32,25,3,'2025-09-28 06:33:28.730','2025-09-28 06:33:28.730'),(33,26,3,'2025-09-28 06:33:28.731','2025-09-28 06:33:28.731'),(34,27,3,'2025-09-28 06:33:28.732','2025-09-28 06:33:28.732'),(35,28,3,'2025-09-28 06:33:28.733','2025-09-28 06:33:28.733'),(36,29,1,'2025-09-28 06:33:28.733','2025-09-28 06:33:28.733'),(37,29,2,'2025-09-28 06:33:28.734','2025-09-28 06:33:28.734'),(38,29,3,'2025-09-28 06:33:28.735','2025-09-28 06:33:28.735'),(39,29,4,'2025-09-28 06:33:28.736','2025-09-28 06:33:28.736'),(40,30,2,'2025-09-28 06:33:28.736','2025-09-28 06:33:28.736'),(41,30,3,'2025-09-28 06:33:28.737','2025-09-28 06:33:28.737'),(42,30,4,'2025-09-28 06:33:28.738','2025-09-28 06:33:28.738'),(43,31,2,'2025-09-28 06:33:28.738','2025-09-28 06:33:28.738'),(44,31,3,'2025-09-28 06:33:28.739','2025-09-28 06:33:28.739'),(45,31,4,'2025-09-28 06:33:28.740','2025-09-28 06:33:28.740'),(46,32,1,'2025-09-28 06:33:28.740','2025-09-28 06:33:28.740'),(47,32,2,'2025-09-28 06:33:28.741','2025-09-28 06:33:28.741'),(48,32,3,'2025-09-28 06:33:28.742','2025-09-28 06:33:28.742'),(49,32,4,'2025-09-28 06:33:28.742','2025-09-28 06:33:28.742'),(50,33,3,'2025-09-28 06:33:28.743','2025-09-28 06:33:28.743'),(51,34,3,'2025-09-28 06:33:28.744','2025-09-28 06:33:28.744'),(52,35,3,'2025-09-28 06:33:28.745','2025-09-28 06:33:28.745'),(53,36,3,'2025-09-28 06:33:28.746','2025-09-28 06:33:28.746'),(54,37,3,'2025-09-28 06:33:28.746','2025-09-28 06:33:28.746'),(55,38,3,'2025-09-28 06:33:28.747','2025-09-28 06:33:28.747'),(56,39,1,'2025-09-28 06:33:28.748','2025-09-28 06:33:28.748'),(57,39,2,'2025-09-28 06:33:28.749','2025-09-28 06:33:28.749'),(58,39,3,'2025-09-28 06:33:28.750','2025-09-28 06:33:28.750'),(59,39,4,'2025-09-28 06:33:28.750','2025-09-28 06:33:28.750'),(60,40,1,'2025-09-28 06:33:28.751','2025-09-28 06:33:28.751'),(61,40,2,'2025-09-28 06:33:28.752','2025-09-28 06:33:28.752'),(62,40,3,'2025-09-28 06:33:28.753','2025-09-28 06:33:28.753'),(63,40,4,'2025-09-28 06:33:28.754','2025-09-28 06:33:28.754'),(64,41,1,'2025-09-28 06:33:28.754','2025-09-28 06:33:28.754'),(65,41,2,'2025-09-28 06:33:28.755','2025-09-28 06:33:28.755'),(66,41,3,'2025-09-28 06:33:28.756','2025-09-28 06:33:28.756'),(67,41,4,'2025-09-28 06:33:28.757','2025-09-28 06:33:28.757'),(68,42,2,'2025-09-28 06:33:28.757','2025-09-28 06:33:28.757'),(69,42,3,'2025-09-28 06:33:28.758','2025-09-28 06:33:28.758'),(70,42,4,'2025-09-28 06:33:28.759','2025-09-28 06:33:28.759'),(71,43,2,'2025-09-28 06:33:28.760','2025-09-28 06:33:28.760'),(72,43,3,'2025-09-28 06:33:28.760','2025-09-28 06:33:28.760'),(73,43,4,'2025-09-28 06:33:28.761','2025-09-28 06:33:28.761'),(74,44,2,'2025-09-28 06:33:28.762','2025-09-28 06:33:28.762'),(75,44,3,'2025-09-28 06:33:28.763','2025-09-28 06:33:28.763'),(76,44,4,'2025-09-28 06:33:28.763','2025-09-28 06:33:28.763'),(77,45,2,'2025-09-28 06:33:28.764','2025-09-28 06:33:28.764'),(78,45,3,'2025-09-28 06:33:28.765','2025-09-28 06:33:28.765'),(79,45,4,'2025-09-28 06:33:28.766','2025-09-28 06:33:28.766'),(80,46,2,'2025-09-28 06:33:28.767','2025-09-28 06:33:28.767'),(81,46,3,'2025-09-28 06:33:28.767','2025-09-28 06:33:28.767'),(82,46,4,'2025-09-28 06:33:28.768','2025-09-28 06:33:28.768'),(83,47,2,'2025-09-28 06:33:28.769','2025-09-28 06:33:28.769'),(84,47,3,'2025-09-28 06:33:28.770','2025-09-28 06:33:28.770'),(85,47,4,'2025-09-28 06:33:28.771','2025-09-28 06:33:28.771'),(86,48,2,'2025-09-28 06:33:28.772','2025-09-28 06:33:28.772'),(87,48,3,'2025-09-28 06:33:28.772','2025-09-28 06:33:28.772'),(88,48,4,'2025-09-28 06:33:28.773','2025-09-28 06:33:28.773'),(89,49,2,'2025-09-28 06:33:28.774','2025-09-28 06:33:28.774'),(90,49,3,'2025-09-28 06:33:28.775','2025-09-28 06:33:28.775'),(91,49,4,'2025-09-28 06:33:28.776','2025-09-28 06:33:28.776'),(92,50,2,'2025-09-28 06:33:28.776','2025-09-28 06:33:28.776'),(93,50,3,'2025-09-28 06:33:28.777','2025-09-28 06:33:28.777'),(94,50,4,'2025-09-28 06:33:28.778','2025-09-28 06:33:28.778'),(95,51,2,'2025-09-28 06:33:28.779','2025-09-28 06:33:28.779'),(96,51,3,'2025-09-28 06:33:28.779','2025-09-28 06:33:28.779'),(97,51,4,'2025-09-28 06:33:28.780','2025-09-28 06:33:28.780'),(98,52,2,'2025-09-28 06:33:28.781','2025-09-28 06:33:28.781'),(99,52,3,'2025-09-28 06:33:28.781','2025-09-28 06:33:28.781'),(100,52,4,'2025-09-28 06:33:28.782','2025-09-28 06:33:28.782'),(101,53,2,'2025-09-28 06:33:28.783','2025-09-28 06:33:28.783'),(102,53,3,'2025-09-28 06:33:28.784','2025-09-28 06:33:28.784'),(103,53,4,'2025-09-28 06:33:28.784','2025-09-28 06:33:28.784'),(104,54,1,'2025-09-28 06:33:28.785','2025-09-28 06:33:28.785'),(105,54,2,'2025-09-28 06:33:28.786','2025-09-28 06:33:28.786'),(106,54,3,'2025-09-28 06:33:28.787','2025-09-28 06:33:28.787'),(107,54,4,'2025-09-28 06:33:28.787','2025-09-28 06:33:28.787'),(108,55,3,'2025-09-28 06:33:28.788','2025-09-28 06:33:28.788'),(109,56,3,'2025-09-28 06:33:28.789','2025-09-28 06:33:28.789'),(110,57,3,'2025-09-28 06:33:28.790','2025-09-28 06:33:28.790'),(111,58,3,'2025-09-28 06:33:28.791','2025-09-28 06:33:28.791'),(112,59,3,'2025-09-28 06:33:28.792','2025-09-28 06:33:28.792'),(113,60,3,'2025-09-28 06:33:28.792','2025-09-28 06:33:28.792'),(114,61,3,'2025-09-28 06:33:28.793','2025-09-28 06:33:28.793'),(115,62,3,'2025-09-28 06:33:28.794','2025-09-28 06:33:28.794'),(116,63,3,'2025-09-28 06:33:28.795','2025-09-28 06:33:28.795'),(117,64,3,'2025-09-28 06:33:28.796','2025-09-28 06:33:28.796'),(118,65,1,'2025-09-28 06:33:28.796','2025-09-28 06:33:28.796'),(119,65,2,'2025-09-28 06:33:28.797','2025-09-28 06:33:28.797'),(120,65,3,'2025-09-28 06:33:28.798','2025-09-28 06:33:28.798'),(121,65,4,'2025-09-28 06:33:28.799','2025-09-28 06:33:28.799'),(122,66,1,'2025-09-28 06:33:28.800','2025-09-28 06:33:28.800'),(123,66,2,'2025-09-28 06:33:28.800','2025-09-28 06:33:28.800'),(124,66,3,'2025-09-28 06:33:28.801','2025-09-28 06:33:28.801'),(125,66,4,'2025-09-28 06:33:28.802','2025-09-28 06:33:28.802'),(126,67,3,'2025-09-28 06:33:28.803','2025-09-28 06:33:28.803'),(127,68,3,'2025-09-28 06:33:28.803','2025-09-28 06:33:28.803'),(128,69,3,'2025-09-28 06:33:28.804','2025-09-28 06:33:28.804'),(129,70,3,'2025-09-28 06:33:28.804','2025-09-28 06:33:28.804'),(130,70,4,'2025-09-28 06:33:28.805','2025-09-28 06:33:28.805'),(131,71,3,'2025-09-28 06:33:28.806','2025-09-28 06:33:28.806'),(132,71,4,'2025-09-28 06:33:28.806','2025-09-28 06:33:28.806'),(133,72,3,'2025-09-28 06:33:28.807','2025-09-28 06:33:28.807'),(134,72,4,'2025-09-28 06:33:28.808','2025-09-28 06:33:28.808');
/*!40000 ALTER TABLE `product_depots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_families`
--

DROP TABLE IF EXISTS `product_families`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_families` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `photo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_families_name_key` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_families`
--

LOCK TABLES `product_families` WRITE;
/*!40000 ALTER TABLE `product_families` DISABLE KEYS */;
INSERT INTO `product_families` VALUES (1,'ARGENT',NULL,NULL,1,'2025-09-28 06:32:21.755','2025-09-28 06:32:21.755'),(2,'CHAHRAZED',NULL,NULL,1,'2025-09-28 06:32:21.776','2025-09-28 06:32:21.776'),(3,'CHEMIA VRAC',NULL,NULL,1,'2025-09-28 06:32:21.789','2025-09-28 06:32:21.789'),(4,'CROCANT',NULL,NULL,1,'2025-09-28 06:32:21.802','2025-09-28 07:11:32.161'),(5,'DECHET KAKAWIA',NULL,NULL,1,'2025-09-28 06:32:21.814','2025-09-28 07:11:32.180'),(6,'DECHET LOUZ',NULL,NULL,1,'2025-09-28 06:32:21.826','2025-09-28 07:11:32.193'),(7,'EAU',NULL,NULL,1,'2025-09-28 06:32:21.838','2025-09-28 06:32:21.838'),(8,'GATEAUX SOWABAA',NULL,NULL,1,'2025-09-28 06:32:21.849','2025-09-28 07:11:32.205'),(9,'HALKOUM',NULL,NULL,1,'2025-09-28 06:32:21.859','2025-09-28 06:32:21.859'),(10,'HLOU ARBI',NULL,NULL,1,'2025-09-28 06:32:21.871','2025-09-28 07:11:32.217'),(11,'HLOU KAKAWIA',NULL,NULL,1,'2025-09-28 06:32:21.882','2025-09-28 07:11:32.230'),(12,'HLOU LOUZ',NULL,NULL,1,'2025-09-28 06:32:21.893','2025-09-28 07:11:32.242'),(13,'JUS',NULL,NULL,1,'2025-09-28 06:32:21.905','2025-09-28 06:32:21.905'),(14,'JUS VRAC',NULL,NULL,1,'2025-09-28 06:32:21.915','2025-09-28 06:32:21.915'),(15,'NA3OURA',NULL,NULL,1,'2025-09-28 06:32:21.928','2025-09-28 06:32:21.928'),(16,'PETIT FOUR',NULL,NULL,1,'2025-09-28 06:32:21.941','2025-09-28 07:11:32.255'),(17,'SABLE',NULL,NULL,1,'2025-09-28 06:32:21.952','2025-09-28 07:11:32.267');
/*!40000 ALTER TABLE `product_families` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `barcode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `duree_conservation` int DEFAULT NULL,
  `photo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prix_vente_ttc` decimal(10,2) NOT NULL,
  `tva` decimal(5,2) NOT NULL DEFAULT '19.00',
  `unite` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pcs',
  `is_stockable` tinyint(1) NOT NULL DEFAULT '1',
  `original_product_id` int DEFAULT NULL,
  `is_vrac` tinyint(1) NOT NULL DEFAULT '0',
  `display_index` int DEFAULT NULL,
  `bundle_price` decimal(10,2) DEFAULT NULL,
  `bundle_size` int DEFAULT NULL,
  `is_wholesale` tinyint(1) NOT NULL DEFAULT '0',
  `min_margin` decimal(5,2) DEFAULT NULL,
  `requires_approval` tinyint(1) NOT NULL DEFAULT '0',
  `famille_id` int NOT NULL,
  `designation_legale` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prix_achat` decimal(10,3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_barcode_key` (`barcode`),
  KEY `products_famille_id_fkey` (`famille_id`),
  KEY `products_original_product_id_fkey` (`original_product_id`),
  CONSTRAINT `products_famille_id_fkey` FOREIGN KEY (`famille_id`) REFERENCES `product_families` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `products_original_product_id_fkey` FOREIGN KEY (`original_product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=73 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'AJNAB BAKLAWA KAKAWIA',NULL,NULL,'2025-09-28 06:32:30.353','2025-09-28 08:24:14.208',NULL,NULL,12.00,0.07,'NON',1,NULL,0,28,NULL,NULL,0,NULL,0,5,NULL,9.000),(2,'AJNAB BAKLAWA LOUZ',NULL,NULL,'2025-09-28 06:32:30.362','2025-09-28 08:24:14.208',NULL,NULL,24.00,0.07,'NON',1,NULL,0,27,NULL,NULL,0,NULL,0,6,NULL,17.000),(3,'ARGENT',NULL,NULL,'2025-09-28 06:32:30.363','2025-09-28 08:24:14.208',NULL,'https://www.changedelabourse.com/1126-thickbox_default/dinar-tunisien-tnd.jpg',1.00,0.00,'NON',0,NULL,0,26,NULL,NULL,0,NULL,0,1,NULL,1.000),(4,'CHAHRAZED 1.7 KG AM',NULL,NULL,'2025-09-28 06:32:30.365','2025-09-28 06:32:30.365',NULL,NULL,31.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,26.660),(5,'CHAHRAZED 1.7 KG CHO',NULL,NULL,'2025-09-28 06:32:30.366','2025-09-28 06:32:30.366',NULL,NULL,26.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,22.790),(6,'CHAHRAZED 1.7 KG COLORE',NULL,NULL,'2025-09-28 06:32:30.367','2025-09-28 06:32:30.367',NULL,NULL,25.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,20.100),(7,'CHAHRAZED 2 KG AM',NULL,NULL,'2025-09-28 06:32:30.368','2025-09-28 06:32:30.368',NULL,NULL,34.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,29.670),(8,'CHAHRAZED 2 KG AM COLORE MET',NULL,NULL,'2025-09-28 06:32:30.369','2025-09-28 06:32:30.369',NULL,NULL,37.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,31.820),(9,'CHAHRAZED 2 KG FS',NULL,NULL,'2025-09-28 06:32:30.370','2025-09-28 06:32:30.370',NULL,NULL,54.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,43.407),(10,'CHAHRAZED 2 KG ROYAL',NULL,NULL,'2025-09-28 06:32:30.371','2025-09-28 06:32:30.371',NULL,NULL,73.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,63.538),(11,'CHAHRAZED 2 KG SPECIAL',NULL,NULL,'2025-09-28 06:32:30.371','2025-09-28 06:32:30.371',NULL,NULL,34.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,29.240),(12,'CHAHRAZED 200 GR AM',NULL,NULL,'2025-09-28 06:32:30.372','2025-09-28 06:32:30.372',NULL,NULL,5.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,3.725),(13,'CHAHRAZED 200 GR FS',NULL,NULL,'2025-09-28 06:32:30.373','2025-09-28 06:32:30.373',NULL,NULL,6.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,4.572),(14,'CHAHRAZED 200 GR LIGHT',NULL,NULL,'2025-09-28 06:32:30.374','2025-09-28 06:32:30.374',NULL,NULL,6.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,4.800),(15,'CHAHRAZED 200 GR N',NULL,NULL,'2025-09-28 06:32:30.375','2025-09-28 06:32:30.375',NULL,NULL,4.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,3.200),(16,'CHAHRAZED 350 GR AM',NULL,NULL,'2025-09-28 06:32:30.375','2025-09-28 06:32:30.375',NULL,NULL,8.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,6.880),(17,'CHAHRAZED 350 GR CHOC',NULL,NULL,'2025-09-28 06:32:30.376','2025-09-28 06:32:30.376',NULL,NULL,7.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,6.020),(18,'CHAHRAZED 350 GR LIGHT',NULL,NULL,'2025-09-28 06:32:30.377','2025-09-28 06:32:30.377',NULL,NULL,10.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,8.600),(19,'CHAHRAZED 400 GR AM',NULL,NULL,'2025-09-28 06:32:30.378','2025-09-28 06:32:30.378',NULL,NULL,8.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,6.438),(20,'CHAHRAZED 400 GR FS',NULL,NULL,'2025-09-28 06:32:30.379','2025-09-28 06:32:30.379',NULL,NULL,9.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,8.170),(21,'CHAHRAZED 400 GR LIGHT',NULL,NULL,'2025-09-28 06:32:30.380','2025-09-28 06:32:30.380',NULL,NULL,10.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,8.229),(22,'CHAHRAZED 400 GR N',NULL,NULL,'2025-09-28 06:32:30.382','2025-09-28 06:32:30.382',NULL,NULL,7.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,5.388),(23,'CHAHRAZED 800 GR AM',NULL,NULL,'2025-09-28 06:32:30.383','2025-09-28 06:32:30.383',NULL,NULL,15.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,12.596),(24,'CHAHRAZED 800 GR FS',NULL,NULL,'2025-09-28 06:32:30.384','2025-09-28 06:32:30.384',NULL,NULL,16.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,14.276),(25,'CHAHRAZED 800 GR LIGHT',NULL,NULL,'2025-09-28 06:32:30.386','2025-09-28 06:32:30.386',NULL,NULL,19.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,16.340),(26,'CHAHRAZED 800 GR N',NULL,NULL,'2025-09-28 06:32:30.387','2025-09-28 06:32:30.387',NULL,NULL,13.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,11.180),(27,'CHEMIA VRAC 100GR',NULL,NULL,'2025-09-28 06:32:30.388','2025-09-28 06:32:30.388',NULL,NULL,1.70,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,3,NULL,1.200),(28,'CHWINGUM',NULL,NULL,'2025-09-28 06:32:30.389','2025-09-28 06:32:30.389',NULL,NULL,12.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,15,NULL,10.300),(29,'CROCANT',NULL,NULL,'2025-09-28 06:32:30.390','2025-09-28 08:24:14.208',NULL,'https://recette4saisons.fr/wp-content/uploads/2023/10/CROQUANT.png',12.00,0.07,'1',1,NULL,0,25,NULL,NULL,1,NULL,0,4,NULL,9.000),(30,'EAU 0.5L',NULL,NULL,'2025-09-28 06:32:30.391','2025-09-28 08:24:14.206',NULL,'https://otrity.com/wp-content/uploads/2020/09/eau-minerale-7.webp',0.60,0.00,'NON',1,NULL,0,6,NULL,NULL,0,NULL,0,7,NULL,0.450),(31,'EAU 1.5L',NULL,NULL,'2025-09-28 06:32:30.391','2025-09-28 08:24:14.207',NULL,NULL,1.00,0.00,'NON',1,NULL,0,24,NULL,NULL,0,NULL,0,7,NULL,0.700),(32,'GATEAUX SOWABAA',NULL,NULL,'2025-09-28 06:32:30.392','2025-09-28 08:24:14.207',NULL,NULL,12.00,0.07,'1',1,NULL,0,10,NULL,NULL,1,NULL,0,8,NULL,9.000),(33,'HALKOUM 200 G AM',NULL,NULL,'2025-09-28 06:32:30.393','2025-09-28 06:32:30.393',NULL,NULL,4.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,9,NULL,2.500),(34,'HALKOUM 200 G N',NULL,NULL,'2025-09-28 06:32:30.394','2025-09-28 06:32:30.394',NULL,NULL,3.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,9,NULL,2.500),(35,'HALKOUM VRAC',NULL,NULL,'2025-09-28 06:32:30.395','2025-09-28 06:32:30.395',NULL,NULL,17.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,9,NULL,13.000),(36,'HALWA GRAND',NULL,NULL,'2025-09-28 06:32:30.396','2025-09-28 06:32:30.396',NULL,NULL,9.50,0.19,'NON',1,NULL,1,NULL,NULL,NULL,0,NULL,0,15,NULL,8.210),(37,'HALWA GRAND SPECIAL',NULL,NULL,'2025-09-28 06:32:30.398','2025-09-28 06:32:30.398',NULL,NULL,10.50,0.19,'NON',1,NULL,1,NULL,NULL,NULL,0,NULL,0,15,NULL,8.500),(38,'HALWA PETIT',NULL,NULL,'2025-09-28 06:32:30.399','2025-09-28 06:32:30.399',NULL,NULL,4.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,15,NULL,3.094),(39,'HLOU ARBI',NULL,NULL,'2025-09-28 06:32:30.400','2025-09-28 08:24:14.207',NULL,'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-v8cl9Ia-BcUiFzpyKDqZybVxu3f2h0EAoE_MVT97FCEG63_TDe3Us6FsLLAtIuX3oVw&usqp=CAU',18.00,0.07,'1',1,NULL,0,3,NULL,NULL,1,NULL,0,10,NULL,12.000),(40,'HLOU KAKAWIA',NULL,NULL,'2025-09-28 06:32:30.402','2025-09-28 08:24:14.205',NULL,'https://freepngimg.com/thumb/peanut/4-2-peanut-transparent-thumb.png',30.00,0.07,'1',1,NULL,0,5,NULL,NULL,1,NULL,0,11,NULL,22.000),(41,'HLOU LOUZ',NULL,NULL,'2025-09-28 06:32:30.402','2025-09-28 08:24:14.208',NULL,'https://static.vecteezy.com/system/resources/thumbnails/012/596/329/small/almond-nut-with-leaves-png.png',58.00,0.07,'1',1,NULL,0,4,NULL,NULL,1,NULL,0,12,NULL,42.000),(42,'JUS 1L CITRON',NULL,NULL,'2025-09-28 06:32:30.403','2025-09-28 08:24:14.207',NULL,NULL,8.00,0.19,'6',1,NULL,1,23,NULL,NULL,1,NULL,0,13,NULL,6.290),(43,'JUS 1L CITRON AMANDE',NULL,NULL,'2025-09-28 06:32:30.404','2025-09-28 08:24:14.207',NULL,NULL,8.50,0.19,'6',1,NULL,1,22,NULL,NULL,1,NULL,0,13,NULL,6.800),(44,'JUS 1L FRUIT IMPORTER',NULL,NULL,'2025-09-28 06:32:30.405','2025-09-28 08:24:14.207',NULL,NULL,9.00,0.19,'6',1,NULL,1,21,NULL,NULL,1,NULL,0,13,NULL,7.650),(45,'JUS 1L FRUIT LOCAL',NULL,NULL,'2025-09-28 06:32:30.406','2025-09-28 08:24:14.207',NULL,NULL,9.00,0.19,'6',1,NULL,1,20,NULL,NULL,1,NULL,0,13,NULL,7.395),(46,'JUS 3L CITRON',NULL,NULL,'2025-09-28 06:32:30.407','2025-09-28 08:24:14.207',NULL,NULL,23.50,0.19,'1',1,NULL,1,19,NULL,NULL,1,NULL,0,13,NULL,18.275),(47,'JUS 3L CITRON AMANDE',NULL,NULL,'2025-09-28 06:32:30.408','2025-09-28 08:24:14.207',NULL,NULL,25.00,0.19,'1',1,NULL,1,18,NULL,NULL,1,NULL,0,13,NULL,19.975),(48,'JUS 3L FRUIT IMPORTER',NULL,NULL,'2025-09-28 06:32:30.409','2025-09-28 08:24:14.207',NULL,NULL,26.50,0.19,'1',1,NULL,1,12,NULL,NULL,1,NULL,0,13,NULL,22.100),(49,'JUS 3L FRUIT LOCAL',NULL,NULL,'2025-09-28 06:32:30.410','2025-09-28 08:24:14.208',NULL,NULL,26.50,0.19,'1',1,NULL,1,17,NULL,NULL,1,NULL,0,13,NULL,21.250),(50,'JUS 5L CITRON',NULL,NULL,'2025-09-28 06:32:30.411','2025-09-28 08:24:14.208',NULL,NULL,35.00,0.19,'1',1,NULL,1,16,NULL,NULL,1,NULL,0,13,NULL,29.452),(51,'JUS 5L CITRON AMANDE',NULL,NULL,'2025-09-28 06:32:30.412','2025-09-28 08:24:14.208',NULL,NULL,37.00,0.19,'1',1,NULL,1,14,NULL,NULL,1,NULL,0,13,NULL,32.002),(52,'JUS 5L FRUIT IMPORTER',NULL,NULL,'2025-09-28 06:32:30.413','2025-09-28 08:24:14.207',NULL,NULL,40.00,0.19,'1',1,NULL,1,8,NULL,NULL,1,NULL,0,13,NULL,35.870),(53,'JUS 5L FRUIT LOCAL',NULL,NULL,'2025-09-28 06:32:30.414','2025-09-28 08:24:14.208',NULL,NULL,40.00,0.19,'1',1,NULL,1,13,NULL,NULL,1,NULL,0,13,NULL,35.020),(54,'LOUZIA',NULL,NULL,'2025-09-28 06:32:30.415','2025-09-28 08:24:14.208',NULL,'https://www.geantdrive.tn/tunis-city/1220534-home_default/tarte-amandine-6-8-parts.jpg',1.20,0.07,'NON',1,NULL,0,15,NULL,NULL,0,NULL,0,16,NULL,0.700),(55,'NA3OURA 2 KG AM',NULL,NULL,'2025-09-28 06:32:30.416','2025-09-28 06:32:30.416',NULL,NULL,37.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,15,NULL,31.820),(56,'NA3OURA 2 KG FS',NULL,NULL,'2025-09-28 06:32:30.418','2025-09-28 06:32:30.418',NULL,NULL,57.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,15,NULL,49.020),(57,'NA3OURA 2 KG N',NULL,NULL,'2025-09-28 06:32:30.419','2025-09-28 06:32:30.419',NULL,NULL,32.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,15,NULL,27.520),(58,'NA3OURA 2 KG SPECIAL',NULL,NULL,'2025-09-28 06:32:30.420','2025-09-28 06:32:30.420',NULL,NULL,37.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,15,NULL,32.250),(59,'NA3OURA 400GR AM',NULL,NULL,'2025-09-28 06:32:30.421','2025-09-28 06:32:30.421',NULL,NULL,8.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,15,NULL,7.473),(60,'NA3OURA 400GR N',NULL,NULL,'2025-09-28 06:32:30.423','2025-09-28 06:32:30.423',NULL,NULL,7.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,15,NULL,5.978),(61,'NA3OURA 5 KG NATURE',NULL,NULL,'2025-09-28 06:32:30.424','2025-09-28 06:32:30.424',NULL,NULL,64.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,15,NULL,55.040),(62,'NA3OURA 5 KG SPECIAL',NULL,NULL,'2025-09-28 06:32:30.425','2025-09-28 06:32:30.425',NULL,NULL,70.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,15,NULL,60.200),(63,'NA3OURA 800GR AM',NULL,NULL,'2025-09-28 06:32:30.426','2025-09-28 06:32:30.426',NULL,NULL,16.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,15,NULL,14.325),(64,'NA3OURA 800GR N',NULL,NULL,'2025-09-28 06:32:30.427','2025-09-28 06:32:30.427',NULL,NULL,13.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,15,NULL,11.158),(65,'PETIT FOUR',NULL,NULL,'2025-09-28 06:32:30.429','2025-09-28 08:24:14.204',NULL,'https://recette4saisons.fr/wp-content/uploads/2023/10/petit-au-four.png',18.00,0.07,'1',1,NULL,0,2,NULL,NULL,1,NULL,0,16,NULL,12.000),(66,'SABLE',NULL,NULL,'2025-09-28 06:32:30.430','2025-09-28 08:24:14.203',NULL,'https://recette4saisons.fr/wp-content/uploads/2023/10/ezgif.com-webp-maker-5.webp',18.00,0.07,'1',1,NULL,0,1,NULL,NULL,1,NULL,0,17,NULL,10.000),(67,'SEAU 2.350 GR',NULL,NULL,'2025-09-28 06:32:30.432','2025-09-28 06:32:30.432',NULL,NULL,28.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,22.737),(68,'SEAU 2.350 GR CHOC',NULL,NULL,'2025-09-28 06:32:30.433','2025-09-28 06:32:30.433',NULL,NULL,30.00,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,25.800),(69,'TAHINA 400GR',NULL,NULL,'2025-09-28 06:32:30.434','2025-09-28 06:32:30.434',NULL,NULL,9.50,0.19,'NON',1,NULL,0,NULL,NULL,NULL,0,NULL,0,2,NULL,8.170),(70,'VERRE 20CL',NULL,NULL,'2025-09-28 06:32:30.436','2025-09-28 08:24:14.207',NULL,NULL,1.30,0.19,'NON',1,NULL,0,11,NULL,NULL,0,NULL,0,14,NULL,0.500),(71,'VERRE 25CL',NULL,NULL,'2025-09-28 06:32:30.437','2025-09-28 08:24:14.207',NULL,NULL,2.00,0.19,'NON',1,NULL,0,9,NULL,NULL,0,NULL,0,14,NULL,0.750),(72,'VERRE GRANITE',NULL,NULL,'2025-09-28 06:32:30.438','2025-09-28 08:24:14.207',NULL,'https://iceloops.com/wp-content/uploads/2021/09/granite.png',2.50,0.19,'NON',1,NULL,0,7,NULL,NULL,0,NULL,0,14,NULL,0.850);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `produit_de_caisse_depot`
--

DROP TABLE IF EXISTS `produit_de_caisse_depot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `produit_de_caisse_depot` (
  `id` int NOT NULL AUTO_INCREMENT,
  `produit_de_caisse_id` int NOT NULL,
  `depot_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_produit_depot` (`produit_de_caisse_id`,`depot_id`),
  KEY `produit_de_caisse_depot_depot_id_fkey` (`depot_id`),
  CONSTRAINT `produit_de_caisse_depot_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `produit_de_caisse_depot_produit_de_caisse_id_fkey` FOREIGN KEY (`produit_de_caisse_id`) REFERENCES `produits_de_caisse` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produit_de_caisse_depot`
--

LOCK TABLES `produit_de_caisse_depot` WRITE;
/*!40000 ALTER TABLE `produit_de_caisse_depot` DISABLE KEYS */;
INSERT INTO `produit_de_caisse_depot` VALUES (1,1,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(2,2,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(3,3,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(4,4,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(5,5,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(6,6,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(7,7,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(8,8,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(9,9,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(10,10,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(11,11,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(12,12,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(13,13,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(14,14,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(15,15,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(16,16,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(17,17,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(18,18,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(19,19,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(21,20,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675'),(22,21,1,'2025-09-28 07:12:06.675','2025-09-28 07:12:06.675');
/*!40000 ALTER TABLE `produit_de_caisse_depot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `produits_de_caisse`
--

DROP TABLE IF EXISTS `produits_de_caisse`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `produits_de_caisse` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `barcode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bundle_price` decimal(10,2) DEFAULT NULL,
  `bundle_size` int DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `designation_legale` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_index` int DEFAULT NULL,
  `duree_conservation` int DEFAULT NULL,
  `famille_id` int NOT NULL,
  `initial_stock` decimal(10,3) DEFAULT NULL,
  `is_stockable` tinyint(1) NOT NULL DEFAULT '1',
  `is_vrac` tinyint(1) NOT NULL DEFAULT '0',
  `is_vraguable` tinyint(1) NOT NULL DEFAULT '0',
  `is_wholesale` tinyint(1) NOT NULL DEFAULT '0',
  `max_stock` decimal(10,3) DEFAULT NULL,
  `min_stock` decimal(10,3) DEFAULT NULL,
  `original_product_id` int DEFAULT NULL,
  `photo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prix_achat` decimal(10,3) DEFAULT NULL,
  `prix_vente_ttc` decimal(10,2) NOT NULL,
  `tva` decimal(5,2) NOT NULL DEFAULT '19.00',
  `unite` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pcs',
  `parent_product_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `produits_de_caisse_barcode_key` (`barcode`),
  KEY `produits_de_caisse_famille_id_fkey` (`famille_id`),
  KEY `produits_de_caisse_original_product_id_fkey` (`original_product_id`),
  KEY `produits_de_caisse_parent_product_id_fkey` (`parent_product_id`),
  CONSTRAINT `produits_de_caisse_famille_id_fkey` FOREIGN KEY (`famille_id`) REFERENCES `product_families` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `produits_de_caisse_original_product_id_fkey` FOREIGN KEY (`original_product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `produits_de_caisse_parent_product_id_fkey` FOREIGN KEY (`parent_product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produits_de_caisse`
--

LOCK TABLES `produits_de_caisse` WRITE;
/*!40000 ALTER TABLE `produits_de_caisse` DISABLE KEYS */;
INSERT INTO `produits_de_caisse` VALUES (1,'ABYADH NOISETTE','',1,'2025-09-28 07:11:43.449','2025-09-28 07:11:43.449',NULL,NULL,NULL,NULL,NULL,NULL,NULL,10,NULL,1,0,0,0,NULL,NULL,NULL,NULL,8.000,18.00,19.00,'pcs',39),(2,'AJNAB BAKLAWA KAKAWIA','',1,'2025-09-28 07:11:43.470','2025-09-28 07:11:43.470',NULL,NULL,NULL,NULL,NULL,NULL,NULL,5,NULL,1,0,0,0,NULL,NULL,NULL,NULL,7.000,12.00,0.07,'NON',1),(3,'AJNAB BAKLAWA LOUZ','',1,'2025-09-28 07:11:43.483','2025-09-28 07:11:43.483',NULL,NULL,NULL,NULL,NULL,NULL,NULL,6,NULL,1,0,0,0,NULL,NULL,NULL,NULL,15.000,24.00,0.07,'NON',2),(4,'BAKLAWA AMANDE','',1,'2025-09-28 07:11:43.497','2025-09-28 07:11:43.497',NULL,NULL,NULL,NULL,NULL,NULL,NULL,12,NULL,1,0,0,0,NULL,NULL,NULL,NULL,30.000,58.00,19.00,'pcs',41),(5,'BAKLAWA KAKWIA','',1,'2025-09-28 07:11:43.511','2025-09-28 07:11:43.511',NULL,NULL,NULL,NULL,NULL,NULL,NULL,11,NULL,1,0,0,0,NULL,NULL,NULL,NULL,16.000,30.00,19.00,'pcs',40),(6,'BJEWIYA','',1,'2025-09-28 07:11:43.525','2025-09-28 07:11:43.525',NULL,NULL,NULL,NULL,NULL,NULL,NULL,12,NULL,1,0,0,0,NULL,NULL,NULL,NULL,30.000,58.00,19.00,'pcs',41),(7,'CHOCOLAT KAKAWIA','',1,'2025-09-28 07:11:43.538','2025-09-28 07:11:43.538',NULL,NULL,NULL,NULL,NULL,NULL,NULL,11,NULL,1,0,0,0,NULL,NULL,NULL,NULL,16.000,30.00,19.00,'pcs',40),(8,'CROCANT','',1,'2025-09-28 07:11:43.554','2025-09-28 07:11:43.554',NULL,NULL,NULL,NULL,NULL,NULL,NULL,4,NULL,1,0,0,0,NULL,NULL,NULL,NULL,6.000,12.00,0.07,'1',29),(9,'GATEAUX SOWABAA','',1,'2025-09-28 07:11:43.571','2025-09-28 07:11:43.571',NULL,NULL,NULL,NULL,NULL,NULL,NULL,8,NULL,1,0,0,0,NULL,NULL,NULL,NULL,6.000,12.00,0.07,'1',32),(10,'HLOU KAKAWIA','',1,'2025-09-28 07:11:43.589','2025-09-28 07:11:43.589',NULL,NULL,NULL,NULL,NULL,NULL,NULL,11,NULL,1,0,0,0,NULL,NULL,NULL,NULL,16.000,30.00,0.07,'1',40),(11,'HLOU LOUZ','',1,'2025-09-28 07:11:43.606','2025-09-28 07:11:43.606',NULL,NULL,NULL,NULL,NULL,NULL,NULL,12,NULL,1,0,0,0,NULL,NULL,NULL,NULL,30.000,58.00,0.07,'1',41),(12,'HOMSIA','',1,'2025-09-28 07:11:43.623','2025-09-28 07:11:43.623',NULL,NULL,NULL,NULL,NULL,NULL,NULL,10,NULL,1,0,0,0,NULL,NULL,NULL,NULL,8.000,18.00,19.00,'pcs',39),(13,'JALJLENIA','',1,'2025-09-28 07:11:43.637','2025-09-28 07:11:43.637',NULL,NULL,NULL,NULL,NULL,NULL,NULL,11,NULL,1,0,0,0,NULL,NULL,NULL,NULL,16.000,30.00,19.00,'pcs',40),(14,'LOUZIA','',1,'2025-09-28 07:11:43.654','2025-09-28 07:11:43.654',NULL,NULL,NULL,NULL,NULL,NULL,NULL,16,NULL,1,0,0,0,NULL,NULL,NULL,NULL,0.500,1.20,0.07,'NON',65),(15,'MAACHAACH','',1,'2025-09-28 07:11:43.668','2025-09-28 07:11:43.668',NULL,NULL,NULL,NULL,NULL,NULL,NULL,11,NULL,1,0,0,0,NULL,NULL,NULL,NULL,16.000,30.00,19.00,'pcs',40),(16,'MAKROUDH ASMAR','',1,'2025-09-28 07:11:43.684','2025-09-28 07:11:43.684',NULL,NULL,NULL,NULL,NULL,NULL,NULL,10,NULL,1,0,0,0,NULL,NULL,NULL,NULL,8.000,18.00,0.07,'1',39),(17,'MAKROUDH DRO3','',1,'2025-09-28 07:11:43.700','2025-09-28 07:11:43.700',NULL,NULL,NULL,NULL,NULL,NULL,NULL,10,NULL,1,0,0,0,NULL,NULL,NULL,NULL,8.000,18.00,19.00,'pcs',39),(18,'MARROCAIN','',1,'2025-09-28 07:11:43.713','2025-09-28 07:11:43.713',NULL,NULL,NULL,NULL,NULL,NULL,NULL,11,NULL,1,0,0,0,NULL,NULL,NULL,NULL,16.000,30.00,19.00,'pcs',40),(19,'MARROCAIN AMANDE','',1,'2025-09-28 07:11:43.726','2025-09-28 07:11:43.726',NULL,NULL,NULL,NULL,NULL,NULL,NULL,12,NULL,1,0,0,0,NULL,NULL,NULL,NULL,30.000,58.00,0.07,'1',41),(20,'PETIT FOUR','',1,'2025-09-28 07:11:59.701','2025-09-28 07:11:59.701',NULL,NULL,NULL,NULL,NULL,NULL,NULL,16,NULL,1,0,0,0,NULL,NULL,NULL,NULL,9.000,18.00,0.07,'1',65),(21,'SABLE','',1,'2025-09-28 07:11:59.717','2025-09-28 07:11:59.717',NULL,NULL,NULL,NULL,NULL,NULL,NULL,17,NULL,1,0,0,0,NULL,NULL,NULL,NULL,7.000,18.00,0.07,'1',66);
/*!40000 ALTER TABLE `produits_de_caisse` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rebut_records`
--

DROP TABLE IF EXISTS `rebut_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rebut_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `item_id` int NOT NULL,
  `product_id` int NOT NULL,
  `depot_id` int NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `status` enum('PENDING_AUTHORITY','ARCHIVED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING_AUTHORITY',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `authority_approved_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rebut_records_item_id_key` (`item_id`),
  KEY `rebut_records_depot_id_fkey` (`depot_id`),
  KEY `rebut_records_product_id_fkey` (`product_id`),
  KEY `rebut_records_request_id_fkey` (`request_id`),
  CONSTRAINT `rebut_records_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `rebut_records_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `return_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `rebut_records_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `rebut_records_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `return_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rebut_records`
--

LOCK TABLES `rebut_records` WRITE;
/*!40000 ALTER TABLE `rebut_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `rebut_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `return_items`
--

DROP TABLE IF EXISTS `return_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `return_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `product_id` int NOT NULL,
  `requested_qty` decimal(10,3) NOT NULL,
  `disposition` enum('NONE','NON_REBUT','REBUT') COLLATE utf8mb4_unicode_ci DEFAULT 'NONE',
  `non_rebut_qty` decimal(10,3) DEFAULT NULL,
  `rebut_qty` decimal(10,3) DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `return_items_product_id_fkey` (`product_id`),
  KEY `return_items_request_id_fkey` (`request_id`),
  CONSTRAINT `return_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `return_items_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `return_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `return_items`
--

LOCK TABLES `return_items` WRITE;
/*!40000 ALTER TABLE `return_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `return_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `return_requests`
--

DROP TABLE IF EXISTS `return_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `return_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `numero` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED','PROCESSED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `depot_id` int NOT NULL,
  `requested_by_id` int NOT NULL,
  `approved_by_id` int DEFAULT NULL,
  `approved_at` datetime(3) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `original_sale_id` int DEFAULT NULL,
  `original_sale_total` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `return_requests_numero_key` (`numero`),
  KEY `return_requests_approved_by_id_fkey` (`approved_by_id`),
  KEY `return_requests_depot_id_fkey` (`depot_id`),
  KEY `return_requests_requested_by_id_fkey` (`requested_by_id`),
  CONSTRAINT `return_requests_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `return_requests_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `return_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `return_requests`
--

LOCK TABLES `return_requests` WRITE;
/*!40000 ALTER TABLE `return_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `return_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sale_items`
--

DROP TABLE IF EXISTS `sale_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sale_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sale_id` int NOT NULL,
  `product_id` int NOT NULL,
  `product_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `discount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `bundle_price` decimal(10,2) DEFAULT NULL,
  `bundle_quantity` decimal(10,3) DEFAULT NULL,
  `bundle_size` int DEFAULT NULL,
  `is_approved` tinyint(1) NOT NULL DEFAULT '0',
  `is_wholesale` tinyint(1) NOT NULL DEFAULT '0',
  `margin_percent` decimal(5,2) DEFAULT NULL,
  `requires_approval` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `sale_items_product_id_fkey` (`product_id`),
  KEY `sale_items_sale_id_fkey` (`sale_id`),
  CONSTRAINT `sale_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `sale_items_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sale_items`
--

LOCK TABLES `sale_items` WRITE;
/*!40000 ALTER TABLE `sale_items` DISABLE KEYS */;
INSERT INTO `sale_items` VALUES (1,1,32,'GATEAUX SOWABAA',1.000,12.00,12.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(2,2,40,'HLOU KAKAWIA',1.000,30.00,30.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(3,3,41,'HLOU LOUZ',1.000,58.00,58.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(4,4,40,'HLOU KAKAWIA',1.000,30.00,30.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(5,5,40,'HLOU KAKAWIA',1.000,30.00,30.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(6,6,40,'HLOU KAKAWIA',1.000,30.00,30.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(7,6,52,'JUS 5L FRUIT IMPORTER',1.000,40.00,40.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(8,7,40,'HLOU KAKAWIA',6.000,30.00,180.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(9,7,41,'HLOU LOUZ',10.000,58.00,580.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(10,8,41,'HLOU LOUZ',3.000,58.00,174.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(11,9,41,'HLOU LOUZ',1.000,58.00,58.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(12,10,41,'HLOU LOUZ',100.000,58.00,5800.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(13,11,41,'HLOU LOUZ',100.000,58.00,5800.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(14,12,39,'HLOU ARBI',100.000,18.00,1800.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(15,13,39,'HLOU ARBI',1.000,18.00,18.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(16,14,65,'PETIT FOUR',100.000,18.00,1800.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(17,15,71,'VERRE 25CL',20.000,2.00,40.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(18,16,54,'LOUZIA',500.000,1.20,600.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(19,16,46,'JUS 3L CITRON',5010.000,23.50,117735.00,0.00,NULL,NULL,NULL,0,0,NULL,0),(20,16,48,'JUS 3L FRUIT IMPORTER',1.000,26.50,26.50,0.00,NULL,NULL,NULL,0,0,NULL,0);
/*!40000 ALTER TABLE `sale_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales`
--

DROP TABLE IF EXISTS `sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `total` decimal(10,3) NOT NULL,
  `discount` decimal(10,3) NOT NULL DEFAULT '0.000',
  `final_total` decimal(10,3) NOT NULL,
  `payment_method_id` int DEFAULT NULL,
  `status` enum('PENDING','COMPLETED','CANCELLED','REFUNDED','TEMPORARY','PENDING_ADMIN','CADEAU','CMD_TERMINEE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `depot_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `expected_date` datetime(3) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `client_id` int DEFAULT NULL,
  `user_id` int NOT NULL,
  `advance_payment` decimal(10,3) DEFAULT '0.000',
  `advance_payment_date` datetime(3) DEFAULT NULL,
  `advance_payment_method_id` int DEFAULT NULL,
  `advance_payment_notes` text COLLATE utf8mb4_unicode_ci,
  `payment_type` enum('COMPTANT','CREDIT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'COMPTANT',
  `session_id` int DEFAULT NULL,
  `is_wholesale` tinyint(1) NOT NULL DEFAULT '0',
  `daily_ticket_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sales_advance_payment_method_id_fkey` (`advance_payment_method_id`),
  KEY `sales_client_id_fkey` (`client_id`),
  KEY `sales_depot_id_fkey` (`depot_id`),
  KEY `sales_payment_method_id_fkey` (`payment_method_id`),
  KEY `sales_session_id_fkey` (`session_id`),
  KEY `sales_user_id_fkey` (`user_id`),
  CONSTRAINT `sales_advance_payment_method_id_fkey` FOREIGN KEY (`advance_payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sales_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sales_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `sales_payment_method_id_fkey` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sales_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `session_caisse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sales_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales`
--

LOCK TABLES `sales` WRITE;
/*!40000 ALTER TABLE `sales` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_caisse`
--

DROP TABLE IF EXISTS `session_caisse`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_caisse` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pos_id` int NOT NULL,
  `user_id` int NOT NULL,
  `depot_id` int DEFAULT NULL,
  `magasin_id` int DEFAULT NULL,
  `opened_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `closed_at` datetime(3) DEFAULT NULL,
  `opening_fund` decimal(12,3) NOT NULL,
  `expected_cash` decimal(12,3) NOT NULL,
  `counted_cash` decimal(12,3) DEFAULT NULL,
  `variance` decimal(12,3) DEFAULT NULL,
  `status` enum('OPEN','CLOSED','REOPENED','ADMIN_CORRECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OPEN',
  `x_seq` int NOT NULL DEFAULT '0',
  `z_seq` int NOT NULL DEFAULT '0',
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `original_counted_cash` decimal(12,3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `session_caisse_depot_id_fkey` (`depot_id`),
  KEY `session_caisse_user_id_fkey` (`user_id`),
  CONSTRAINT `session_caisse_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `session_caisse_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_caisse`
--

LOCK TABLES `session_caisse` WRITE;
/*!40000 ALTER TABLE `session_caisse` DISABLE KEYS */;
INSERT INTO `session_caisse` VALUES (1,1,4,4,NULL,'2025-09-29 11:27:03.748',NULL,0.000,0.000,NULL,NULL,'OPEN',0,0,'Session automatique','2025-09-29 11:27:03.748','2025-09-29 11:27:03.748',NULL);
/*!40000 ALTER TABLE `session_caisse` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_document_items`
--

DROP TABLE IF EXISTS `stock_document_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_document_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` int NOT NULL,
  `product_id` int NOT NULL,
  `famille` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `batch` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `barcode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_price` decimal(10,3) DEFAULT NULL,
  `count` int DEFAULT '1',
  `montant_ht` decimal(10,3) DEFAULT NULL,
  `montant_ttc` decimal(10,3) DEFAULT NULL,
  `montant_tva` decimal(10,3) DEFAULT NULL,
  `prix_unitaire` decimal(10,3) DEFAULT NULL,
  `tva` decimal(5,2) DEFAULT '19.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_document_items_barcode_key` (`barcode`),
  KEY `stock_document_items_document_id_fkey` (`document_id`),
  KEY `stock_document_items_product_id_fkey` (`product_id`),
  CONSTRAINT `stock_document_items_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `stock_documents` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_document_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_document_items`
--

LOCK TABLES `stock_document_items` WRITE;
/*!40000 ALTER TABLE `stock_document_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_document_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_document_links`
--

DROP TABLE IF EXISTS `stock_document_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_document_links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source_document_id` int NOT NULL,
  `target_document_id` int NOT NULL,
  `linkType` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_document_links_source_document_id_target_document_id_key` (`source_document_id`,`target_document_id`),
  KEY `stock_document_links_target_document_id_fkey` (`target_document_id`),
  CONSTRAINT `stock_document_links_source_document_id_fkey` FOREIGN KEY (`source_document_id`) REFERENCES `stock_documents` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_document_links_target_document_id_fkey` FOREIGN KEY (`target_document_id`) REFERENCES `stock_documents` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_document_links`
--

LOCK TABLES `stock_document_links` WRITE;
/*!40000 ALTER TABLE `stock_document_links` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_document_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_documents`
--

DROP TABLE IF EXISTS `stock_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `numero` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('BON_EXPEDITION','BON_ENTREE_DEPOT','BON_TRANSFERT','BON_ENTREE_MAGASIN') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PREPARED','SENT','RECEIVED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PREPARED',
  `emetteur_id` int NOT NULL,
  `destinataire_id` int NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_documents_numero_key` (`numero`),
  KEY `stock_documents_destinataire_id_fkey` (`destinataire_id`),
  KEY `stock_documents_emetteur_id_fkey` (`emetteur_id`),
  CONSTRAINT `stock_documents_destinataire_id_fkey` FOREIGN KEY (`destinataire_id`) REFERENCES `depots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_documents_emetteur_id_fkey` FOREIGN KEY (`emetteur_id`) REFERENCES `depots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_documents`
--

LOCK TABLES `stock_documents` WRITE;
/*!40000 ALTER TABLE `stock_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_movements`
--

DROP TABLE IF EXISTS `stock_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_movements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `depot_id` int NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `type` enum('IN','OUT','TRANSFER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_depot_id` int DEFAULT NULL,
  `to_depot_id` int DEFAULT NULL,
  `reason` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int NOT NULL,
  `date` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `stock_movements_depot_id_fkey` (`depot_id`),
  KEY `stock_movements_from_depot_id_fkey` (`from_depot_id`),
  KEY `stock_movements_product_id_fkey` (`product_id`),
  KEY `stock_movements_to_depot_id_fkey` (`to_depot_id`),
  KEY `stock_movements_user_id_fkey` (`user_id`),
  CONSTRAINT `stock_movements_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_movements_from_depot_id_fkey` FOREIGN KEY (`from_depot_id`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `stock_movements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_movements_to_depot_id_fkey` FOREIGN KEY (`to_depot_id`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `stock_movements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_movements`
--

LOCK TABLES `stock_movements` WRITE;
/*!40000 ALTER TABLE `stock_movements` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_transfer_items`
--

DROP TABLE IF EXISTS `stock_transfer_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfer_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transfer_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` decimal(10,3) NOT NULL,
  `transferred_quantity` decimal(10,3) NOT NULL DEFAULT '0.000',
  PRIMARY KEY (`id`),
  KEY `stock_transfer_items_product_id_fkey` (`product_id`),
  KEY `stock_transfer_items_transfer_id_fkey` (`transfer_id`),
  CONSTRAINT `stock_transfer_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_transfer_items_transfer_id_fkey` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_transfer_items`
--

LOCK TABLES `stock_transfer_items` WRITE;
/*!40000 ALTER TABLE `stock_transfer_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_transfer_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_transfers`
--

DROP TABLE IF EXISTS `stock_transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `from_depot_id` int NOT NULL,
  `to_depot_id` int NOT NULL,
  `status` enum('PENDING','APPROVED','TRANSFERRED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `requested_by` int NOT NULL,
  `approved_by` int DEFAULT NULL,
  `requested_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `approved_at` datetime(3) DEFAULT NULL,
  `transferred_at` datetime(3) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `stock_transfers_approved_by_fkey` (`approved_by`),
  KEY `stock_transfers_from_depot_id_fkey` (`from_depot_id`),
  KEY `stock_transfers_requested_by_fkey` (`requested_by`),
  KEY `stock_transfers_to_depot_id_fkey` (`to_depot_id`),
  CONSTRAINT `stock_transfers_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `stock_transfers_from_depot_id_fkey` FOREIGN KEY (`from_depot_id`) REFERENCES `depots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_transfers_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_transfers_to_depot_id_fkey` FOREIGN KEY (`to_depot_id`) REFERENCES `depots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_transfers`
--

LOCK TABLES `stock_transfers` WRITE;
/*!40000 ALTER TABLE `stock_transfers` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_transfers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_debt_transactions`
--

DROP TABLE IF EXISTS `supplier_debt_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_debt_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int NOT NULL,
  `expense_id` int DEFAULT NULL,
  `amount` decimal(12,3) NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `user_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `supplier_debt_transactions_expense_id_fkey` (`expense_id`),
  KEY `supplier_debt_transactions_supplier_id_fkey` (`supplier_id`),
  KEY `supplier_debt_transactions_user_id_fkey` (`user_id`),
  CONSTRAINT `supplier_debt_transactions_expense_id_fkey` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `supplier_debt_transactions_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `supplier_debt_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_debt_transactions`
--

LOCK TABLES `supplier_debt_transactions` WRITE;
/*!40000 ALTER TABLE `supplier_debt_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `supplier_debt_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_payments`
--

DROP TABLE IF EXISTS `supplier_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int NOT NULL,
  `amount` decimal(12,3) NOT NULL,
  `payment_date` datetime(3) NOT NULL,
  `payment_method` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CASH',
  `reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `user_id` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `supplier_payments_supplier_id_fkey` (`supplier_id`),
  KEY `supplier_payments_user_id_fkey` (`user_id`),
  CONSTRAINT `supplier_payments_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `supplier_payments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_payments`
--

LOCK TABLES `supplier_payments` WRITE;
/*!40000 ALTER TABLE `supplier_payments` DISABLE KEYS */;
INSERT INTO `supplier_payments` VALUES (1,1,-840.000,'2025-09-28 08:18:48.649','CASH',NULL,'Crédit - Bon d\'entrée #5',4,'2025-09-28 08:18:48.650','2025-09-28 08:18:48.656');
/*!40000 ALTER TABLE `supplier_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `city` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tax_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_terms` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `current_debt` decimal(12,3) NOT NULL DEFAULT '0.000',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
INSERT INTO `suppliers` VALUES (1,'STE PATISSERIE HENTATI','','','','','','','','','',1,'2025-09-28 08:17:50.147','2025-09-28 08:17:50.147',0.000);
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('ADMIN','MANAGER','CASHIER','STOCK_MANAGER','EMPLOYEE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `depot_id` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `last_login` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `pin` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_username_key` (`username`),
  UNIQUE KEY `users_email_key` (`email`),
  UNIQUE KEY `users_pin_key` (`pin`),
  KEY `users_depot_id_fkey` (`depot_id`),
  CONSTRAINT `users_depot_id_fkey` FOREIGN KEY (`depot_id`) REFERENCES `depots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'manager','manager@patisserie.tn','$2a$12$AXcHIfSeGgrgTTZqv4.7nOLCK.273dXIw3TNHUZq83WKrtsFOj6IC','Nadhir','Hentati','MANAGER',1,1,NULL,'2025-09-27 18:07:21.001','2025-09-27 21:13:57.833','2200'),(2,'stock','stock@patisserie.tn','$2a$12$iUTL/UgzyHigeKschOCPwOhpFUubK8kWsTNZJonDOWZZzZ6bjG35u','Wael','Khemakhem','MANAGER',3,1,'2025-09-27 21:25:08.597','2025-09-27 18:07:21.001','2025-09-27 21:25:08.598','3300'),(3,'cashier','cashier@patisserie.tn','$2a$12$5ginyrHJIUbrfJU.nqA.ned0Ai/4WB7wM3PWdxnk/kzEzhsyV0eBK','Safa','Bouaziz','CASHIER',3,1,NULL,'2025-09-27 18:07:21.001','2025-09-27 21:15:40.314','4400'),(4,'admin','admin@patisserie.tn','$2a$12$7Av.XZBSYNocA9jMW2mKiOk8nwh1OzlDIwk6GdA0rrdVXeZJ/MsOa','Admin','Principal','ADMIN',1,1,'2025-09-29 11:10:34.621','2025-09-27 18:07:21.001','2025-09-29 11:10:34.623','1100'),(5,'mostpha.mostpha','mostpha.mostpha@company.com','$2a$12$9MtQdjxYQ0zrUdZaUYfZBeCmQo4EBHzk6XsX9bpnuRc5wQeh6V6aC','Mostpha','Mostpha','MANAGER',4,1,'2025-09-27 21:25:17.176','2025-09-27 21:17:05.731','2025-09-27 21:25:17.177','5500'),(6,'responsable .1','responsable .1@company.com','$2a$12$CIVFXwreVXX5UVrVBcVNP.JWZR2SFo4Gqnt2lzL1p2Au3pwfNfcQS','Responsable','1','MANAGER',2,1,'2025-09-28 14:40:38.662','2025-09-27 21:17:58.749','2025-09-28 14:40:38.663','6600'),(7,'caisier .1','caisier .1@company.com','$2a$12$zURgtNqBbiVCeOgL2Kww3.c2zn22I9Vq2L9D1yjENX2Ll33TJWXne','Caisier','1','CASHIER',4,1,'2025-09-28 14:49:28.049','2025-09-27 21:18:58.477','2025-09-28 14:49:28.050','7700');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_brands`
--

DROP TABLE IF EXISTS `vehicle_brands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle_brands` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `models` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `logoUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicle_brands_name_key` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_brands`
--

LOCK TABLES `vehicle_brands` WRITE;
/*!40000 ALTER TABLE `vehicle_brands` DISABLE KEYS */;
INSERT INTO `vehicle_brands` VALUES (1,'ISUZU','[\"D MAX\"]',0,'2025-09-28 07:24:45.786','2025-09-28 07:25:39.774','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAACUCAMAAABSgr46AAAAaVBMVEX///9ybWtoZGJuaWd0cG34+Pj7+/uDfXrz8/ONjIzW1tbk5ORUTkzh4eFjY2Oko6Lq6upKRkR6dXLQ0NCTk5NaVVOxsbFfW1iJhIGhnZrExMS4uLjIxcGZlZLAvbmSjYpBPTqBgYGsqqW/EcleAAAHAklEQVR4nO2Z2ZajNhBALSRAhpatk');
/*!40000 ALTER TABLE `vehicle_brands` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicles`
--

DROP TABLE IF EXISTS `vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `matricule` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `brand_id` int NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicles_matricule_key` (`matricule`),
  KEY `vehicles_brand_id_fkey` (`brand_id`),
  CONSTRAINT `vehicles_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `vehicle_brands` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicles`
--

LOCK TABLES `vehicles` WRITE;
/*!40000 ALTER TABLE `vehicles` DISABLE KEYS */;
INSERT INTO `vehicles` VALUES (1,'228 TU 7055','D MAX',1,1,'2025-09-28 07:25:15.383','2025-09-28 07:25:15.383');
/*!40000 ALTER TABLE `vehicles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vrac_prices`
--

DROP TABLE IF EXISTS `vrac_prices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vrac_prices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `start_date` datetime(3) NOT NULL,
  `end_date` datetime(3) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `vrac_prices_product_id_fkey` (`product_id`),
  CONSTRAINT `vrac_prices_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vrac_prices`
--

LOCK TABLES `vrac_prices` WRITE;
/*!40000 ALTER TABLE `vrac_prices` DISABLE KEYS */;
/*!40000 ALTER TABLE `vrac_prices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wholesale_rules`
--

DROP TABLE IF EXISTS `wholesale_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wholesale_rules` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rule_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` decimal(10,3) NOT NULL,
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wholesale_rules`
--

LOCK TABLES `wholesale_rules` WRITE;
/*!40000 ALTER TABLE `wholesale_rules` DISABLE KEYS */;
/*!40000 ALTER TABLE `wholesale_rules` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-09-29 12:47:16
