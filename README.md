# 🎓 Academic Certificate Blockchain & IPFS Gateway Backend

An Express + TypeScript backend that connects the frontend application with **IPFS (Decentralized Storage)**, **PostgreSQL (Metadata Database)**, and a placeholder **Hyperledger Fabric** integration to provide a secure, transparent, and tamper-resistant academic certificate verification system.

---

# 🏗️ System Architecture & Workflow

This system follows a hybrid data storage architecture:

1. **IPFS (InterPlanetary File System)**
   - Stores the original certificate PDF file.
   - Generates a unique content identifier (**CID**) for each uploaded document.

2. **PostgreSQL**
   - Stores the final backend certificate metadata.
   - Acts as the current source of truth for certificate metadata.
   - Enables fast searches by certificate number before optional ledger verification.

3. **Hyperledger Fabric (Placeholder Integration)**
   - The backend still attempts the legacy Fabric service call during upload and verification.
   - Fabric failure does **not** block metadata persistence to PostgreSQL.
   - `ledgerTxId` may remain `null` until Fabric is fully refactored in a later stage.

---

# 🚀 Application Setup & Run Guide

## 1. System Requirements

Ensure the following software is installed:

- Docker & Docker Compose
- Node.js (LTS, v20+ recommended)
- pnpm or npm

---

## 2. Environment Configuration

Copy `.env.example` to `.env` in the project root directory:

```bash
cp .env.example .env
```

Modify database credentials and ports as needed.

---

## 3. Start Infrastructure Services (Database, IPFS, and Backend)

Run Docker Compose from the project root:

```bash
docker compose up -d
```

Services will be available at:

- Backend API: `http://localhost:3000`
- IPFS Gateway: `http://localhost:8081` (or `http://localhost:8080`)
- PostgreSQL: `localhost:5433` (internal container port `5432`)

---

# 🛰️ Frontend Integration Guide (API Documentation)

> The backend uses **`ipfsCid`** as the document content identifier. Backend metadata now follows the final certificate business model and is stored in PostgreSQL.

---

# 1. Upload a New Certificate

### Endpoint

```http
POST /api/upload
```

Used by administrators to register a new certificate and upload its original PDF file.

### Content-Type

```http
multipart/form-data
```

### Form Data Fields

| Field                          | Type | Description |
| ------------------------------ | ---- | ----------- |
| file_ijazah                    | File | Original certificate PDF |
| certificateId                  | Text | Optional backend certificate identifier |
| certificateNumber              | Text | Official certificate number |
| studentName                    | Text | Student full name |
| studentId                      | Text | Student identification number |
| graduationDate                 | Text | Graduation date (`YYYY-MM-DD`) |
| studyProgram                   | Text | Study program |
| faculty                        | Text | Faculty |
| degreeLevel                    | Text | Degree level, e.g. `S1` |
| degreeName                     | Text | Degree name |
| degreeAbbreviation             | Text | Degree abbreviation |
| universityName                 | Text | University name |
| universityAccreditationNumber  | Text | University accreditation number |
| programAccreditationAgency     | Text | Program accreditation agency |
| programAccreditationNumber     | Text | Program accreditation number |
| issueDate                      | Text | Issue date (`YYYY-MM-DD`) |
| deanName                       | Text | Dean name |
| rectorName                     | Text | Rector name |
| issuer                         | Text | Issuer display name |

### Example Success Response

```json
{
  "success": true,
  "message": "Certificate uploaded successfully",
  "data": {
    "id": "11111111-2222-3333-4444-555555555555",
    "certificateId": "CERT-TEST-2026-000001",
    "certificateNumber": "TEST-2026-000001",
    "studentName": "TEST STUDENT",
    "studentId": "23000000000000",
    "graduationDate": "2026-06-30",
    "studyProgram": "Program Studi Contoh",
    "faculty": "Fakultas Contoh",
    "degreeLevel": "S1",
    "degreeName": "Sarjana Contoh",
    "degreeAbbreviation": "S.C.",
    "universityName": "Universitas Contoh",
    "universityAccreditationNumber": "ACC-UNIV-TEST-001",
    "programAccreditationAgency": "Example Accreditation Agency",
    "programAccreditationNumber": "ACC-PROGRAM-TEST-001",
    "issueDate": "2026-07-15",
    "deanName": "Prof. Example Dean",
    "rectorName": "Prof. Example Rector",
    "fileName": "certificate-test.pdf",
    "ipfsCid": "bafybeigdummydocumentcid000000000000000000000000000",
    "ledgerTxId": null,
    "issuer": "Universitas Contoh",
    "status": "VALID",
    "createdAt": "2026-06-30T10:15:23.000Z",
    "updatedAt": "2026-06-30T10:15:23.000Z"
  }
}
```

---

# 2. Search & Verify by Certificate Number

### Endpoint

```http
GET /api/verify/:nomorIjazah
```

This is the primary public verification endpoint.

The backend will:

1. Search certificate metadata in PostgreSQL.
2. Attempt legacy blockchain verification using the stored `certificateId` and `ipfsCid`.
3. Return the final backend metadata plus an accessible IPFS document URL when verification succeeds.

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

---

# 3. Manual PDF Verification

### Endpoint

```http
POST /api/certificates/:certificateId/verify
```

Used when the frontend already has an IPFS CID and wants to send it directly to the existing Fabric verification placeholder.

### Request Body

```json
{
  "ipfsCid": "bafybeigdummydocumentcid000000000000000000000000000"
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

---

# 📌 Technology Stack

- **Backend:** Express.js + TypeScript
- **Blockchain:** Hyperledger Fabric (placeholder integration in this stage)
- **Storage:** IPFS
- **Database:** PostgreSQL
- **Containerization:** Docker & Docker Compose

---

## Key Features

- Final backend certificate metadata model
- PDF upload to IPFS
- PostgreSQL persistence as current backend source of truth
- Public verification by certificate number
- Optional ledger verification placeholder
- Fast metadata lookup through PostgreSQL
- Dockerized deployment environment
