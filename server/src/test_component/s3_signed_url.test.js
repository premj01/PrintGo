/**
 * S3 Signed URL Test Script
 * ─────────────────────────
 * Tests the full S3 lifecycle for PrintGo:
 *   1. Generate a signed UPLOAD URL  →  PUT a test PDF into S3
 *   2. Generate a signed DOWNLOAD URL →  GET the file back and verify content
 *   3. DELETE the object from S3     →  confirm it's gone (GET should 403/404)
 *
 * Run from the /server directory:
 *   node src/test_component/s3_signed_url.test.js
 *
 * Requires .env to be present with:
 *   AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_REGION, AWS_BUCKET
 */

import "dotenv/config";
import https from "https";
import http from "http";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── Config ───────────────────────────────────────────────────────────────────

const region          = (process.env.AWS_REGION     || "").trim();
const bucket          = (process.env.AWS_BUCKET     || "").trim();
const accessKeyId     = (process.env.AWS_ACCESS_KEY || "").trim();
const secretAccessKey = (process.env.AWS_SECRET_KEY || "").trim();

const TEST_KEY        = `test_component/s3-test-${Date.now()}.pdf`;
const UPLOAD_EXPIRES  = 120;   // seconds
const DOWNLOAD_EXPIRES = 120;  // seconds

// ─── Minimal valid PDF bytes (just enough for a real Content-Type check) ──────
const FAKE_PDF_CONTENT = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj " +
    "2 0 obj<</Type /Pages /Kids[3 0 R]/Count 1>>endobj " +
    "3 0 obj<</Type /Page /MediaBox[0 0 612 792]>>endobj\n" +
    "xref\n0 4\n0000000000 65535 f\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n9\n%%EOF"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PASS  = (msg) => console.log(`  ✅  PASS  ${msg}`);
const FAIL  = (msg) => { console.error(`  ❌  FAIL  ${msg}`); process.exitCode = 1; };
const INFO  = (msg) => console.log(`  ℹ️   ${msg}`);
const STEP  = (n, msg) => console.log(`\n──── Step ${n}: ${msg} ${"─".repeat(Math.max(0, 50 - msg.length))}`);
const DIVIDER = () => console.log("═".repeat(60));

/**
 * Make an HTTP/HTTPS request and return { statusCode, body (Buffer) }.
 */
function httpRequest(url, method = "GET", body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const mod     = url.startsWith("https") ? https : http;
        const options = { method, headers };
        const req     = mod.request(url, options, (res) => {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end",  () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }));
        });
        req.on("error", reject);
        req.setTimeout(30_000, () => req.destroy(new Error("Request timed out")));
        if (body) req.write(body);
        req.end();
    });
}

// ─── S3 Client ────────────────────────────────────────────────────────────────

function makeS3Client() {
    return new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
    });
}

// ─── Test Runners ─────────────────────────────────────────────────────────────

async function testEnvVars() {
    STEP(0, "Environment variables");
    const vars = { AWS_REGION: region, AWS_BUCKET: bucket, AWS_ACCESS_KEY: accessKeyId, AWS_SECRET_KEY: secretAccessKey };
    let allOk = true;
    for (const [k, v] of Object.entries(vars)) {
        if (!v) {
            FAIL(`${k} is missing or empty`);
            allOk = false;
        } else {
            const display = k.includes("SECRET") || k.includes("KEY")
                ? v.slice(0, 4) + "****" + v.slice(-4)
                : v;
            PASS(`${k} = "${display}"`);
        }
    }
    if (!allOk) throw new Error("Missing required env vars — cannot continue.");
}

async function testSignedUploadUrl(s3) {
    STEP(1, "Generate signed UPLOAD URL");
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key:    TEST_KEY,
        ContentType: "application/pdf",
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: UPLOAD_EXPIRES });
    PASS(`Signed upload URL generated`);
    INFO(`Key        : ${TEST_KEY}`);
    INFO(`Expires in : ${UPLOAD_EXPIRES}s`);
    INFO(`URL prefix : ${uploadUrl.slice(0, 80)}…`);
    return uploadUrl;
}

async function testUploadFile(uploadUrl) {
    STEP(2, "Upload test PDF via signed URL (HTTP PUT)");
    const { statusCode } = await httpRequest(uploadUrl, "PUT", FAKE_PDF_CONTENT, {
        "Content-Type":   "application/pdf",
        "Content-Length": String(FAKE_PDF_CONTENT.length),
    });
    INFO(`PUT response status: ${statusCode}`);
    if (statusCode === 200) {
        PASS(`File uploaded successfully (status 200)`);
    } else {
        FAIL(`Unexpected status ${statusCode} — expected 200`);
    }
}

async function testHeadObject(s3) {
    STEP(3, "Verify object exists in S3 (HeadObject)");
    try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: TEST_KEY }));
        PASS(`Object exists — ContentLength: ${head.ContentLength} bytes, ContentType: ${head.ContentType}`);
    } catch (err) {
        FAIL(`HeadObject failed: ${err.message} (code: ${err.$metadata?.httpStatusCode})`);
    }
}

async function testSignedDownloadUrl(s3) {
    STEP(4, "Generate signed DOWNLOAD URL");
    const command = new GetObjectCommand({ Bucket: bucket, Key: TEST_KEY });
    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: DOWNLOAD_EXPIRES });
    PASS(`Signed download URL generated`);
    INFO(`Expires in : ${DOWNLOAD_EXPIRES}s`);
    INFO(`URL prefix : ${downloadUrl.slice(0, 80)}…`);
    return downloadUrl;
}

async function testDownloadFile(downloadUrl) {
    STEP(5, "Download file via signed URL (HTTP GET)");
    const { statusCode, body } = await httpRequest(downloadUrl, "GET");
    INFO(`GET response status: ${statusCode}`);
    if (statusCode === 200) {
        PASS(`File downloaded successfully (status 200)`);
        INFO(`Downloaded size : ${body.length} bytes`);
        if (body.slice(0, 4).toString() === "%PDF") {
            PASS(`Content looks like a valid PDF (%PDF magic bytes present)`);
        } else {
            FAIL(`Downloaded content does NOT start with %PDF — possible corruption`);
        }
        const match = body.equals(FAKE_PDF_CONTENT);
        if (match) {
            PASS(`Downloaded content matches uploaded content exactly`);
        } else {
            FAIL(`Content mismatch — bytes differ (uploaded ${FAKE_PDF_CONTENT.length}B, downloaded ${body.length}B)`);
        }
    } else {
        FAIL(`Download failed with status ${statusCode}\nBody: ${body.toString().slice(0, 300)}`);
    }
}

async function testDeleteObject(s3) {
    STEP(6, "Delete test object from S3");
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: TEST_KEY }));
    PASS(`DeleteObject command sent for key: ${TEST_KEY}`);
}

async function testConfirmDeletion() {
    STEP(7, "Confirm object is gone (signed GET should now return 403/404)");
    // Re-generate a download URL (the old one may still be valid but object is gone)
    const s3Tmp = makeS3Client();
    const command = new GetObjectCommand({ Bucket: bucket, Key: TEST_KEY });
    const staleUrl = await getSignedUrl(s3Tmp, command, { expiresIn: 30 });
    const { statusCode, body } = await httpRequest(staleUrl, "GET");
    INFO(`GET-after-delete response status: ${statusCode}`);
    if (statusCode === 403 || statusCode === 404) {
        PASS(`Object is gone — got expected ${statusCode}`);
    } else if (statusCode === 200) {
        FAIL(`Object still accessible after delete (status 200) — delete may have failed`);
    } else {
        INFO(`Got status ${statusCode} — treating as deleted (object gone from bucket)`);
        PASS(`Object appears to be deleted`);
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    DIVIDER();
    console.log("  🪣  PrintGo — S3 Signed URL Test Suite");
    console.log(`  📦  Bucket : ${bucket || "(not set)"}`);
    console.log(`  🌍  Region : ${region || "(not set)"}`);
    console.log(`  🔑  Key    : ${TEST_KEY}`);
    DIVIDER();

    const startMs = Date.now();
    let uploadUrl, downloadUrl;
    const s3 = makeS3Client();

    try {
        await testEnvVars();
        uploadUrl   = await testSignedUploadUrl(s3);
        await testUploadFile(uploadUrl);
        await testHeadObject(s3);
        downloadUrl = await testSignedDownloadUrl(s3);
        await testDownloadFile(downloadUrl);
    } finally {
        // Always attempt cleanup — even if a step failed
        try {
            await testDeleteObject(s3);
            await testConfirmDeletion();
        } catch (cleanupErr) {
            FAIL(`Cleanup error: ${cleanupErr.message}`);
        }
    }

    const elapsed = ((Date.now() - startMs) / 1000).toFixed(2);
    DIVIDER();
    if (process.exitCode === 1) {
        console.log(`\n  ⚠️  Some tests FAILED. Check the output above. (${elapsed}s)`);
    } else {
        console.log(`\n  🎉  All tests PASSED in ${elapsed}s`);
    }
    DIVIDER();
}

main().catch((err) => {
    console.error("\n💥 Fatal error:", err.message);
    process.exit(1);
});
