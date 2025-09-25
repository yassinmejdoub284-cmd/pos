-- AlterTable
ALTER TABLE `depots` ADD COLUMN `company_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `companies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `raisonSociale` VARCHAR(200) NOT NULL,
    `formeJuridique` VARCHAR(50) NOT NULL,
    `activite` VARCHAR(200) NULL,
    `dateCreation` DATETIME(3) NULL,
    `logoUrl` VARCHAR(255) NULL,
    `brandColor` VARCHAR(20) NULL,
    `statut` ENUM('ACTIF', 'ARCHIVE') NOT NULL DEFAULT 'ACTIF',
    `adresse` TEXT NULL,
    `ville` VARCHAR(100) NULL,
    `delegation` VARCHAR(100) NULL,
    `gouvernorat` VARCHAR(100) NULL,
    `codePostal` VARCHAR(10) NULL,
    `telephone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `siteWeb` VARCHAR(150) NULL,
    `matriculeFiscal` VARCHAR(50) NOT NULL,
    `rne` VARCHAR(50) NOT NULL,
    `registreCommerce` VARCHAR(50) NULL,
    `tvaAssujetti` BOOLEAN NOT NULL DEFAULT false,
    `numeroTva` VARCHAR(50) NULL,
    `tauxTva` DECIMAL(5, 2) NOT NULL DEFAULT 19,
    `capitalSocial` DECIMAL(14, 3) NOT NULL DEFAULT 0,
    `representantNom` VARCHAR(100) NULL,
    `representantCin` VARCHAR(20) NULL,
    `rib` VARCHAR(50) NULL,
    `banque` VARCHAR(100) NULL,
    `bic` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `depots` ADD CONSTRAINT `depots_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
