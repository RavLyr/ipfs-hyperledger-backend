import { pool } from "../../config/db";
import type { Certificate, CreateCertificateInput } from "./certificate.dto";

type CertificateRow = {
  id: number;

  nama_mahasiswa: string;
  nim: string;
  email_mahasiswa: string;
  program_studi: string;
  fakultas: string;
  tahun_masuk: number;
  tahun_lulus: number;
  nomor_ijazah: string;
  tanggal_terbit_ijazah: string;

  cid: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: string | number | null;

  ledger_tx_id: string;
  status: "VALID" | "REVOKED";

  created_at: string;
  updated_at: string;
};

function mapCertificateRow(row: CertificateRow): Certificate {
  return {
    ...row,
    file_size: row.file_size === null ? null : Number(row.file_size),
  };
}

export async function insertCertificate(
  data: CreateCertificateInput
): Promise<Certificate> {
  const query = `
    INSERT INTO certificates (
      nama_mahasiswa,
      nim,
      email_mahasiswa,
      program_studi,
      fakultas,
      tahun_masuk,
      tahun_lulus,
      nomor_ijazah,
      tanggal_terbit_ijazah,
      cid,
      file_name,
      mime_type,
      file_size,
      ledger_tx_id,
      status
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15
    )
    RETURNING
      id,
      nama_mahasiswa,
      nim,
      email_mahasiswa,
      program_studi,
      fakultas,
      tahun_masuk,
      tahun_lulus,
      nomor_ijazah,
      tanggal_terbit_ijazah::TEXT,
      cid,
      file_name,
      mime_type,
      file_size,
      ledger_tx_id,
      status,
      created_at::TEXT,
      updated_at::TEXT;
  `;

  const values = [
    data.nama_mahasiswa,
    data.nim,
    data.email_mahasiswa,
    data.program_studi,
    data.fakultas,
    data.tahun_masuk,
    data.tahun_lulus,
    data.nomor_ijazah,
    data.tanggal_terbit_ijazah,
    data.cid,
    data.file_name,
    data.mime_type,
    data.file_size,
    data.ledger_tx_id,
    data.status,
  ];

  const result = await pool.query<CertificateRow>(query, values);

  return mapCertificateRow(result.rows[0]);
}

export async function findCertificateByNomorIjazah(
  nomorIjazah: string
): Promise<Certificate | null> {
  const query = `
    SELECT
      id,
      nama_mahasiswa,
      nim,
      email_mahasiswa,
      program_studi,
      fakultas,
      tahun_masuk,
      tahun_lulus,
      nomor_ijazah,
      tanggal_terbit_ijazah::TEXT,
      cid,
      file_name,
      mime_type,
      file_size,
      ledger_tx_id,
      status,
      created_at::TEXT,
      updated_at::TEXT
    FROM certificates
    WHERE nomor_ijazah = $1
    LIMIT 1;
  `;

  const result = await pool.query<CertificateRow>(query, [nomorIjazah]);
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return mapCertificateRow(row);
}

export async function findAllCertificates(): Promise<Certificate[]> {
  const query = `
    SELECT
      id,
      nama_mahasiswa,
      nim,
      email_mahasiswa,
      program_studi,
      fakultas,
      tahun_masuk,
      tahun_lulus,
      nomor_ijazah,
      tanggal_terbit_ijazah::TEXT,
      cid,
      file_name,
      mime_type,
      file_size,
      ledger_tx_id,
      status,
      created_at::TEXT,
      updated_at::TEXT
    FROM certificates
    ORDER BY created_at DESC;
  `;

  const result = await pool.query<CertificateRow>(query);

  return result.rows.map(mapCertificateRow);
}