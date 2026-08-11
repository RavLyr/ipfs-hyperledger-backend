#!/usr/bin/env node
/**
 * Blockchain Stress Test — Parallel Batch Performance Testing
 *
 * Measures write (IPFS + Fabric + DB) and read (DB + Fabric + IPFS check)
 * throughput across 5 tiers: 1, 10, 100, 1000, 10000 concurrent requests.
 *
 * Usage:
 *   node scripts/stress-test-blockchain.mjs [options]
 *
 * Options:
 *   --pdf-size=tiny|medium|large   PDF size per upload (default: tiny)
 *   --max-tier=N                   Run tiers up to N (1-5, default: 5)
 *   --read-only                    Skip write test, use existing write_results.csv
 *   --write-only                   Skip read test
 *   --api=URL                      API base URL (default: http://localhost:3000)
 *   --concurrency=N                Override max concurrency (default: auto per tier)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

// ─── Config ───────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARGS = parseArgs(process.argv.slice(2));
const RUN_NAME = ARGS['run-name'] || ARGS['out-dir'] || '';
const RESULTS_DIR = RUN_NAME
  ? path.join(__dirname, 'results', RUN_NAME)
  : path.join(__dirname, 'results');
const API = ARGS.api || 'http://localhost:3000';
const MAX_TIER = Math.min(Number(ARGS['max-tier'] || 5), 5);
const READ_ONLY = ARGS['read-only'] === true;
const WRITE_ONLY = ARGS['write-only'] === true;
const PDF_SIZE_PRESET = ARGS['pdf-size'] || 'tiny';
const CONCURRENCY_OVERRIDE = ARGS.concurrency ? Number(ARGS.concurrency) : null;

const PDF_SIZES = { tiny: 1024, medium: 1024 * 1024, large: 5 * 1024 * 1024 };
const PDF_BYTES = PDF_SIZES[PDF_SIZE_PRESET] || PDF_SIZES.tiny;

const TIERS = [1, 10, 100, 1000, 10000].slice(0, MAX_TIER);
const TIER_CONCURRENCY = { 1: 1, 10: 10, 100: 50, 1000: 100, 10000: 200 };

const MAX_RETRIES = 3;
const COOLDOWN_MS = 5000;

const CREDENTIALS = { identifier: 'admin', password: 'admin123' };

// Shared HTTP agent with high socket limit
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 250,
  maxFreeSockets: 50,
  timeout: 120_000,
});

// ─── Helpers ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      args[key] = val === undefined ? true : val;
    }
  }
  return args;
}

function generatePDF(sizeBytes) {
  const header = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n');
  const padding = Buffer.alloc(Math.max(0, sizeBytes - header.length), 0x20);
  return Buffer.concat([header, padding]);
}

function generateCertNumber(tier, seq) {
  const ts = Date.now();
  return `PERF-T${tier}-${ts}-${String(seq).padStart(5, '0')}`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function nowISO() {
  return new Date().toISOString();
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeStats(latencies) {
  if (latencies.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, p50: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(sum / sorted.length),
    median: percentile(sorted, 50),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

// ─── Semaphore ────────────────────────────────────────────────────────
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }
  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise(resolve => this.queue.push(resolve));
  }
  release() {
    this.current--;
    if (this.queue.length > 0) {
      this.current++;
      this.queue.shift()();
    }
  }
  async run(fn) {
    await this.acquire();
    try { return await fn(); }
    finally { this.release(); }
  }
}

// ─── HTTP Request ─────────────────────────────────────────────────────
async function request(urlPath, options = {}) {
  const url = `${API}${urlPath}`;
  const fetchOptions = { ...options, agent };

  const response = await fetch(url, fetchOptions);
  const text = await response.text();

  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  return { status: response.status, ok: response.ok, json, text };
}

async function login() {
  const res = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS),
  });

  const token = res.json?.data?.accessToken || res.json?.accessToken;
  const issuerId = res.json?.data?.issuer?.issuerId || res.json?.issuer?.issuerId || 'UNDIP';
  if (!res.ok || !token) {
    throw new Error(`Login failed: ${res.text}`);
  }
  return { token, issuerId };
}

// ─── CSV Writer ───────────────────────────────────────────────────────
class CSVWriter {
  constructor(filepath, headers) {
    this.filepath = filepath;
    this.headers = headers;
    fs.writeFileSync(filepath, headers.join(',') + '\n');
  }
  appendRow(values) {
    const escaped = values.map(v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    });
    fs.appendFileSync(this.filepath, escaped.join(',') + '\n');
  }
}

// ─── Write Test ───────────────────────────────────────────────────────

async function uploadCertificate(token, issuerId, certNumber, pdfBuffer) {
  const boundary = `----FormBoundary${crypto.randomBytes(8).toString('hex')}`;
  const issuedAt = new Date().toISOString().split('T')[0];
  const certId = `CERT-${crypto.randomUUID()}`;

  const fields = {
    certificateNumber: certNumber,
    certificateId: certId,
    issuerId: issuerId,
    organizationName: 'Universitas Diponegoro',
    departmentName: 'Teknik Informatika',
    mspId: 'Org1MSP',
    certificateType: 'DIPLOMA',
    degreeTitle: 'Sarjana Komputer',
    studentId: `STU-${certNumber}`,
    studentName: `Mahasiswa ${certNumber}`,
    faculty: 'Fakultas Teknik',
    studyProgram: 'Teknik Informatika',
    educationLevel: 'S1',
    issuedAt,
  };

  let body = '';
  for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
  }

  const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file_ijazah"; filename="${certNumber}.pdf"\r\nContent-Type: application/pdf\r\n\r\n`;
  const fileFooter = `\r\n--${boundary}--\r\n`;

  const bodyBuffer = Buffer.concat([
    Buffer.from(body + fileHeader),
    pdfBuffer,
    Buffer.from(fileFooter),
  ]);

  const res = await request('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Authorization': `Bearer ${token}`,
    },
    body: bodyBuffer,
  });

  return res;
}

async function writeTier(tierNum, batchSize, token, issuerId, csv, pdfBuffer) {
  const concurrency = CONCURRENCY_OVERRIDE || TIER_CONCURRENCY[batchSize] || batchSize;
  const sem = new Semaphore(concurrency);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  WRITE TIER ${tierNum}: ${batchSize} requests (concurrency: ${concurrency})`);
  console.log(`${'═'.repeat(60)}`);

  const results = [];
  let completed = 0;

  const tierStart = Date.now();

  const promises = Array.from({ length: batchSize }, (_, i) => {
    const seq = i + 1;
    const certNumber = generateCertNumber(tierNum, seq);

    return sem.run(async () => {
      let retryCount = 0;
      let lastError = '';

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const startTime = nowISO();
        const startMs = Date.now();

        try {
          const res = await uploadCertificate(token, issuerId, certNumber, pdfBuffer);
          const latency = Date.now() - startMs;
          const endTime = nowISO();

          const cert = res.json?.data?.certificate || res.json?.data || res.json?.certificate;
          if (res.ok && cert && cert.certificateId) {
            const row = {
              tier: tierNum, batch_size: batchSize, sequence: seq,
              certificate_number: certNumber, start_time_iso: startTime,
              end_time_iso: endTime, latency_ms: latency,
              tx_id: cert.ledgerTxId || '', ipfs_cid: cert.ipfsCid || '',
              retry_count: retryCount, status: 'SUCCESS', error: '',
            };
            csv.appendRow(Object.values(row));
            results.push(row);

            completed++;
            if (completed % Math.max(1, Math.floor(batchSize / 10)) === 0 || completed === batchSize) {
              const elapsed = ((Date.now() - tierStart) / 1000).toFixed(1);
              process.stdout.write(`\r  Progress: ${completed}/${batchSize} (${elapsed}s)`);
            }
            return row;
          }

          // Check for MVCC conflict
          const errMsg = res.json?.error?.message || res.json?.message || res.text || '';
          const isMVCC = /MVCC_READ_CONFLICT|version mismatch/i.test(errMsg);

          if (isMVCC && attempt < MAX_RETRIES) {
            retryCount++;
            await sleep(500 * Math.pow(2, attempt - 1));
            continue;
          }

          // Non-retryable error or last attempt
          const row = {
            tier: tierNum, batch_size: batchSize, sequence: seq,
            certificate_number: certNumber, start_time_iso: startTime,
            end_time_iso: endTime, latency_ms: latency,
            tx_id: '', ipfs_cid: '', retry_count: retryCount,
            status: 'FAIL', error: errMsg.slice(0, 200),
          };
          csv.appendRow(Object.values(row));
          results.push(row);
          completed++;
          return row;

        } catch (err) {
          const latency = Date.now() - startMs;
          if (attempt < MAX_RETRIES) {
            retryCount++;
            await sleep(500 * Math.pow(2, attempt - 1));
            continue;
          }

          const row = {
            tier: tierNum, batch_size: batchSize, sequence: seq,
            certificate_number: certNumber, start_time_iso: startTime,
            end_time_iso: nowISO(), latency_ms: latency,
            tx_id: '', ipfs_cid: '', retry_count: retryCount,
            status: 'FAIL', error: (err.message || '').slice(0, 200),
          };
          csv.appendRow(Object.values(row));
          results.push(row);
          completed++;
          return row;
        }
      }
    });
  });

  await Promise.allSettled(promises);
  const tierEnd = Date.now();
  const totalTime = tierEnd - tierStart;

  const successes = results.filter(r => r.status === 'SUCCESS');
  const fails = results.filter(r => r.status === 'FAIL');
  const latencies = successes.map(r => r.latency_ms);
  const stats = computeStats(latencies);

  console.log(`\n  ✅ Done in ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`     Success: ${successes.length} | Fail: ${fails.length} | Rate: ${((successes.length / batchSize) * 100).toFixed(1)}%`);
  console.log(`     Throughput: ${(successes.length / (totalTime / 1000)).toFixed(2)} tx/s`);
  console.log(`     Latency: min=${stats.min}ms mean=${stats.mean}ms p95=${stats.p95}ms max=${stats.max}ms`);

  return {
    scenario: 'WRITE', tier: tierNum, batch_size: batchSize,
    total_time_ms: totalTime,
    success_count: successes.length, fail_count: fails.length,
    success_rate_pct: ((successes.length / batchSize) * 100).toFixed(1),
    throughput_tps: (successes.length / (totalTime / 1000)).toFixed(2),
    ...stats,
    avg_retries: (results.reduce((s, r) => s + r.retry_count, 0) / results.length).toFixed(2),
    cert_numbers: successes.map(r => r.certificate_number),
  };
}

// ─── Read Test ────────────────────────────────────────────────────────

async function verifyCertificate(certNumber) {
  return request(`/api/verify/${encodeURIComponent(certNumber)}`);
}

async function readTier(tierNum, batchSize, certNumbers, csv) {
  const concurrency = CONCURRENCY_OVERRIDE || TIER_CONCURRENCY[batchSize] || batchSize;
  const sem = new Semaphore(concurrency);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  READ TIER ${tierNum}: ${batchSize} requests (concurrency: ${concurrency})`);
  console.log(`${'═'.repeat(60)}`);

  // Use available cert numbers, cycle if fewer than batchSize
  const certs = Array.from({ length: batchSize }, (_, i) => certNumbers[i % certNumbers.length]);

  const results = [];
  let completed = 0;

  const tierStart = Date.now();

  const promises = certs.map((certNumber, i) => {
    const seq = i + 1;
    return sem.run(async () => {
      const startTime = nowISO();
      const startMs = Date.now();

      try {
        const res = await verifyCertificate(certNumber);
        const latency = Date.now() - startMs;
        const endTime = nowISO();

        const d = res.json || {};
        const row = {
          tier: tierNum, batch_size: batchSize, sequence: seq,
          certificate_number: certNumber, start_time_iso: startTime,
          end_time_iso: endTime, latency_ms: latency,
          valid: d.valid ?? '', integrity_status: d.integrityStatus ?? '',
          document_status: d.documentStatus ?? '',
          retry_count: 0, status: res.ok ? 'SUCCESS' : 'FAIL',
          error: res.ok ? '' : (d.message || '').slice(0, 200),
        };
        csv.appendRow(Object.values(row));
        results.push(row);

        completed++;
        if (completed % Math.max(1, Math.floor(batchSize / 10)) === 0 || completed === batchSize) {
          const elapsed = ((Date.now() - tierStart) / 1000).toFixed(1);
          process.stdout.write(`\r  Progress: ${completed}/${batchSize} (${elapsed}s)`);
        }
        return row;

      } catch (err) {
        const latency = Date.now() - startMs;
        const row = {
          tier: tierNum, batch_size: batchSize, sequence: seq,
          certificate_number: certNumber, start_time_iso: startTime,
          end_time_iso: nowISO(), latency_ms: latency,
          valid: '', integrity_status: '', document_status: '',
          retry_count: 0, status: 'FAIL',
          error: (err.message || '').slice(0, 200),
        };
        csv.appendRow(Object.values(row));
        results.push(row);
        completed++;
        return row;
      }
    });
  });

  await Promise.allSettled(promises);
  const tierEnd = Date.now();
  const totalTime = tierEnd - tierStart;

  const successes = results.filter(r => r.status === 'SUCCESS');
  const fails = results.filter(r => r.status === 'FAIL');
  const latencies = successes.map(r => r.latency_ms);
  const stats = computeStats(latencies);

  console.log(`\n  ✅ Done in ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`     Success: ${successes.length} | Fail: ${fails.length} | Rate: ${((successes.length / batchSize) * 100).toFixed(1)}%`);
  console.log(`     Throughput: ${(successes.length / (totalTime / 1000)).toFixed(2)} req/s`);
  console.log(`     Latency: min=${stats.min}ms mean=${stats.mean}ms p95=${stats.p95}ms max=${stats.max}ms`);

  return {
    scenario: 'READ', tier: tierNum, batch_size: batchSize,
    total_time_ms: totalTime,
    success_count: successes.length, fail_count: fails.length,
    success_rate_pct: ((successes.length / batchSize) * 100).toFixed(1),
    throughput_tps: (successes.length / (totalTime / 1000)).toFixed(2),
    ...stats,
    avg_retries: '0',
  };
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Blockchain Stress Test — Parallel Batch Performance       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  API:        ${API}`);
  console.log(`  PDF Size:   ${PDF_SIZE_PRESET} (${(PDF_BYTES / 1024).toFixed(0)} KB)`);
  console.log(`  Max Tier:   ${MAX_TIER} (batches: ${TIERS.join(', ')})`);
  console.log(`  Mode:       ${READ_ONLY ? 'READ ONLY' : WRITE_ONLY ? 'WRITE ONLY' : 'WRITE + READ'}`);
  console.log();

  // Ensure results directory
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  // Health check
  console.log('  ⏳ Health check...');
  try {
    const health = await request('/health');
    if (!health.ok) throw new Error(`Health check failed: ${health.text}`);
    console.log('  ✅ Backend healthy');
  } catch (err) {
    console.error(`  ❌ Backend not reachable: ${err.message}`);
    process.exit(1);
  }

  // Login
  console.log('  ⏳ Authenticating...');
  let token, issuerId;
  try {
    const auth = await login();
    token = auth.token;
    issuerId = auth.issuerId;
    console.log(`  ✅ Authenticated (Issuer: ${issuerId})`);
  } catch (err) {
    console.error(`  ❌ Login failed: ${err.message}`);
    process.exit(1);
  }

  const summaryRows = [];
  let allSuccessfulCerts = [];

  // ─── WRITE TEST ───
  if (!READ_ONLY) {
    console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                     WRITE TEST                               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    const pdfBuffer = generatePDF(PDF_BYTES);
    console.log(`  PDF buffer: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

    const writeCsv = new CSVWriter(
      path.join(RESULTS_DIR, 'write_results.csv'),
      ['tier', 'batch_size', 'sequence', 'certificate_number', 'start_time_iso',
       'end_time_iso', 'latency_ms', 'tx_id', 'ipfs_cid', 'retry_count', 'status', 'error']
    );

    for (let t = 0; t < TIERS.length; t++) {
      const tierNum = t + 1;
      const batchSize = TIERS[t];

      const result = await writeTier(tierNum, batchSize, token, issuerId, writeCsv, pdfBuffer);
      summaryRows.push(result);
      allSuccessfulCerts.push(...result.cert_numbers);

      if (t < TIERS.length - 1) {
        console.log(`\n  ⏳ Cooldown ${COOLDOWN_MS / 1000}s before next tier...`);
        await sleep(COOLDOWN_MS);
      }
    }

    // Save cert numbers for read test
    fs.writeFileSync(
      path.join(RESULTS_DIR, 'successful_certs.json'),
      JSON.stringify(allSuccessfulCerts, null, 2)
    );
  }

  // ─── READ TEST ───
  if (!WRITE_ONLY) {
    console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                     READ TEST                                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // Load cert numbers
    if (READ_ONLY || allSuccessfulCerts.length === 0) {
      const certsFile = path.join(RESULTS_DIR, 'successful_certs.json');
      if (!fs.existsSync(certsFile)) {
        console.error('  ❌ No successful_certs.json found. Run write test first.');
        process.exit(1);
      }
      allSuccessfulCerts = JSON.parse(fs.readFileSync(certsFile, 'utf8'));
    }

    console.log(`  Using ${allSuccessfulCerts.length} certificates for read test`);

    const readCsv = new CSVWriter(
      path.join(RESULTS_DIR, 'read_results.csv'),
      ['tier', 'batch_size', 'sequence', 'certificate_number', 'start_time_iso',
       'end_time_iso', 'latency_ms', 'valid', 'integrity_status', 'document_status',
       'retry_count', 'status', 'error']
    );

    for (let t = 0; t < TIERS.length; t++) {
      const tierNum = t + 1;
      const batchSize = TIERS[t];

      const result = await readTier(tierNum, batchSize, allSuccessfulCerts, readCsv);
      summaryRows.push(result);

      if (t < TIERS.length - 1) {
        console.log(`\n  ⏳ Cooldown ${COOLDOWN_MS / 1000}s before next tier...`);
        await sleep(COOLDOWN_MS);
      }
    }
  }

  // ─── SUMMARY ───
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                     SUMMARY                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const summaryCsv = new CSVWriter(
    path.join(RESULTS_DIR, 'summary_stats.csv'),
    ['scenario', 'tier', 'batch_size', 'total_time_ms', 'success_count', 'fail_count',
     'success_rate_pct', 'throughput_tps', 'min_ms', 'max_ms', 'mean_ms', 'median_ms',
     'p50_ms', 'p95_ms', 'p99_ms', 'avg_retries']
  );

  for (const row of summaryRows) {
    const { cert_numbers, ...csvRow } = row;
    summaryCsv.appendRow(Object.values(csvRow));
  }

  // Print summary table
  console.log('\n  ' + '-'.repeat(100));
  console.log('  ' + [
    'Scenario'.padEnd(8), 'Tier', 'Batch'.padStart(7), 'Time(s)'.padStart(9),
    'OK'.padStart(6), 'Fail'.padStart(5), 'Rate%'.padStart(7),
    'TPS'.padStart(8), 'Mean'.padStart(7), 'P95'.padStart(7), 'P99'.padStart(7),
  ].join(' | '));
  console.log('  ' + '-'.repeat(100));

  for (const r of summaryRows) {
    console.log('  ' + [
      r.scenario.padEnd(8),
      String(r.tier),
      String(r.batch_size).padStart(7),
      (r.total_time_ms / 1000).toFixed(1).padStart(9),
      String(r.success_count).padStart(6),
      String(r.fail_count).padStart(5),
      String(r.success_rate_pct).padStart(6) + '%',
      String(r.throughput_tps).padStart(8),
      (r.mean + 'ms').padStart(7),
      (r.p95 + 'ms').padStart(7),
      (r.p99 + 'ms').padStart(7),
    ].join(' | '));
  }

  console.log('  ' + '-'.repeat(100));
  console.log(`\n  📁 Results saved to: ${RESULTS_DIR}/`);
  console.log('     • write_results.csv');
  console.log('     • read_results.csv');
  console.log('     • summary_stats.csv');
  console.log('     • successful_certs.json');
  console.log('\n  🎉 Stress test complete!\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
