# ──────────── Stage 1: Base ────────────
FROM node:22-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN corepack enable

# ──────────── Stage 2: Build (Dependencies + Compilation + Prisma Generate) ────────────
FROM base AS build

# Native deps (pkcs11js, bcrypt) need node-gyp build tools
RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN pnpm prisma generate
RUN pnpm build

# ──────────── Stage 3: Runtime ────────────
FROM base AS runtime

ENV NODE_ENV=production

# Copy built node_modules directly (includes generated Prisma client and engine)
COPY --from=build /app/node_modules ./node_modules

# Prisma schema (needed by prisma migrate deploy in the migrate service)
COPY prisma ./prisma
COPY package.json ./

# Compiled JS output
COPY --from=build /app/dist ./dist

# Security: run as non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "dist/main.js"]
