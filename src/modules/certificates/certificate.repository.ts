import { pool } from "../../config/db";

export interface CreateCertificateInput {
  nama: string;
  nim: string;
  nomor_ijazah: string;
  cid: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  ledger_tx_id?: string;
  status?: string;
}

export async function insertCertificate(data: CreateCertificateInput) {
  const query = `
    INSERT INTO certificates (
      nama,
      nim,
      nomor_ijazah,
      cid,
      file_name,
      mime_type,
      file_size,
      ledger_tx_id,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;

  const values = [
    data.nama,
    data.nim,
    data.nomor_ijazah,
    data.cid,
    data.file_name,
    data.mime_type,
    data.file_size,
    data.ledger_tx_id || "PENDING_CHAINCODE",
    data.status || "VALID",
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

export async function findCertificateByNomorIjazah(nomorIjazah: string) {
  const result = await pool.query(
    `SELECT * FROM certificates WHERE nomor_ijazah = $1`,
    [nomorIjazah]
  );

  return result.rows[0];
}