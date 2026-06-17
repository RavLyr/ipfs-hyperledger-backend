# Express TypeScript Fabric Gateway Backend

Backend REST API untuk mengakses Hyperledger Fabric chaincode `basic` melalui Fabric Gateway SDK. Backend ini tidak memakai Fabric CLI.

## 1. Install

```bash
npm install
```

## 2. Isi `.env`

Salin `.env.example` menjadi `.env`, lalu sesuaikan path crypto material jika lokasi Fabric repo berbeda.

```bash
cp .env.example .env
```

Contoh nilai development lokal:

```env
PORT=3000
FABRIC_CHANNEL_NAME=appchannel-etcdraft
FABRIC_CHAINCODE_NAME=basic
FABRIC_MSP_ID=Org1MSP
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_PEER_TLS_HOST_OVERRIDE=peer1org1.example.com
FABRIC_TLS_CERT_PATH=/mnt/d/Documents/programming/Blockchain/hyperledger-f/organization/peerOrganizations/org1.example.com/peers/peer1.org1.ravly.com/tls/cacerts/localhost-7054.pem
FABRIC_CLIENT_CERT_PATH=/mnt/d/Documents/programming/Blockchain/hyperledger-f/organization/peerOrganizations/org1.example.com/peers/peer0.org1.ravly.com/msp/signcerts/org1-admin-cert.pem
FABRIC_CLIENT_KEY_PATH=/mnt/d/Documents/programming/Blockchain/hyperledger-f/organization/peerOrganizations/org1.example.com/peers/peer0.org1.ravly.com/msp/keystore/org1-admin-key.pem
```

## 3. Pastikan Fabric Network Hidup

```bash
cd /mnt/d/Documents/programming/Blockchain/hyperledger-f && docker compose ps
```

Peer endpoint dari host harus bisa diakses di `localhost:7051`.

## 4. Run Dev

```bash
npm run dev
```

API berjalan di:

```text
http://localhost:3000
```

## 5. Contoh Request curl

Health API:

```bash
curl http://localhost:3000/health
```

Health Fabric Gateway:

```bash
curl http://localhost:3000/fabric/health
```

Get all assets:

```bash
curl http://localhost:3000/assets
```

Read asset:

```bash
curl http://localhost:3000/assets/asset1
```

Create asset:

```bash
curl -X POST http://localhost:3000/assets \
  -H "Content-Type: application/json" \
  -d '{
    "id": "asset7",
    "color": "purple",
    "size": 20,
    "owner": "Dhanxxi",
    "appraisedValue": 900
  }'
```

Update asset:

```bash
curl -X PUT http://localhost:3000/assets/asset7 \
  -H "Content-Type: application/json" \
  -d '{
    "color": "black",
    "size": 10,
    "owner": "Dhanxxi",
    "appraisedValue": 1000
  }'
```

Transfer asset:

```bash
curl -X POST http://localhost:3000/assets/asset7/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "newOwner": "Alice"
  }'
```

Delete asset:

```bash
curl -X DELETE http://localhost:3000/assets/asset7
```

## 6. Contoh Body JSON untuk Hoppscotch

POST `/assets`

```json
{
  "id": "asset7",
  "color": "purple",
  "size": 20,
  "owner": "Dhanxxi",
  "appraisedValue": 900
}
```

PUT `/assets/:id`

```json
{
  "color": "black",
  "size": 10,
  "owner": "Dhanxxi",
  "appraisedValue": 1000
}
```

POST `/assets/:id/transfer`

```json
{
  "newOwner": "Alice"
}
```

## 7. Catatan Pengembangan Domain Ijazah

Saat chaincode nanti diganti menjadi sistem ijazah, file yang terutama diubah atau ditambah adalah service, schema, controller, dan routes di module domain baru, misalnya `src/modules/ijazah/*`.

Layer `src/fabric/*` tetap dipakai karena sudah berisi koneksi Gateway, pemilihan contract, `evaluateTransaction(functionName, ...args)`, dan `submitTransaction(functionName, ...args)`.

## Response Format

Success:

```json
{
  "success": true,
  "data": {}
}
```

Mutation success:

```json
{
  "success": true,
  "message": "Asset created successfully",
  "data": null
}
```

Error:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "details": {}
  }
}
```

## Scripts

```bash
npm run dev
npm run typecheck
npm run build
npm start
```
