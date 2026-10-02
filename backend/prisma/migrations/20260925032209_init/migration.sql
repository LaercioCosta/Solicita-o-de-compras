-- CreateTable
CREATE TABLE `setores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` ENUM('OFICINA', 'TI', 'MKT', 'COMERCIAL') NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `setores_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `perfis` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` ENUM('SOLICITANTE', 'GERENTE', 'GERENTE_FINANCEIRA', 'FINANCEIRO', 'TI', 'ADMINISTRADOR') NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `perfis_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `perfil_id` INTEGER NOT NULL,
    `entidade` VARCHAR(191) NOT NULL,
    `acao` VARCHAR(191) NOT NULL,
    `permitida` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `permissoes_perfil_id_entidade_acao_key`(`perfil_id`, `entidade`, `acao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senha_hash` VARCHAR(191) NOT NULL,
    `perfil_id` INTEGER NOT NULL,
    `setor_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usuarios_email_key`(`email`),
    INDEX `usuarios_perfil_id_idx`(`perfil_id`),
    INDEX `usuarios_setor_id_idx`(`setor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitacoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `descricao` VARCHAR(191) NOT NULL,
    `status` ENUM('RASCUNHO', 'AGUARDANDO_APROVACAO_SETOR', 'AGUARDANDO_APROVACAO_FINANCEIRA', 'APROVADO', 'AGUARDANDO_TI', 'COMPRA_EM_ANDAMENTO', 'AGUARDANDO_FINANCEIRO', 'PAGO', 'AGUARDANDO_NF', 'CONCLUIDO', 'REPROVADO', 'CANCELADO', 'AGUARDANDO_CORRECAO') NOT NULL DEFAULT 'RASCUNHO',
    `ciclo_aprovacao` INTEGER NOT NULL DEFAULT 1,
    `solicitante_id` INTEGER NOT NULL,
    `setor_id` INTEGER NOT NULL,
    `motivo_cancelamento` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `solicitacoes_status_idx`(`status`),
    INDEX `solicitacoes_solicitante_id_idx`(`solicitante_id`),
    INDEX `solicitacoes_setor_id_status_idx`(`setor_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitacao_itens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `solicitacao_id` INTEGER NOT NULL,
    `produto` VARCHAR(191) NOT NULL,
    `quantidade` DECIMAL(10, 2) NOT NULL,
    `valor_unitario_estimado` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `solicitacao_itens_solicitacao_id_idx`(`solicitacao_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orcamentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `solicitacao_id` INTEGER NOT NULL,
    `link_loja` VARCHAR(191) NOT NULL,
    `cnpj_loja` VARCHAR(191) NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `validade_ate` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `orcamentos_solicitacao_id_idx`(`solicitacao_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `aprovacoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `solicitacao_id` INTEGER NOT NULL,
    `orcamento_id` INTEGER NOT NULL,
    `aprovador_id` INTEGER NOT NULL,
    `nivel` ENUM('SETOR', 'FINANCEIRA') NOT NULL,
    `decisao` ENUM('APROVADO', 'REPROVADO') NOT NULL,
    `ciclo_aprovacao` INTEGER NOT NULL,
    `observacao` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `aprovacoes_orcamento_id_idx`(`orcamento_id`),
    INDEX `aprovacoes_aprovador_id_idx`(`aprovador_id`),
    UNIQUE INDEX `aprovacoes_solicitacao_id_ciclo_aprovacao_nivel_key`(`solicitacao_id`, `ciclo_aprovacao`, `nivel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `compras` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `solicitacao_id` INTEGER NOT NULL,
    `orcamento_id` INTEGER NOT NULL,
    `executante_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `compras_solicitacao_id_key`(`solicitacao_id`),
    INDEX `compras_orcamento_id_idx`(`orcamento_id`),
    INDEX `compras_executante_id_idx`(`executante_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pagamentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compra_id` INTEGER NOT NULL,
    `forma` ENUM('BOLETO', 'PIX') NOT NULL,
    `dados` VARCHAR(191) NOT NULL,
    `valor_pago` DECIMAL(10, 2) NULL,
    `registrado_por_id` INTEGER NOT NULL,
    `pago_por_id` INTEGER NULL,
    `pago_em` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pagamentos_compra_id_idx`(`compra_id`),
    INDEX `pagamentos_registrado_por_id_idx`(`registrado_por_id`),
    INDEX `pagamentos_pago_por_id_idx`(`pago_por_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('ORCAMENTO', 'COMPROVANTE_PAGAMENTO', 'NOTA_FISCAL') NOT NULL,
    `nome_original` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `tamanho_bytes` INTEGER NOT NULL,
    `hash` VARCHAR(191) NOT NULL,
    `nome_armazenado` VARCHAR(191) NOT NULL,
    `dono_id` INTEGER NOT NULL,
    `orcamento_id` INTEGER NULL,
    `compra_id` INTEGER NULL,
    `pagamento_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `documentos_nome_armazenado_key`(`nome_armazenado`),
    INDEX `documentos_dono_id_idx`(`dono_id`),
    INDEX `documentos_orcamento_id_idx`(`orcamento_id`),
    INDEX `documentos_compra_id_idx`(`compra_id`),
    INDEX `documentos_pagamento_id_idx`(`pagamento_id`),
    INDEX `documentos_hash_idx`(`hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auditoria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `perfil` ENUM('SOLICITANTE', 'GERENTE', 'GERENTE_FINANCEIRA', 'FINANCEIRO', 'TI', 'ADMINISTRADOR') NOT NULL,
    `acao` ENUM('CRIAR', 'SUBMETER', 'APROVAR', 'REPROVAR', 'CORRIGIR', 'COMPRAR', 'PAGAR', 'CONCLUIR', 'CANCELAR') NOT NULL,
    `entidade` VARCHAR(191) NOT NULL,
    `entidade_id` INTEGER NOT NULL,
    `estado_anterior` VARCHAR(191) NULL,
    `estado_novo` VARCHAR(191) NULL,
    `dados` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditoria_usuario_id_idx`(`usuario_id`),
    INDEX `auditoria_entidade_entidade_id_idx`(`entidade`, `entidade_id`),
    INDEX `auditoria_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notificacoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `mensagem` VARCHAR(191) NOT NULL,
    `lida` BOOLEAN NOT NULL DEFAULT false,
    `lida_em` DATETIME(3) NULL,
    `solicitacao_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notificacoes_usuario_id_lida_idx`(`usuario_id`, `lida`),
    INDEX `notificacoes_solicitacao_id_idx`(`solicitacao_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `permissoes` ADD CONSTRAINT `permissoes_perfil_id_fkey` FOREIGN KEY (`perfil_id`) REFERENCES `perfis`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_perfil_id_fkey` FOREIGN KEY (`perfil_id`) REFERENCES `perfis`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_setor_id_fkey` FOREIGN KEY (`setor_id`) REFERENCES `setores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes` ADD CONSTRAINT `solicitacoes_solicitante_id_fkey` FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes` ADD CONSTRAINT `solicitacoes_setor_id_fkey` FOREIGN KEY (`setor_id`) REFERENCES `setores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacao_itens` ADD CONSTRAINT `solicitacao_itens_solicitacao_id_fkey` FOREIGN KEY (`solicitacao_id`) REFERENCES `solicitacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orcamentos` ADD CONSTRAINT `orcamentos_solicitacao_id_fkey` FOREIGN KEY (`solicitacao_id`) REFERENCES `solicitacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aprovacoes` ADD CONSTRAINT `aprovacoes_solicitacao_id_fkey` FOREIGN KEY (`solicitacao_id`) REFERENCES `solicitacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aprovacoes` ADD CONSTRAINT `aprovacoes_orcamento_id_fkey` FOREIGN KEY (`orcamento_id`) REFERENCES `orcamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aprovacoes` ADD CONSTRAINT `aprovacoes_aprovador_id_fkey` FOREIGN KEY (`aprovador_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `compras` ADD CONSTRAINT `compras_solicitacao_id_fkey` FOREIGN KEY (`solicitacao_id`) REFERENCES `solicitacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `compras` ADD CONSTRAINT `compras_orcamento_id_fkey` FOREIGN KEY (`orcamento_id`) REFERENCES `orcamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `compras` ADD CONSTRAINT `compras_executante_id_fkey` FOREIGN KEY (`executante_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagamentos` ADD CONSTRAINT `pagamentos_compra_id_fkey` FOREIGN KEY (`compra_id`) REFERENCES `compras`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagamentos` ADD CONSTRAINT `pagamentos_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagamentos` ADD CONSTRAINT `pagamentos_pago_por_id_fkey` FOREIGN KEY (`pago_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_dono_id_fkey` FOREIGN KEY (`dono_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_orcamento_id_fkey` FOREIGN KEY (`orcamento_id`) REFERENCES `orcamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_compra_id_fkey` FOREIGN KEY (`compra_id`) REFERENCES `compras`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_pagamento_id_fkey` FOREIGN KEY (`pagamento_id`) REFERENCES `pagamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificacoes` ADD CONSTRAINT `notificacoes_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificacoes` ADD CONSTRAINT `notificacoes_solicitacao_id_fkey` FOREIGN KEY (`solicitacao_id`) REFERENCES `solicitacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
