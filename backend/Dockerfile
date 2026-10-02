# Backend — build multi-stage (Fase 9, DEC-004)
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
# Dependências de produção + CLI do Prisma para `migrate deploy` no boot
RUN npm ci --omit=dev && npm install --no-save prisma@7.10.0
COPY --from=build /app/dist ./dist
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN mkdir -p uploads
EXPOSE 3000
# Migrations idempotentes antes de subir a API (spec §20: banco criado automaticamente)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
