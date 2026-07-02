# 🧪 End-to-End Test Guide

Panduan ini dirancang agar AI agent atau developer lain dapat menjalankan pengujian E2E secara mandiri untuk memverifikasi bahwa semua fitur backend berjalan dengan benar.

---

## Prasyarat

- Docker & Docker Compose sudah berjalan.
- Container backend (`ipfs-hyperledger-backend-backend-1`), PostgreSQL, dan IPFS sudah menyala.
- Jaringan Hyperledger Fabric (container `cli.example.com`, peer, orderer) sudah aktif di `fabric_migration_net`.
- Ledger sudah pernah diinisialisasi minimal sekali.

Cek status container:

```bash
docker compose ps
docker exec cli.example.com peer lifecycle chaincode querycommitted -C appchannel-etcdraft -n ijazah
```

---

## Alur Test

Jalankan test secara berurutan. Setiap langkah bergantung pada data dari langkah sebelumnya.

---

## Step 0: Health Check

Pastikan server backend hidup.

```bash
curl -s http://localhost:3000/health | jq .
```

**Expected:**

```json
{
  "status": "ok",
  "success": true,
  "message": "Server is running"
}
```

---

## Step 1: Login untuk Mendapatkan JWT Token

Hampir semua endpoint `/api/*` dilindungi oleh middleware `requireIssuerAdmin()`. Anda harus login terlebih dahulu untuk mendapatkan `accessToken`.

```bash
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin", "password": "admin123"}')

echo "$LOGIN_RESPONSE" | jq .

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')
ISSUER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.issuer.issuerId')

echo "Token: $TOKEN"
echo "Issuer: $ISSUER_ID"
```

**Expected:** `success: true` dengan objek `data.accessToken` dan `data.issuer`.

> **Catatan:** Jika issuer admin belum ada di database, Anda perlu membuat seed data terlebih dahulu. Lihat bagian **Troubleshooting** di bawah.

---

## Step 2: Inisialisasi Ledger

Endpoint ini mendaftarkan `DEMO_ISSUER` ke blockchain (idempoten).

```bash
curl -s -X POST http://localhost:3000/api/ledger/init \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected:** `success: true`.

---

## Step 3: Cek Fabric Gateway Health

```bash
curl -s http://localhost:3000/api/fabric/health \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected:**

```json
{
  "status": "connected",
  "success": true,
  "channel": "appchannel-etcdraft"
}
```

---

## Step 4: Upload & Terbitkan Sertifikat Baru

Ini adalah fitur utama. Upload file PDF ke IPFS → catat CID ke blockchain → simpan metadata ke PostgreSQL.

```bash
# Buat file dummy untuk test
echo "E2E test certificate content - $(date +%s)" > /tmp/e2e_test.pdf

UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file_ijazah=@/tmp/e2e_test.pdf" \
  -F "certificateNumber=E2E-TEST-$(date +%s)" \
  -F "issuerId=$ISSUER_ID" \
  -F "organizationName=Universitas Diponegoro" \
  -F "departmentName=Fakultas Teknik" \
  -F "mspId=Org1MSP" \
  -F "certificateType=DIPLOMA" \
  -F "degreeTitle=Sarjana Teknik Informatika" \
  -F "studentId=NIM-E2E-001" \
  -F "studentName=Test Student E2E" \
  -F "studyProgram=Teknik Informatika" \
  -F "educationLevel=S1" \
  -F "issuedAt=2026-06-30")

echo "$UPLOAD_RESPONSE" | jq .

# Simpan nilai penting untuk langkah selanjutnya
CERT_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.certificateId')
CERT_NUMBER=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.certificateNumber')
IPFS_CID=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.ipfsCid')
LEDGER_TX_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.data.ledger_tx_id')

echo "Certificate ID: $CERT_ID"
echo "Certificate Number: $CERT_NUMBER"
echo "IPFS CID: $IPFS_CID"
echo "Ledger Tx ID: $LEDGER_TX_ID"
```

**Expected:**

- `success: true`
- `data.certificateId` berisi UUID
- `data.ipfsCid` berisi string `bafkrei...`
- `data.ledger_tx_id` berisi hash transaksi Fabric
- `data.status` = `"VALID"`
- `data.degreeTitle`, `data.studentName`, `data.studyProgram`, `data.educationLevel` terisi sesuai input

**Validasi:**

```bash
# Pastikan semua field tidak kosong
[ -n "$CERT_ID" ] && [ "$CERT_ID" != "null" ] && echo "✅ CERT_ID OK" || echo "❌ CERT_ID MISSING"
[ -n "$IPFS_CID" ] && [ "$IPFS_CID" != "null" ] && echo "✅ IPFS_CID OK" || echo "❌ IPFS_CID MISSING"
[ -n "$LEDGER_TX_ID" ] && [ "$LEDGER_TX_ID" != "null" ] && echo "✅ LEDGER_TX OK" || echo "❌ LEDGER_TX MISSING"
```

---

## Step 5: Verifikasi Publik via Nomor Ijazah

Endpoint ini **tidak memerlukan JWT**. Ini adalah endpoint utama untuk frontend publik.

```bash
curl -s "http://localhost:3000/api/verify/$CERT_NUMBER" | jq .
```

**Expected:**

```json
{
  "success": true,
  "valid": true,
  "message": "certificate is valid",
  "ledgerData": { "...": "status: ACTIVE, tampered: false, revoked: false" },
  "dbData": { "...": "metadata sertifikat dari PostgreSQL" },
  "documentUrl": "http://localhost:8081/ipfs/<IPFS_CID>"
}
```

**Validasi kunci:**

- `valid` harus `true`
- `ledgerData.status` harus `"ACTIVE"`
- `ledgerData.tampered` harus `false`
- `ledgerData.revoked` harus `false`
- `documentUrl` harus berisi IPFS gateway URL yang bisa diakses

Endpoint alias (tanpa prefix `/api`):

```bash
curl -s "http://localhost:3000/verify/$CERT_NUMBER" | jq .
```

---

## Step 6: Verifikasi Manual via IPFS CID (Ledger Direct)

Verifikasi langsung ke blockchain menggunakan `certificateId` dan `ipfsCid`.

### 6a. Verifikasi dengan CID yang benar (expect: valid)

```bash
curl -s -X POST "http://localhost:3000/api/certificates/$CERT_ID/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"ipfsCid\": \"$IPFS_CID\"}" | jq .
```

**Expected:** `data.valid: true`, `data.tampered: false`

### 6b. Verifikasi dengan CID palsu (expect: tampered)

```bash
curl -s -X POST "http://localhost:3000/api/certificates/$CERT_ID/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ipfsCid": "bafkreiFAKECIDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}' | jq .
```

**Expected:** `data.valid: false`, `data.tampered: true`, `data.message` berisi pesan CID tidak cocok.

---

## Step 7: List Semua Sertifikat

### 7a. List dari Database (publik, tanpa JWT)

```bash
curl -s "http://localhost:3000/api/" | jq '.data | length'
```

**Expected:** Jumlah sertifikat >= 1.

### 7b. List dari Blockchain Ledger (butuh JWT)

```bash
curl -s "http://localhost:3000/api/certificates" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected:** `success: true` dengan array data sertifikat dari world state blockchain.

---

## Step 8: Revoke Sertifikat

```bash
REVOKE_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/certificates/$CERT_ID/revoke" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "E2E test revocation"}')

echo "$REVOKE_RESPONSE" | jq .
```

**Expected:** `success: true`.

### 8a. Verifikasi ulang setelah revoke

```bash
curl -s "http://localhost:3000/api/verify/$CERT_NUMBER" | jq '{valid, message, status: .ledgerData.status, revoked: .ledgerData.revoked}'
```

**Expected:**

```json
{
  "valid": false,
  "message": "certificate has been revoked",
  "status": "REVOKED",
  "revoked": true
}
```

### 8b. Cek detail revokasi

```bash
curl -s "http://localhost:3000/api/certificates/$CERT_ID/revocation" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected:** Objek dengan `certificateId`, `reasonHash`, dan `revokedAt`.

---

## Step 9: Riwayat Audit Sertifikat

```bash
curl -s "http://localhost:3000/api/certificates/$CERT_ID/history" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected:** Array `data[]` berisi minimal 2 entri (1x issue + 1x revoke), masing-masing punya `txId`, `timestamp`, dan `value`.

---

## Step 10: Validasi Silang ke Blockchain Langsung

Jika container Fabric CLI tersedia, verifikasi data langsung ke peer:

```bash
docker exec cli.example.com peer chaincode query \
  -C appchannel-etcdraft -n ijazah \
  -c "{\"Args\":[\"SmartContract:GetCertificate\",\"$CERT_ID\"]}" | jq .
```

**Expected:** Objek sertifikat dari world state dengan `status: "REVOKED"` dan field `ipfsCid` sesuai.

---

## Ringkasan Checklist

| # | Test Case | Endpoint | Auth | Expected |
|---|-----------|----------|------|----------|
| 0 | Health check | `GET /health` | ❌ | `status: ok` |
| 1 | Login | `POST /auth/login` | ❌ | `accessToken` returned |
| 2 | Init ledger | `POST /api/ledger/init` | ✅ JWT | `success: true` |
| 3 | Fabric health | `GET /api/fabric/health` | ✅ JWT | `status: connected` |
| 4 | Upload certificate | `POST /api/upload` | ✅ JWT | `certificateId`, `ipfsCid`, `ledger_tx_id` returned |
| 5 | Public verify | `GET /api/verify/:certNumber` | ❌ | `valid: true`, `documentUrl` present |
| 5a | Public verify alias | `GET /verify/:certNumber` | ❌ | Same as above |
| 6a | Manual verify (valid CID) | `POST /api/certificates/:id/verify` | ✅ JWT | `valid: true`, `tampered: false` |
| 6b | Manual verify (fake CID) | `POST /api/certificates/:id/verify` | ✅ JWT | `valid: false`, `tampered: true` |
| 7a | List DB certificates | `GET /api/` | ❌ | Array with >= 1 item |
| 7b | List ledger certificates | `GET /api/certificates` | ✅ JWT | Array from blockchain |
| 8 | Revoke certificate | `POST /api/certificates/:id/revoke` | ✅ JWT | `success: true` |
| 8a | Verify after revoke | `GET /api/verify/:certNumber` | ❌ | `valid: false`, `revoked: true` |
| 8b | Revocation details | `GET /api/certificates/:id/revocation` | ✅ JWT | Revocation record |
| 9 | Audit history | `GET /api/certificates/:id/history` | ✅ JWT | Array with >= 2 entries |
| 10 | Cross-validate blockchain | Docker CLI | N/A | Data matches API |

---

## Troubleshooting

### Login gagal (401 / issuer not found)

Issuer admin mungkin belum ada di database PostgreSQL. Periksa seed data:

```bash
docker exec ipfs-hyperledger-backend-backend-1 npx prisma db seed
```

Atau buat issuer secara manual via endpoint `/api/issuers` jika tersedia.

### Upload gagal: "issuer not found in ledger"

Jalankan `POST /api/ledger/init` terlebih dahulu untuk mendaftarkan issuer ke blockchain.

### Fabric Gateway error: "failed to connect"

Pastikan container Fabric (peer, orderer) sudah berjalan dan terhubung ke network `fabric_migration_net`:

```bash
docker network inspect fabric_migration_net | jq '.[0].Containers | keys'
```

### IPFS upload gagal

Pastikan container IPFS sudah healthy:

```bash
docker exec ipfs-hyperledger-backend-ipfs-1 ipfs id
```
