# Academic Certificate Fabric Gateway Backend

Express TypeScript backend untuk Hyperledger Fabric Certificate Lifecycle Chaincode. Backend ini hanya mengirim metadata auditable ke ledger; PDF dan data mahasiswa sensitif tetap berada di backend/storage eksternal.

## Scope Ledger

Ledger menyimpan:

- Issuer metadata
- Certificate metadata
- Revocation record
- Reissue record
- Certificate history dari Fabric

Ledger tidak menyimpan:

- PDF
- nama mahasiswa
- NIM mentah
- tanggal lahir
- IPK
- verification log backend

## Install

```bash
npm install
```

## Environment

Salin `.env.example` menjadi `.env`, lalu sesuaikan channel, chaincode, peer endpoint, dan crypto material.

```bash
cp .env.example .env
```

Contoh:

```env
PORT=3000
FABRIC_CHANNEL_NAME=appchannel-etcdraft
FABRIC_CHAINCODE_NAME=basic
FABRIC_MSP_ID=Org1MSP
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_PEER_TLS_HOST_OVERRIDE=peer1org1.example.com
FABRIC_TLS_CERT_PATH=/mnt/d/path/to/tls-ca.pem
FABRIC_CLIENT_CERT_PATH=/mnt/d/path/to/signcert.pem
FABRIC_CLIENT_KEY_PATH=/mnt/d/path/to/private-key.pem
```

## Run

```bash
npm run dev
```

API berjalan di:

```text
http://localhost:3000
```

## API

Health:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/fabric/health
```

Initialize ledger:

```bash
curl -X POST http://localhost:3000/api/ledger/init
```

Register issuer:

```bash
curl -X POST http://localhost:3000/api/issuers \
  -H "Content-Type: application/json" \
  -d '{
    "issuerId": "DEMO_ISSUER",
    "organizationName": "Demo University",
    "departmentName": "Academic Office",
    "mspId": "Org1MSP"
  }'
```

Get issuer:

```bash
curl http://localhost:3000/api/issuers/DEMO_ISSUER
curl http://localhost:3000/api/issuers/DEMO_ISSUER/exists
```

Issue certificate:

```bash
curl -X POST http://localhost:3000/api/certificates \
  -H "Content-Type: application/json" \
  -d '{
    "certificateId": "CERT-001",
    "certificateNumber": "NO-001",
    "studentId": "NIM-RAW-001",
    "issuerId": "DEMO_ISSUER",
    "certificateType": "DIPLOMA",
    "title": "Bachelor Certificate",
    "documentBase64": "BASE64_PDF_BYTES",
    "ipfsCid": "bafy...",
    "issuedAt": "2026-06-18T00:00:00Z",
    "expiredAt": ""
  }'
```

Backend akan hash `studentId` menjadi `studentIdHash` dan hash bytes dari `documentBase64` menjadi `documentHash` sebelum memanggil chaincode. Jika hash sudah dihitung di layer lain, kirim `studentIdHash` dan `documentHash` langsung.

Verify certificate:

```bash
curl -X POST http://localhost:3000/api/certificates/CERT-001/verify \
  -H "Content-Type: application/json" \
  -d '{
    "documentBase64": "BASE64_PDF_BYTES"
  }'
```

Revoke certificate:

```bash
curl -X POST http://localhost:3000/api/certificates/CERT-001/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Incorrect uploaded document",
    "revokedAt": "2026-06-18T01:00:00Z"
  }'
```

Backend akan hash `reason` menjadi `reasonHash` sebelum memanggil ledger.

Reissue certificate:

```bash
curl -X POST http://localhost:3000/api/certificates/CERT-001/reissue \
  -H "Content-Type: application/json" \
  -d '{
    "newCertificateId": "CERT-002",
    "newCertificateNumber": "NO-002",
    "newDocumentBase64": "BASE64_NEW_PDF_BYTES",
    "newIpfsCid": "bafy-new...",
    "reason": "Corrected document",
    "reissuedAt": "2026-06-18T02:00:00Z"
  }'
```

Other reads:

```bash
curl http://localhost:3000/api/certificates
curl http://localhost:3000/api/certificates/CERT-001
curl http://localhost:3000/api/certificates/CERT-001/exists
curl http://localhost:3000/api/certificates/CERT-001/revocation
curl http://localhost:3000/api/certificates/CERT-001/history
curl http://localhost:3000/api/issuers/DEMO_ISSUER/certificates
```

## Chaincode Mapping

- `InitLedger()`
- `RegisterIssuer(issuerID, organizationName, departmentName, mspID)`
- `GetIssuer(issuerID)`
- `IssuerExists(issuerID)`
- `IssueCertificate(certificateID, certificateNumber, studentIDHash, issuerID, certificateType, title, documentHash, ipfsCid, issuedAt, expiredAt)`
- `GetCertificate(certificateID)`
- `CertificateExists(certificateID)`
- `VerifyCertificate(certificateID, documentHash)`
- `RevokeCertificate(certificateID, reasonHash, revokedAt)`
- `GetRevocationInfo(certificateID)`
- `ReissueCertificate(oldCertificateID, newCertificateID, newCertificateNumber, newDocumentHash, newIpfsCid, reasonHash, reissuedAt)`
- `GetCertificateHistory(certificateID)`
- `GetAllCertificates()`
- `GetCertificatesByIssuer(issuerID)`

## Scripts

```bash
npm run dev
npm run typecheck
npm test
npm run build
npm start
```
