# Banco de dados em desenvolvimento — MariaDB user-space (sem Docker, sem sudo)

> **Contexto:** o ambiente de dev não dispõe de Docker nem de sudo (DEC-007). Este documento
> descreve como rodar um servidor MariaDB compatível com MySQL totalmente em user-space, para
> que o Prisma execute as migrations da Fase 3.
>
> **Produção/outros ambientes usam Docker via docker-compose (DEC-004).** O procedimento abaixo
> é exclusivo para desenvolvimento local nesta máquina.

## Resumo do ambiente instalado

| Item       | Valor                                             |
|------------|---------------------------------------------------|
| Distribuição | Tarball binário oficial MariaDB 11.4.13 (LTS) `linux-systemd-x86_64` |
| Instalação  | `~/.local/mariadb` (~1,2 GB extraído; tarball de 343 MB em `/tmp/opencode`) |
| Datadir     | `~/.local/mariadb-data` (persistente)            |
| Porta       | `3306` em `127.0.0.1` (igual ao `DATABASE_URL` do `.env.example`) |
| Socket      | `/tmp/opencode/mariadb-sock/mariadb.sock`         |
| PID file    | `/tmp/opencode/mariadbd.pid`                      |
| Error log   | `/tmp/opencode/mariadb-sock/mariadbd.err`         |
| Usuário SO  | `laercio` (sem root; binários rodam sem systemd)   |

Credenciais de DEV (já presentes no `.env.example` versionado — não são segredos):
banco `compras`, usuário `compras`, senha `compraspass`.
URL: `mysql://compras:compraspass@localhost:3306/compras`

Apesar do sufixo do tarball, o build `linux-systemd-x86_64` é apenas a plataforma de build
(glibc); **não exige systemd** — o `mariadbd` é iniciado manualmente, sem privilégios.

## Reprodução do zero

### 1. Download do tarball binário (sem compilação)

```bash
mkdir -p /tmp/opencode && cd /tmp/opencode
curl -sO https://archive.mariadb.org/mariadb-11.4.13/bintar-linux-systemd-x86_64/mariadb-11.4.13-linux-systemd-x86_64.tar.gz

# verificar integridade (comparar com o valor publicado em sha256sums.txt)
curl -s https://archive.mariadb.org/mariadb-11.4.13/bintar-linux-systemd-x86_64/sha256sums.txt
sha256sum mariadb-11.4.13-linux-systemd-x86_64.tar.gz
# esperado: 3cebf63914df3154b7cb6d548337eb2be42c773aeb641110446b72e2746cfed7
```

### 2. Extração user-space

```bash
mkdir -p ~/.local/mariadb
tar -xzf /tmp/opencode/mariadb-11.4.13-linux-systemd-x86_64.tar.gz \
  -C ~/.local/mariadb --strip-components=1

# sanidade: sem libs faltando e binário executável
ldd ~/.local/mariadb/bin/mariadbd | grep -i "not found"   # não deve imprimir nada
~/.local/mariadb/bin/mariadbd --version
```

### 3. Inicialização do datadir (user-space)

```bash
mkdir -p ~/.local/mariadb-data /tmp/opencode/mariadb-sock

~/.local/mariadb/scripts/mariadb-install-db \
  --basedir=$HOME/.local/mariadb \
  --datadir=$HOME/.local/mariadb-data \
  --auth-root-authentication-method=normal \
  --skip-test-db
```

### 4. Iniciar o servidor (background, sem systemd)

```bash
nohup ~/.local/mariadb/bin/mariadbd \
  --datadir=$HOME/.local/mariadb-data \
  --socket=/tmp/opencode/mariadb-sock/mariadb.sock \
  --pid-file=/tmp/opencode/mariadbd.pid \
  --port=3306 \
  --bind-address=127.0.0.1 \
  --log-error=/tmp/opencode/mariadb-sock/mariadbd.err \
  > /tmp/opencode/mariadb-sock/mariadbd-out.log 2>&1 &
```

Verificação de que subiu:

```bash
sleep 4
cat /tmp/opencode/mariadbd.pid          # PID do servidor
ss -ltn | grep 3306                      # 127.0.0.1:3306 LISTEN
tail /tmp/opencode/mariadb-sock/mariadbd.err
```

### 5. Criar banco e usuário de dev

```bash
~/.local/mariadb/bin/mariadb --socket=/tmp/opencode/mariadb-sock/mariadb.sock -u root -e "
CREATE DATABASE IF NOT EXISTS compras CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'compras'@'localhost' IDENTIFIED BY 'compraspass';
CREATE USER IF NOT EXISTS 'compras'@'127.0.0.1' IDENTIFIED BY 'compraspass';
GRANT ALL PRIVILEGES ON compras.* TO 'compras'@'localhost';
GRANT ALL PRIVILEGES ON compras.* TO 'compras'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`prisma_migrate_shadow_db_%\`.* TO 'compras'@'localhost';
GRANT ALL PRIVILEGES ON \`prisma_migrate_shadow_db_%\`.* TO 'compras'@'127.0.0.1';"
```

> O grant `prisma_migrate_shadow_db_%` é exigido pelo `prisma migrate dev` (workaround oficial
> do Prisma para dev, erro P3014 — o Prisma cria/descarta uma shadow database temporária
> para calcular diffs). O banco é dev e descartável; em produção usa-se `prisma migrate deploy`
> via docker-compose, que não precisa de shadow database.

### 6. Prova de conectividade (como o Prisma conecta: TCP em localhost)

```bash
~/.local/mariadb/bin/mariadb -h 127.0.0.1 -P 3306 -u compras -pcompraspass \
  -e "SELECT VERSION(); SHOW DATABASES;"
```

## Operação cotidiana

### Parar o servidor

```bash
kill $(cat /tmp/opencode/mariadbd.pid)
```

### Iniciar novamente (datadir já inicializado — NÃO rode mariadb-install-db de novo)

```bash
# exatamente o comando do passo 4 acima
```

### Reset total do banco (destrutivo — só em dev)

```bash
kill $(cat /tmp/opencode/mariadbd.pid) 2>/dev/null
rm -rf ~/.local/mariadb-data && mkdir -p ~/.local/mariadb-data
# repetir passos 3, 4 e 5
```

## Integração com o Prisma 7 (descobertas da sonda TASK-032)

Verificado com Prisma CLI 7.10.0 contra este servidor, usando uma sonda descartável
(`prisma db execute`, `prisma migrate diff`):

1. **A URL do datasource NÃO fica mais no `schema.prisma`** no Prisma 7 — fica no arquivo
   de config `prisma.config.ts` (na raiz de `backend/`; confirmado via `prisma --help`,
   que referencia `./prisma.config.ts` como default). Deixar `url` no `schema.prisma`
   causa erro de validação `P1012`. O `datasource` do schema fica só com
   `provider = "mysql"`.
2. `prisma db execute` (7.x) **não aceita mais `--schema`**; lê o datasource do
   `prisma.config.ts` do diretório corrente (ou via `--config`).
3. `prisma migrate diff` usa `--to-schema <arquivo>` (não mais `--to-schema-datamodel`) e
   `--from-config-datasource` para introspecionar o banco vivo.
4. O dialeto MySQL gerado (AUTO_INCREMENT, DATETIME(3), utf8mb4_unicode_ci) é compatível
   com este MariaDB 11.4; a introspecção do servidor vivo também funcionou.

Modelo mínimo de `prisma.config.ts` (para a task de migrations — a URL deve vir do `.env` via `process.env`):

```ts
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: "mysql://compras:compraspass@localhost:3306/compras",
  },
});
```

## Estado atual (TASK-032)

- Servidor **rodando** (ver `cat /tmp/opencode/mariadbd.pid`), porta 3306 em 127.0.0.1.
- Banco `compras` criado e **vazio**, pronto para as migrations da Fase 3.
- `SELECT VERSION()` → `11.4.13-MariaDB`.
