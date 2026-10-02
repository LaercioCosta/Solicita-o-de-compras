-- CreateTable
CREATE TABLE `sessoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `refresh_token_hash` VARCHAR(191) NOT NULL,
    `revogada_em` DATETIME(3) NULL,
    `expira_em` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessoes_refresh_token_hash_key`(`refresh_token_hash`),
    INDEX `sessoes_usuario_id_idx`(`usuario_id`),
    INDEX `sessoes_expira_em_idx`(`expira_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessoes` ADD CONSTRAINT `sessoes_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
