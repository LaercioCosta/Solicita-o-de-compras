# Relatório de Segurança — Fase 8 (2026-09-26)

Validação contra `docs/orchestrator-spec.md` §19 e `docs/acceptance-criteria.md` CA-09/CA-10.
Evidências: suítes e2e (98/98 backend), varreduras e revisões abaixo.

## Checklist §19 — resultado

| Item | Status | Evidência |
|---|---|---|
| Autenticação | ✓ | `auth.e2e-spec` (15/15): Argon2id, JWT access 15min, refresh 7d com hash sha256 no banco, rotação, logout revoga, mensagens de erro genéricas (sem enumeração de usuários), 400 em payload inválido |
| Autorização | ✓ | `autorizacao-matriz.e2e-spec`: varredura perfil×entidade×ação da matriz + probes negativos; guard default-deny global |
| Sessão | ✓ | Refresh revogável e rotativo; múltiplos dispositivos suportados; `sessoes` só guarda hash |
| APIs | ✓ | JwtAuthGuard global (`/api/health` público); ValidationPipe whitelist + forbidNonWhitelisted; prefixo `/api` |
| Acesso por setor | ✓ | 404/403 cross-setor (`s7`, `a2`, `am`); leitura global da GF (DEC-017) conforme matriz |
| Acesso a documentos | ✓ | Policy de envolvimento por perfil (RN-12/DEC-018) em `fc5`; não-envolvido → 404; ADMIN sem acesso (DEC-013) |
| Uploads | ✓ **endurecido** | Allowlist pdf/png/jpg/jpeg + MIME coerente + ≤10MB + **magic bytes (TASK-066)** + nome UUID no disco + sha256 |
| Arquivos servidos | ✓ | Download autenticado com `Content-Disposition: attachment` (sem execução inline); nome do disco nunca exposto ao cliente (`s16`) |
| Exposição de dados | ✓ | `senhaHash` nunca serializado (`adm3/adm4`); detalhe não vaza `nomeArmazenado`/`hash` (`s16`) |
| Auditoria | ✓ | Append-only sem métodos de alteração/remoção (`auditoria.spec`); leitura exclusiva do ADMIN (DEC-013) |
| Secrets | ✓ | `.env` gitignored; `JWT_SECRET` fail-fast (sem default); sem literals em código (varredura — ver `qa-fase7.md`) |
| LGPD/Retenção | ✓ | DEC-024 **aplicada e documentada** em `architecture.md` §6: auditoria indeterminada; NF/comprovantes 5 anos; sem expurgo automático no MVP |

## Vulnerabilidades de dependências (`npm audit --omit=dev`, 2026-09-26)

Frontend: **0**. Backend: 0 críticas, **5 altas + 1 moderada — todas transitivas do tooling/adapter de banco**:

| Pacote (via) | Vuln | Tratamento |
|---|---|---|
| `mariadb` 3.4.x (@prisma/adapter-mariadb — driver em uso) | senha em claro p/ MitM c/ `ssl:true`; SQL injection em charsets big5/gbk/sjis/cp932/gb18030; transmissão em claro | **Aceito e mitigado**: conexão é loopback no dev e rede interna do compose na produção (DEC-004); app usa **utf8mb4** (fora dos charsets afetados); queries parametrizadas via Prisma; sem correção upstream disponível — reavaliar em upgrades do adapter |
| `deepmerge-ts` <8 (@prisma/config) | stack exhaustion em grafos recursivos | **Aceito**: usado apenas no carregamento de config do Prisma CLI; sem entrada do usuário no caminho |
| `mysql2` <=3.23 (transitivo) | downgrade de auth plugin; bomba de compressão | **Não afetado**: o app usa o adapter mariadb; mysql2 não está no caminho de execução |

Nenhuma vulnerabilidade crítica conhecida. As altas possuem tratamento documentado acima (§19).

## Achados e tratamentos

1. **Upload sem inspeção de conteúdo** (DEC-026 item 8 pedia hardening na Fase 8) → **corrigido (TASK-066)**: magic bytes por extensão (`%PDF-`, assinatura PNG, SOI JPEG); testes: exe disfarçado com MIME de pdf → 400, nada persistido.
2. **Retenção LGPD marcada como pendente** em `architecture.md` → corrigido: DEC-024 aplicada e descrita (política + controle de acesso + attachment).
3. **Rate limiting no login ausente** — risco: brute force. **Aceito no MVP** (ferramenta interna; Argon2id + mensagens de erro genéricas + JWT curto reduzem o impacto). Recomendação registrada para produção futura (proxy/reverse proxy com limitação por IP).
4. **Execução de jobs SLA** (`@nestjs/schedule`) exposta apenas internamente; sem endpoints administrativos de execução manual.

## Gates §19

- 100% endpoints críticos protegidos ✓ · usuário sem permissão não acessa ✓ · outro setor não acessa ✓
- Upload valida tipo/extensão/tamanho (+magic bytes) ✓ · secrets fora do código ✓
- 0 vulnerabilidades críticas ✓ · altas com tratamento documentado ✓ · retenção definida e aplicada ✓

**FASE 8: CONCLUÍDA.** Próxima: Fase 9 — DevOps (Dockerfile, CI/CD, deployment.md).
