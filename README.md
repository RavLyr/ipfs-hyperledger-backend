# 🎓 Academic Certificate Blockchain & IPFS Gateway Backend

An Express + TypeScript backend that connects the Frontend application with **Hyperledger Fabric (Blockchain)**, **IPFS (Decentralized Storage)**, and **PostgreSQL (Metadata Database)** to provide a secure, transparent, and tamper-resistant academic certificate verification system.
An Express + TypeScript backend that connects the Frontend application with **Hyperledger Fabric (Blockchain)**, **IPFS (Decentralized Storage)**, and **PostgreSQL (Metadata Database)** to provide a secure, transparent, and tamper-resistant academic certificate verification system.

---

# 🏗️ System Architecture & Workflow
# 🏗️ System Architecture & Workflow

This system follows a **hybrid data storage architecture**:
This system follows a **hybrid data storage architecture**:

1. **IPFS (InterPlanetary File System)**

   * Stores the original certificate PDF file.
   * Generates a unique content identifier (**CID**) for each uploaded document.

2. **Hyperledger Fabric (Blockchain Ledger)**

   * Stores the document's digital fingerprint (the IPFS CID) directly as `ipfsCid`.
   * Ensures document integrity and immutability.
   * Tracks certificate status (`ACTIVE`, `REVOKED`, etc.).

3. **PostgreSQL**

   * Stores certificate metadata locally.
   * Enables fast searches (e.g., by Certificate Number) before performing real-time validation against the blockchain.
1. **IPFS (InterPlanetary File System)**

   * Stores the original certificate PDF file.
   * Generates a unique content identifier (**CID**) for each uploaded document.

2. **Hyperledger Fabric (Blockchain Ledger)**

   * Stores the document's digital fingerprint (the IPFS CID) directly as `ipfsCid`.
   * Ensures document integrity and immutability.
   * Tracks certificate status (`ACTIVE`, `REVOKED`, etc.).

3. **PostgreSQL**

   * Stores certificate metadata locally.
   * Enables fast searches (e.g., by Certificate Number) before performing real-time validation against the blockchain.

---

# 🚀 Application Setup & Run Guide
# 🚀 Application Setup & Run Guide

## 1. System Requirements
## 1. System Requirements

Ensure the following software is installed:

* Docker & Docker Compose
* Node.js (LTS, v20+ recommended)
* pnpm or npm

---
Ensure the following software is installed:

* Docker & Docker Compose
* Node.js (LTS, v20+ recommended)
* pnpm or npm

---

## 2. Environment Configuration
## 2. Environment Configuration

Copy `.env.example` to `.env` in the project root directory:
Copy `.env.example` to `.env` in the project root directory:

```bash
cp .env.example .env
```

Modify database credentials and ports as needed.
Modify database credentials and ports as needed.

For the current local workspace, the minimum `.env` values are:
For the current local workspace, the minimum `.env` values are:

```env
DB_PASSWORD=password
IPFS_GATEWAY_PORT=8081
IPFS_GATEWAY_URL=http://localhost:8081
FABRIC_DOCKER_NETWORK=fabric_migration_net
FABRIC_CRYPTO_HOST_PATH=../hyperleger-fabric-ipfs/organization
```

---

## 3. Start Infrastructure Services (Database, IPFS, and Backend)

Run Docker Compose from the project root:
---

## 3. Start Infrastructure Services (Database, IPFS, and Backend)

Run Docker Compose from the project root:

```bash
docker compose up -d
```

Services will be available at:

* Backend API: `http://localhost:3000`
* IPFS Gateway: `http://localhost:8081`
* PostgreSQL: `localhost:5433` (internal container port `5432`)

---

## 4. Start the Blockchain Network (Hyperledger Fabric)

Run the blockchain Docker Compose configuration from the sibling Fabric repository:
Services will be available at:

* Backend API: `http://localhost:3000`
* IPFS Gateway: `http://localhost:8081`
* PostgreSQL: `localhost:5433` (internal container port `5432`)

---

## 4. Start the Blockchain Network (Hyperledger Fabric)

Run the blockchain Docker Compose configuration from the sibling Fabric repository:

```bash
cd ../hyperleger-fabric-ipfs
docker compose up -d
```

Current local Fabric runtime:

* Docker network: `fabric_migration_net`
* Channel: `appchannel-etcdraft`
* Chaincode: `ijazah`
* Current committed definition: version `4.0`, sequence `5`
* Endorsement policy: `OR('Org1MSP.peer','Org2MSP.peer')`

---

## 5. Initialize the Ledger

Before using a fresh ledger, initialize the blockchain ledger to register the demo issuer account. This is idempotent for `DEMO_ISSUER`:

```bash
curl -X POST http://localhost:3000/api/ledger/init
```

---

# 🛰️ Frontend Integration Guide (API Documentation)

> The smart contract and backend use **`ipfsCid`** as the single content identifier. `IssueCertificate` currently sends 9 ledger arguments; richer student and institution metadata is stored in PostgreSQL and documented in `openapi.json`.

---

# 1. Issue / Upload a New Certificate

### Endpoint

```http
POST /api/upload
```

Used by university administrators to register a new certificate and upload its original PDF file.

### Content-Type

```http
multipart/form-data
```

### Form Data Fields

| Field             | Type | Description                                      |
| ----------------- | ---- | ------------------------------------------------ |
| file_ijazah       | File | Original certificate PDF                         |
| certificateNumber | Text | Unique certificate number                        |
| issuerId          | Text | Issuing institution ID (default: `DEMO_ISSUER`)  |
| organizationName  | Text | Issuer organization name                         |
| departmentName    | Text | Issuer department/faculty                        |
| mspId             | Text | Blockchain MSP ID (default: `Org1MSP`)           |
| certificateType   | Text | Certificate category (e.g., `DIPLOMA`)           |
| degreeTitle       | Text | Degree title; mapped to ledger `title` argument  |
| studentId         | Text | Student identification number; hashed for ledger |
| studentName       | Text | Student display name stored in PostgreSQL        |
| universityName    | Text | University display name stored in PostgreSQL     |
| studyProgram      | Text | Study program stored in PostgreSQL               |
| educationLevel    | Text | Education level stored in PostgreSQL             |
| graduationDate    | Text | Optional graduation date (`YYYY-MM-DD`)          |
| issuedAt          | Text | Issue date (`YYYY-MM-DD`)                        |

### Example Success Response

```json
{
  "success": true,
  "message": "Certificate uploaded successfully",
  "data": {
    "...": "..."
  }
}
```

---

# 2. Search & Verify by Certificate Number

### Endpoint

```http
GET /api/verify/:certificateNumber
```

This is the primary public verification endpoint.

The backend will:

1. Search certificate metadata in PostgreSQL.
2. Validate certificate status against the blockchain ledger in real time.
3. Generate an accessible IPFS document URL.

### Example Request
This is the primary public verification endpoint.

The backend will:

1. Search certificate metadata in PostgreSQL.
2. Validate certificate status against the blockchain ledger in real time.
3. Generate an accessible IPFS document URL.

### Example Request

```http
GET /api/verify/CERT-2026-TI-0002
GET /api/verify/CERT-2026-TI-0002
```

### Example Success Response
### Example Success Response

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

### Frontend Implementation Note

If `valid` is `true`, the certificate PDF can be rendered directly using `documentUrl` with:

* `<iframe>`
* PDF Viewer
* Embedded PDF component

---

# 3. Manual PDF Verification

### Endpoint
### Frontend Implementation Note

If `valid` is `true`, the certificate PDF can be rendered directly using `documentUrl` with:

* `<iframe>`
* PDF Viewer
* Embedded PDF component

---

# 3. Manual PDF Verification

### Endpoint

```http
POST /api/certificates/:certificateId/verify
```

Used when the frontend already has an IPFS CID and sends it directly to the blockchain for authenticity verification.

### Request Body

```json
{
  "ipfsCid": "bafkreiagd7rpkbe4s3lsljm2vnk23wrf6e3vsjhrk43z5daxaea7bofgea"
}
```

Replace the value with the IPFS CID generated for the uploaded PDF.

### Valid Document Response

```json
{
  "success": true,
  "data": {
    "certificateId": "2d5a3d1e-3221-44f7-8f3b-e13a0393d625",
    "valid": true,
    "status": "ACTIVE",
    "message": "certificate is valid",
    "revoked": false,
    "tampered": false
  }
}
```

### Tampered Document Response

```json
{
  "success": true,
  "data": {
    "certificateId": "2d5a3d1e-3221-44f7-8f3b-e13a0393d625",
    "valid": false,
    "status": "ACTIVE",
    "message": "IPFS CID does not match certificate record",
    "revoked": false,
    "tampered": true
  }
}
```
POST /api/certificates/:certificateId/verify
```

Used when the frontend already has an IPFS CID and sends it directly to the blockchain for authenticity verification.

### Request Body

```json
{
  "ipfsCid": "bafkreiagd7rpkbe4s3lsljm2vnk23wrf6e3vsjhrk43z5daxaea7bofgea"
}
```

Replace the value with the IPFS CID generated for the uploaded PDF.

### Valid Document Response

```json
{
  "success": true,
  "data": {
    "certificateId": "2d5a3d1e-3221-44f7-8f3b-e13a0393d625",
    "valid": true,
    "status": "ACTIVE",
    "message": "certificate is valid",
    "revoked": false,
    "tampered": false
  }
}
```

### Tampered Document Response

```json
{
  "success": true,
  "data": {
    "certificateId": "2d5a3d1e-3221-44f7-8f3b-e13a0393d625",
    "valid": false,
    "status": "ACTIVE",
    "message": "IPFS CID does not match certificate record",
    "revoked": false,
    "tampered": true
  }
}
```

---

# 🛠️ Development Scripts

The following npm scripts are available in the project root:

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `npm run dev`       | Start the development server      |
| `npm run build`     | Compile TypeScript for production |
| `npm run typecheck` | Run TypeScript type analysis      |
| `npm test`          | Execute the test suite            |
The following npm scripts are available in the project root:

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `npm run dev`       | Start the development server      |
| `npm run build`     | Compile TypeScript for production |
| `npm run typecheck` | Run TypeScript type analysis      |
| `npm test`          | Execute the test suite            |

---

# 📌 Technology Stack

* **Backend:** Express.js + TypeScript
* **Blockchain:** Hyperledger Fabric
* **Storage:** IPFS
* **Database:** PostgreSQL
* **Containerization:** Docker & Docker Compose

---

## Key Features

* Secure certificate issuance and verification
* Tamper-proof certificate records using blockchain
* Decentralized document storage via IPFS
* Real-time blockchain validation
* Fast metadata lookup through PostgreSQL
* Manual document authenticity verification using IPFS CID
* Dockerized deployment environment

This architecture combines decentralized storage, blockchain immutability, and traditional database performance while keeping `ipfsCid` as the single document fingerprint.
# 📌 Technology Stack

* **Backend:** Express.js + TypeScript
* **Blockchain:** Hyperledger Fabric
* **Storage:** IPFS
* **Database:** PostgreSQL
* **Containerization:** Docker & Docker Compose

---

## Key Features

* Secure certificate issuance and verification
* Tamper-proof certificate records using blockchain
* Decentralized document storage via IPFS
* Real-time blockchain validation
* Fast metadata lookup through PostgreSQL
* Manual document authenticity verification using IPFS CID
* Dockerized deployment environment

This architecture combines decentralized storage, blockchain immutability, and traditional database performance while keeping `ipfsCid` as the single document fingerprint.
