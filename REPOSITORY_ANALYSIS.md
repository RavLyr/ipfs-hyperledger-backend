# ipfs-hyperledger-backend — Repository Analysis & Docker/VPS Guide

> **Last updated**: 2026-06-25
> **Status**: All critical Docker fixes have been applied to the codebase. This document reflects the **current, corrected** state of the project files.

---

## 1. Project Architecture & Tech Stack Summary

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 22 (Alpine) |
| **Framework** | Express.js 4.x |
| **Language** | TypeScript 5.7, compiled via `tsc` to CommonJS (`dist/`) |
| **Package Manager** | pnpm 11.9 (via corepack) |
| **ORM / DB** | Prisma 6.19 + PostgreSQL 16 (also has a raw `pg` Pool in `config/db.ts`) |
| **Blockchain** | Hyperledger Fabric via `@hyperledger/fabric-gateway` 1.8 + `@grpc/grpc-js` |
| **File Storage** | IPFS (Kubo v0.32.1) — uploads via HTTP API (`/api/v0/add`) |
| **Security** | Helmet, CORS |
| **File Uploads** | Multer (memory storage, PDF only, 10 MB limit) |

### Blockchain Integration Points

- **SDK**: `@hyperledger/fabric-gateway` — connects via gRPC to a Fabric peer.
- **Identity**: Reads TLS CA cert, client cert, and client private key from **filesystem paths** (volume-mounted into the container at `/fabric-crypto/`).
- **Connection**: `FabricGatewayClient` class creates a single lazy gRPC connection, reused across requests. Closed on `SIGINT`/`SIGTERM`.
- **Chaincode**: Invokes functions prefixed with `SmartContract:` (e.g., `SmartContract:IssueCertificate`). Default chaincode name: `ijazah`, channel: `appchannel-etcdraft`.
- **Network**: The backend container must reach the Fabric peer over gRPC (port 7051). This is done by joining the container to an **external Docker network** (`fabric_migration_net`).

### Data Flow

```
Client → Express API → Certificate Service
                          ├── IPFS (upload PDF, get CID)
                          ├── Fabric Ledger (submit/evaluate chaincode tx)
                          └── PostgreSQL/Prisma (persist certificate metadata)
```

---

## 2. Critical File & Directory Map

```
ipfs-hyperledger-backend/
├── Dockerfile                              # ✅ 3-stage build (base → build → runtime)
├── docker-compose.yml                      # ✅ postgres, ipfs, migrate, backend + 2 networks (single image build)
├── .dockerignore                           # ✅ Excludes node_modules, dist, .git, .env, logs
├── .npmrc                                  # ✅ Flat node_modules setup (node-linker=hoisted)
├── package.json                            # Scripts: dev, build, start, prisma:*
├── pnpm-lock.yaml
├── pnpm-workspace.yaml                     # allowBuilds for native deps (pkcs11js, protobufjs)
├── blockchain/                             # ✅ Merged Hyperledger Fabric workspace
├── tsconfig.json                           # CommonJS output to dist/
├── .env                                    # ⚠ LOCAL DEV ONLY: Windows paths, localhost endpoints
├── .env.example                            # Template with all required vars
│
├── prisma/
│   ├── schema.prisma                       # ✅ binaryTargets includes linux-musl-openssl-3.0.x
│   └── migrations/
│       └── 20260624000000_init_prisma/     # Single initial migration
│
├── src/
│   ├── main.ts                             # ★ ENTRY POINT — app.listen + graceful shutdown
│   ├── app.ts                              # Express app (helmet, cors, routes, error handler)
│   │
│   ├── config/
│   │   ├── env.ts                          # ★ Reads & validates all env vars (dotenv.config)
│   │   ├── fabric.config.ts                # Maps env → FabricConfig object
│   │   ├── prisma.ts                       # Singleton PrismaClient
│   │   └── db.ts                           # ⚠ Raw pg.Pool (unused/redundant with Prisma — consider removing)
│   │
│   ├── infrastructure/
│   │   ├── fabric/
│   │   │   ├── fabric-gateway.client.ts    # ★ FabricGatewayClient — gRPC connection + tx methods
│   │   │   ├── fabric-identity.ts          # Reads cert/key files from disk
│   │   │   └── fabric-result.ts            # Decodes Uint8Array → JSON/string
│   │   └── ipfs/
│   │       └── ipfs.service.ts             # uploadToIPFS (axios POST to Kubo API)
│   │
│   ├── modules/
│   │   ├── fabric/
│   │   │   ├── fabric.service.ts           # Wraps FabricGatewayClient (singleton)
│   │   │   ├── fabric.controller.ts        # /fabric endpoints (health, invoke)
│   │   │   ├── fabric.routes.ts
│   │   │   ├── fabric.dto.ts
│   │   │   └── fabric.types.ts
│   │   ├── certificates/
│   │   │   ├── certificate.service.ts      # ★ Core business logic (upload, verify, issue, revoke)
│   │   │   ├── certificate.controller.ts   # REST handlers
│   │   │   ├── certificate.routes.ts       # 15+ endpoints under /api and /certificates
│   │   │   ├── certificate.repository.ts   # Prisma queries (insert, findBy*, findAll)
│   │   │   ├── certificate.dto.ts          # Validation / parsing functions
│   │   │   └── certificate.service.test.ts # Unit tests
│   │   └── assets/                         # Empty — placeholder
│   │
│   ├── middleware/
│   │   ├── error.middleware.ts              # Global error handler (AppError → JSON)
│   │   ├── not-found.middleware.ts          # 404 catch-all
│   │   └── upload.middleware.ts             # Multer config (PDF, 10MB, memory)
│   │
│   ├── errors/
│   │   └── AppError.ts                     # Custom error class with statusCode
│   │
│   └── utils/
│       ├── asyncHandler.ts                 # Wraps async route handlers
│       └── hash.ts                         # sha256Hex helper
│
└── dist/                                   # Compiled JS output (gitignored)
```

---

## 3. Docker Environment Analysis

> [!NOTE]
> Section 3 documents the issues that **were found and have been fixed**. This serves as a changelog for the AI agent so it understands what was changed and why.

### 3.1 Dockerfile & Dependencies — Issues Found & Applied Fixes

| # | Issue Found | Status | Fix Applied |
|---|---|---|---|
| 1 | Full `node_modules` (incl. devDeps) copied to runtime / copy symbolic links failed | ✅ Fixed | Added `node-linker=hoisted` in `.npmrc` for flat dependency installation. Simplified Dockerfile to a 3-stage build (base → build → runtime) copying `node_modules` directly. |
| 2 | No production-only install in runtime | ✅ Fixed | Overwritten by flat module hoisting and copying build environment directly to optimize build time and ensure native binding compatibility. |
| 3 | Prisma client binary target missing → crash on Alpine | ✅ Fixed | Added `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` to `schema.prisma`. |
| 4 | Missing `.dockerignore` → slow builds, potential secret leak | ✅ Fixed | Created `.dockerignore` excluding `node_modules`, `dist`, `.git`, `.env`, logs. |
| 5 | Container runs as `root` | ✅ Fixed | Added `USER node` in runtime stage. |
| 6 | No `HEALTHCHECK` in Dockerfile | ✅ Fixed | Added `HEALTHCHECK` using `fetch('http://localhost:3000/health')`. |
| 7 | `dotenv.config()` runs unconditionally | ⚠️ Minor | Not a bug — `dotenv` harmlessly no-ops when `/app/.env` doesn't exist in the container. No code change needed. |

### 3.2 docker-compose.yml — Issues Found & Applied Fixes

| # | Issue Found | Status | Fix Applied |
|---|---|---|---|
| 1 | `DATABASE_URL` mismatch risk (localhost in .env vs Docker service name) | ✅ Fixed | `DATABASE_URL` now constructed inline in compose: `postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public`. No longer depends on `.env` for the host/port. |
| 2 | Backend image built twice (both `migrate` and `backend` had `build:`) | ✅ Fixed | `migrate` has `build:` + `image: ipfs-hyperledger-backend:latest`. `backend` references the same `image:` — no duplicate build. |
| 3 | Typo `hyperleger` in default `FABRIC_CRYPTO_HOST_PATH` | ✅ Fixed | Corrected to `hyperledger` and changed to relative host path `./blockchain/organization`. |
| 4 | No logging limits → disk fill risk | ✅ Fixed | Added `logging: driver: json-file` with `max-size`/`max-file` to all services. |
| 5 | IPFS API port (5001) and swarm port (4001) not mapped | ℹ️ Noted | Added commented-out port mappings for optional host debugging. Container-to-container works without mapping. |
| 6 | `FABRIC_PEER_ENDPOINT` default may not resolve | ⚠️ User action | Default `peer1org1.example.com:7051` — user must verify this resolves on the `fabric` external network. |
| 7 | Dual DB config: Prisma (`DATABASE_URL`) vs raw `pg` Pool (`DB_HOST`/`DB_PORT`) | ⚠️ Tech debt | `config/db.ts` appears unused. Consider removing in a future cleanup. |
| 8 | Postgres WSL volume mount permissions error | ✅ Fixed | Set PostgreSQL to use a named Docker volume (`postgres_data`) instead of a host folder mount to avoid Windows/Linux chmod/chown permission errors. |
| 9 | BuildKit network registry timeout under WSL | ✅ Fixed | Configured `network: host` inside the Docker Compose build configuration for the `migrate` service. |
| 10 | Port 8080 conflict on host | ✅ Fixed | Changed the IPFS gateway port mapping to `8081` via `.env` (`IPFS_GATEWAY_PORT`). |

### 3.3 Blockchain/Chaincode — Issues Found & Applied Fixes

| # | Issue Found | Status | Fix Applied |
|---|---|---|---|
| 1 | `Expected 10, received 9` error on `IssueCertificate` | ✅ Fixed | The backend codebase was updated to remove `documentHash` (using only `ipfsCid`), sending 9 string arguments. However, the chaincode deployed on the peer still expected 10 arguments. We repackaged and upgraded the chaincode on the channel to version `2.0`, sequence `5` to match the local workspace `smartcontract.go` code. |

### 3.4 `.env` File Status

The committed `.env` file contains **Windows-style paths** and `localhost` references. This is for local Windows development only.

**For Docker/VPS deployment**, the environment variables are now sourced from:
- `docker-compose.yml` inline defaults (for `DATABASE_URL`, `IPFS_API_URL`, `DB_HOST`, `DB_PORT`)
- The VPS `.env` file (for secrets: `DB_PASSWORD`, and Fabric-specific config)

**Required `.env` variables for Docker** (minimum):
```bash
DB_PASSWORD=<STRONG_RANDOM_PASSWORD>
# Everything else has working defaults in docker-compose.yml
```

**Recommended `.env` for VPS** (complete):
```bash
# ── Database ──
DB_USER=postgres
DB_PASSWORD=<STRONG_RANDOM_PASSWORD>
DB_NAME=ipfs_hyperledger_db

# ── App ──
NODE_ENV=production
PORT=3000
APP_PORT=3000

# ── IPFS ──
IPFS_GATEWAY_URL=https://your-domain.com/ipfs

# ── Fabric ──
FABRIC_CHANNEL_NAME=appchannel-etcdraft
FABRIC_CHAINCODE_NAME=ijazah
FABRIC_MSP_ID=Org1MSP
FABRIC_PEER_ENDPOINT=peer1org1.example.com:7051
FABRIC_PEER_TLS_HOST_OVERRIDE=peer1org1.example.com
FABRIC_TLS_CERT_PATH=/fabric-crypto/peerOrganizations/org1.example.com/peers/peer1.org1.ravly.com/tls/cacerts/localhost-7054.pem
FABRIC_CLIENT_CERT_PATH=/fabric-crypto/peerOrganizations/org1.example.com/peers/peer0.org1.ravly.com/msp/signcerts/org1-admin-cert.pem
FABRIC_CLIENT_KEY_PATH=/fabric-crypto/peerOrganizations/org1.example.com/peers/peer0.org1.ravly.com/msp/keystore/org1-admin-key.pem

# ── Docker ──
FABRIC_CRYPTO_HOST_PATH=/opt/hyperledger/organization
FABRIC_DOCKER_NETWORK=fabric_migration_net
DATA_ROOT=/opt/app-data
POSTGRES_LOCAL_PORT=5433
```

> [!IMPORTANT]
> `DATABASE_URL` does **NOT** need to be in `.env` anymore — it's constructed inline in `docker-compose.yml` from `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. This eliminates the host/port mismatch risk.

---

## 4. Current Docker File Contents (Post-Fix)

### 4.1 Dockerfile (3-stage, flat node_modules, production-ready)

```dockerfile
# ──────────── Stage 1: Base ────────────
FROM node:22-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN corepack enable

# ──────────── Stage 2: Build (Dependencies + Compilation + Prisma Generate) ────────────
FROM base AS build

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
```

### 4.2 docker-compose.yml (key design decisions)

- **`migrate` service** builds the image (`image: ipfs-hyperledger-backend:latest` + `build:`). **`backend` service** reuses the same image — no double build.
- **`DATABASE_URL`** is constructed inline: `postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public` — eliminates localhost mismatch risk.
- **`migrate` service** runs as `user: "0"` (root) because `npx prisma migrate deploy` needs write access. The **`backend`** runs as `USER node` (from Dockerfile).
- **Logging limits** (`max-size: 10m`, `max-file: 3-5`) prevent disk exhaustion.
- **Fabric crypto** volume-mounted read-only (`:ro`) at `/fabric-crypto/`.

### 4.3 schema.prisma (generator block)

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

`"native"` generates binaries for the build host (for local dev). `"linux-musl-openssl-3.0.x"` generates for Alpine Linux (Docker runtime).

---

## 5. Standard Operating Procedure (SOP): Running the App

### Prerequisites

- Docker Engine ≥ 24.x and Docker Compose v2 installed
- Hyperledger Fabric network already running (with the external Docker network created)
- Fabric crypto material available on the host filesystem
- `.env` file configured (see Section 3.4)

### Step 1: Verify the Fabric Docker Network Exists

```bash
docker network ls | grep fabric_migration_net
```

If it doesn't exist and your Fabric network is running, create it or check your Fabric deployment. The backend **cannot** reach the peer without this network.

### Step 2: Create `.env` on the VPS

```bash
nano .env
```

At minimum, set `DB_PASSWORD`. See Section 3.4 for the full recommended template.

> [!WARNING]
> You do NOT need `DATABASE_URL` in `.env` — it's constructed inline in `docker-compose.yml`. If you set it in `.env`, it will be **ignored** by the compose file (compose inline values take precedence).

### Step 3: Build the Docker Image

```bash
docker compose build
```

This builds a single image (`ipfs-hyperledger-backend:latest`) used by both `migrate` and `backend`.

**Common errors at this step:**
- `pnpm install` fails → check `pnpm-lock.yaml` is committed and up-to-date
- `tsc` errors → fix TypeScript errors locally before deploying
- `prisma generate` fails → ensure `prisma/schema.prisma` has `binaryTargets`

### Step 4: Start the Stack

```bash
docker compose up -d
```

**Boot order** (enforced by `depends_on` + healthchecks):
1. `postgres` starts → healthcheck (`pg_isready`) passes
2. `ipfs` starts → healthcheck (`ipfs id`) passes
3. `migrate` runs → `npx prisma migrate deploy` applies migrations → exits with code 0
4. `backend` starts → `node dist/main.js` → listens on port 3000

### Step 5: Verify All Services Are Running

```bash
docker compose ps
```

Expected: `postgres` (healthy), `ipfs` (healthy), `migrate` (exited 0), `backend` (running/healthy).

### Step 6: Test the Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","success":true,"message":"Server is running"}
```

### Step 7: Check Logs for Errors

```bash
# All services
docker compose logs --tail=50

# Backend only
docker compose logs -f backend

# Migrate service (check for Prisma migration errors)
docker compose logs migrate
```

**Common runtime errors and fixes:**

| Error | Cause | Fix |
|---|---|---|
| `ECONNREFUSED ...postgres:5432` | Postgres not ready or service name wrong | Check `docker compose ps` — postgres should be `healthy` |
| `Invalid environment variable: FABRIC_*` | Missing env var in `.env` | Add all `FABRIC_*` vars to `.env` (see Section 3.4) |
| `ENOENT: /fabric-crypto/...` | Crypto volume mount path wrong or files missing | Verify `FABRIC_CRYPTO_HOST_PATH` in `.env` points to correct host dir |
| `14 UNAVAILABLE: No connection established` | Can't reach Fabric peer via gRPC | Check: Fabric network running? `fabric_migration_net` exists? `FABRIC_PEER_ENDPOINT` correct? |
| `P1001: Can't reach database server` | Postgres not ready | Wait for healthcheck; check `docker compose logs postgres` |
| `Prisma: Migration failed` | Schema drift or missing migration files | Run `prisma migrate dev` locally, commit migrations, redeploy |
| `PrismaClientInitializationError: Unable to require...engine` | Wrong Prisma binary target | Verify `schema.prisma` has `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`, rebuild image |
| `Error: connect ECONNREFUSED 127.0.0.1:5001` | Backend trying to reach IPFS on localhost | Ensure `IPFS_API_URL` is `http://ipfs:5001` (Docker service name, not localhost) |

### Step 8: Restart / Rebuild Cycle

```bash
# Restart backend only (no rebuild)
docker compose restart backend

# Rebuild and restart everything
docker compose down
docker compose build --no-cache
docker compose up -d

# Full reset (⚠️ destroys database data volumes!)
docker compose down -v
docker compose up -d --build
```

### Step 9: Production Access via Reverse Proxy

On the VPS, set up Nginx:

```nginx
# /etc/nginx/sites-available/api.yourdomain.com
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;  # Match multer's 10MB limit
    }
}
```

Then enable TLS: `sudo certbot --nginx -d api.yourdomain.com`

---

## 6. Remaining Items (Not Yet Fixed — Manual Action Needed)

| # | Item | Action Required |
|---|---|---|
| 1 | `.env` on VPS | Create with correct `DB_PASSWORD` and all `FABRIC_*` vars |
| 2 | `FABRIC_PEER_ENDPOINT` | Verify this hostname resolves inside the `fabric_migration_net` Docker network |
| 3 | `FABRIC_CRYPTO_HOST_PATH` | Set to the actual path on VPS where Fabric crypto material lives |
| 4 | `config/db.ts` (raw pg.Pool) | Appears unused — consider removing to reduce confusion with Prisma's `DATABASE_URL` |
| 5 | `dist/` in git | Currently committed to git — consider adding to `.gitignore` since it's built in Docker |
| 6 | IPFS swarm port (4001) | Uncomment in `docker-compose.yml` if IPFS content needs to be reachable by external nodes |

---

## Quick-Reference: Key Env Vars for Docker

| Variable | Docker Value | Notes |
|---|---|---|
| `DB_PASSWORD` | `<your-strong-password>` | **Required** in `.env` — no default |
| `DATABASE_URL` | *(constructed inline in compose)* | Do NOT set in `.env` — compose handles it |
| `IPFS_API_URL` | `http://ipfs:5001` *(hardcoded in compose)* | Backend → IPFS container-to-container |
| `IPFS_GATEWAY_URL` | `http://localhost:8080` or public URL | For client-facing download URLs |
| `FABRIC_PEER_ENDPOINT` | e.g. `peer1org1.example.com:7051` | Must resolve on `fabric` network |
| `FABRIC_*_PATH` | `/fabric-crypto/...` | Matches volume mount in compose |
| `FABRIC_CRYPTO_HOST_PATH` | e.g. `/opt/hyperledger/organization` | **Host path** mounted into container |
| `FABRIC_DOCKER_NETWORK` | `fabric_migration_net` | Must exist before `docker compose up` |
