# 🎓 Academic Certificate Blockchain & IPFS Gateway Backend

An Express + TypeScript backend that connects the frontend application with **Hyperledger Fabric (blockchain)**, **IPFS (decentralized storage)**, and **PostgreSQL (metadata database)** to provide a secure, transparent, and tamper-resistant academic certificate verification system.

---

# 🏗️ System Architecture & Auth Overview

This system follows a hybrid data storage architecture:

1. **IPFS** stores the original certificate PDF file and returns a CID.
2. **Hyperledger Fabric** stores certificate integrity metadata and issuer ownership compatibility data.
3. **PostgreSQL** stores issuer administrator accounts and searchable certificate metadata.

## Guest flow

Guests do **not** log in. They may only:

- `GET /health`
- `GET /api/verify/:certificateNumber`
- `GET /verify/:certificateNumber` (alias)
- the public PostgreSQL-backed certificate search/list endpoint

## Issuer admin flow

Issuer administrator accounts are seeded manually through Prisma seed. There is currently one seeded issuer admin:

- `issuerId`: `UNDIP`
- `organizationName`: `Universitas Diponegoro`
- `departmentName`: `Fakultas Teknik`
- `mspId`: `Org1MSP`
- `username`: `admin`
- `email`: `admin@undip.ac.id`

Issuer admins log in through:

```http
POST /auth/login
```

Request body:

```json
{
  "identifier": "admin",
  "password": "admin123"
}
```

`identifier` accepts username or email. Passwords are verified with bcrypt. Login returns a Bearer JWT.

JWT payload contains only:

- `issuerId`
- `role`

All issuer compatibility fields are always loaded from PostgreSQL after JWT verification:

- `issuerId`
- `organizationName`
- `departmentName`
- `mspId`

The backend never trusts those values from authenticated request bodies.

---

# 🔐 Upload authorization and automatic issuer derivation

Authenticated upload flow:

JWT
↓
issuerId
↓
load Issuer from database
↓
derive `issuerId`, `organizationName`, `departmentName`, `mspId`
↓
register issuer on Fabric if missing
↓
issue certificate on Fabric
↓
persist PostgreSQL certificate metadata

Frontend upload requests must **not** be treated as source of truth for issuer ownership fields. Those values are derived server-side from the authenticated issuer account.

---

# 🚀 Application Setup

## 1. Requirements

- Docker & Docker Compose
- Node.js (v20+ recommended)
- pnpm or npm

## 2. Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Make sure `JWT_SECRET` is set.

Minimum local values:

```env
DB_PASSWORD=password
JWT_SECRET=change-this-jwt-secret
IPFS_GATEWAY_PORT=8081
IPFS_GATEWAY_URL=http://localhost:8081
FABRIC_DOCKER_NETWORK=fabric_migration_net
FABRIC_CRYPTO_HOST_PATH=../hyperleger-fabric-ipfs/organization
```

## 3. Start services

```bash
docker compose up -d
```

## 4. Start Fabric network

```bash
cd ../hyperleger-fabric-ipfs
docker compose up -d
```

## 5. Seed issuer admin account

```bash
pnpm prisma db seed
```

This seeds the default issuer administrator account used for login.

---

# 🛰️ API overview

## Public verification

Canonical guest verification endpoint:

```http
GET /api/verify/:certificateNumber
```

Legacy alias remains available:

```http
GET /verify/:certificateNumber
```

Example response:

```json
{
  "success": true,
  "valid": true,
  "message": "certificate is valid",
  "ledgerData": {},
  "dbData": {},
  "documentUrl": "http://localhost:8081/ipfs/<CID>"
}
```

## Protected upload

```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Frontend sends only certificate-specific metadata and PDF file. Issuer compatibility fields are derived from the logged-in issuer account.

## Protected legacy endpoints

All legacy admin/debug/ledger endpoints remain in place for compatibility, but are protected by issuer authentication, including:

- `/api/upload`
- `/api/certificates`
- `/api/certificates/:certificateId/*`
- `/api/issuers/*`
- `/fabric/*`
- `/api/fabric/*`
- `/api/ledger/init`

---

# 🛠️ Development Scripts

| Command | Description |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm prisma generate` | Generate Prisma client |
| `pnpm prisma migrate dev --name issuer_auth` | Create/apply migration |
| `pnpm prisma db seed` | Seed default issuer admin |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm build` | Build production output |
| `pnpm test` | Run tests |

---

# 📌 Notes

- The current `mspId` values remain temporary compatibility values until the Fabric repository is refactored.
- Fabric identity loading remains unchanged and continues to use environment-configured Fabric credentials.
- Legacy duplicated routes are preserved for now and can be cleaned up later after auth is stable.
