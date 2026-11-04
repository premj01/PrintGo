/**
 * S3 Real-File Upload → Fetch → Delete Test
 * ───────────────────────────────────────────
 * Reads  : src/test_component/Prem_Jadhav_Resume.pdf  (local file)
 * Uploads: to S3 under a custom renamed key
 * Fetches: via a signed download URL and saves locally as a downloaded copy
 * Deletes: the object from S3 and confirms it is gone
 *
 * Run from the /server directory:
 *   node src/test_component/s3_file_upload_fetch_delete.test.js
 */

import "dotenv/config";
import fs   from "fs";
import path from "path";
import https from "https";
import http  from "http";
import { fileURLToPath } from "url";

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = path.join(__dirname, "Prem_Jadhav_Resume.pdf");

// The name the file will have inside S3 (can be anything you like)
const S3_UPLOAD_NAME = `printgo-test-uploads/resume_renamed_${Date.now()}.pdf`;

// Where to save the downloaded copy locally for verification
const DOWNLOADED_COPY = path.join(__dirname, `downloaded_resume_${Date.now()}.pdf`);

// ─── AWS Config ───────────────────────────────────────────────────────────────

const region          = (process.env.AWS_REGION     || "").trim();
const bucket          = (process.env.AWS_BUCKET     || "").trim();
const accessKeyId     = (process.env.AWS_ACCESS_KEY || "").trim();
const secretAccessKey = (process.env.AWS_SECRET_KEY || "").trim();

const UPLOAD_EXPIRES   = 180; // seconds
const DOWNLOAD_EXPIRES = 180; // seconds

// ─── Logging helpers ──────────────────────────────────────────────────────────

const PASS    = (msg)  => console.log(`  ✅  PASS   ${msg}`);
const FAIL    = (msg)  => { console.error(`  ❌  FAIL   ${msg}`); process.exitCode = 1; };
const INFO    = (msg)  => console.log(`  ℹ️   ${msg}`);
const STEP    = (n, t) => console.log(`\n──── Step ${n}: ${t} ${"─".repeat(Math.max(0, 48 - t.length))}`);
const DIVIDER = ()     => console.log("═".repeat(62));

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function httpRequest(url, method = "GET", body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const mod     = url.startsWith("https") ? https : http;
        const options = { method, headers };
        const req     = mod.request(url, options, (res) => {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end",  () => resolve({
                statusCode: res.statusCode,
                body: Buffer.concat(chunks),
            }));
        });
        req.on("error", reject);
        req.setTimeout(60_000, () => req.destroy(new Error("Request timed out after 60s")));
        if (body) req.write(body);
        req.end();
    });
}

// ─── S3 client ────────────────────────────────────────────────────────────────

const s3 = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
});

// ─── Steps ───────────────────────────────────────────────────────────────────

function stepCheckEnv() {
    STEP(1, "Check environment variables");
    const vars = {
        AWS_REGION:     region,
        AWS_BUCKET:     bucket,
        AWS_ACCESS_KEY: accessKeyId,
        AWS_SECRET_KEY: secretAccessKey,
    };
    let ok = true;
    for (const [k, v] of Object.entries(vars)) {
        if (!v) {
            FAIL(`${k} is missing or empty`);
            ok = false;
        } else {
            const display = (k.includes("SECRET") || k.includes("KEY"))
                ? `${v.slice(0, 4)}****${v.slice(-4)}`
                : v;
            PASS(`${k} = "${display}"`);
        }
    }
    if (!ok) throw new Error("Missing env vars — cannot continue.");
}

function stepReadSourceFile() {
    STEP(2, "Read source PDF from disk");
    if (!fs.existsSync(SOURCE_FILE)) {
        FAIL(`Source file not found: ${SOURCE_FILE}`);
        throw new Error("Source file missing.");
    }
    const buffer = fs.readFileSync(SOURCE_FILE);
    INFO(`Source file : ${path.basename(SOURCE_FILE)}`);
    INFO(`Size        : ${buffer.length.toLocaleString()} bytes  (${(buffer.length / 1024).toFixed(1)} KB)`);
    if (buffer.slice(0, 4).toString() === "%PDF") {
        PASS("File starts with %PDF — valid PDF magic bytes");
    } else {
        FAIL("File does not start with %PDF — may not be a real PDF");
    }
    return buffer;
}

async function stepGenerateUploadUrl() {
    STEP(3, "Generate signed UPLOAD URL");
    const command = new PutObjectCommand({
        Bucket:      bucket,
        Key:         S3_UPLOAD_NAME,
        ContentType: "application/pdf",
    });
    const url = await getSignedUrl(s3, command, { expiresIn: UPLOAD_EXPIRES });
    PASS("Signed upload URL generated");
    INFO(`S3 key      : ${S3_UPLOAD_NAME}`);
    INFO(`Expires in  : ${UPLOAD_EXPIRES}s`);
    INFO(`URL preview : ${url.slice(0, 90)}…`);
    return url;
}

async function stepUploadFile(uploadUrl, fileBuffer) {
    STEP(4, "Upload PDF to S3 via signed URL (HTTP PUT)");
    const { statusCode, body } = await httpRequest(uploadUrl, "PUT", fileBuffer, {
        "Content-Type":   "application/pdf",
        "Content-Length": String(fileBuffer.length),
    });
    INFO(`PUT status  : ${statusCode}`);
    if (statusCode === 200) {
        PASS("File uploaded to S3 successfully (HTTP 200)");
    } else {
        FAIL(`Upload failed — expected 200, got ${statusCode}\n${body.toString().slice(0, 400)}`);
        throw new Error("Upload failed — cannot continue.");
    }
}

async function stepVerifyExistsOnS3(fileBuffer) {
    STEP(5, "Verify object exists in S3 (HeadObject)");
    try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: S3_UPLOAD_NAME }));
        PASS(`Object confirmed on S3`);
        INFO(`ContentType   : ${head.ContentType}`);
        INFO(`ContentLength : ${head.ContentLength.toLocaleString()} bytes`);
        INFO(`ETag          : ${head.ETag}`);
        if (head.ContentLength === fileBuffer.length) {
            PASS(`Size matches source file (${fileBuffer.length.toLocaleString()} bytes)`);
        } else {
            FAIL(`Size mismatch — source: ${fileBuffer.length}B, S3: ${head.ContentLength}B`);
        }
    } catch (err) {
        const code = err.$metadata?.httpStatusCode;
        FAIL(`HeadObject denied (HTTP ${code}): ${err.message}`);
        if (err.message?.includes("QuarantineV3")) {
            INFO("⚠️  AWS has quarantined this IAM key — s3:GetObject is blocked.");
            INFO("   Rotate the access key in IAM and detach AWSCompromisedKeyQuarantineV3.");
        }
        // Non-fatal: continue so cleanup still runs
    }
}

async function stepGenerateDownloadUrl() {
    STEP(6, "Generate signed DOWNLOAD URL");
    const command = new GetObjectCommand({ Bucket: bucket, Key: S3_UPLOAD_NAME });
    const url = await getSignedUrl(s3, command, { expiresIn: DOWNLOAD_EXPIRES });
    PASS("Signed download URL generated");
    INFO(`Expires in  : ${DOWNLOAD_EXPIRES}s`);
    INFO(`URL preview : ${url.slice(0, 90)}…`);
    return url;
}

async function stepDownloadAndVerify(downloadUrl, originalBuffer) {
    STEP(7, "Download file via signed URL and verify content");
    let statusCode, body;
    try {
        ({ statusCode, body } = await httpRequest(downloadUrl, "GET"));
    } catch (err) {
        FAIL(`HTTP GET threw: ${err.message}`);
        return;
    }

    INFO(`GET status  : ${statusCode}`);

    if (statusCode !== 200) {
        FAIL(`Download failed — status ${statusCode}\n${body.toString().slice(0, 400)}`);
        if (body.toString().includes("QuarantineV3") || body.toString().includes("AccessDenied")) {
            INFO("⚠️  AWS IAM key is quarantined — s3:GetObject blocked.");
            INFO("   Rotate the key in IAM console to fix this.");
        }
        return; // non-fatal
    }

    PASS(`File downloaded from S3 (HTTP 200)`);
    INFO(`Downloaded size : ${body.length.toLocaleString()} bytes`);

    if (body.slice(0, 4).toString() === "%PDF") {
        PASS("Downloaded file starts with %PDF — valid PDF");
    } else {
        FAIL("Downloaded file does NOT start with %PDF");
    }

    if (body.equals(originalBuffer)) {
        PASS("Downloaded content matches original file exactly (byte-for-byte)");
    } else {
        FAIL(`Content mismatch — original: ${originalBuffer.length}B, downloaded: ${body.length}B`);
    }

    fs.writeFileSync(DOWNLOADED_COPY, body);
    PASS(`Downloaded copy saved locally: ${path.basename(DOWNLOADED_COPY)}`);
}

async function stepDeleteFromS3() {
    STEP(8, "Delete object from S3");
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: S3_UPLOAD_NAME }));
    PASS(`DeleteObject sent for key: ${S3_UPLOAD_NAME}`);
}

async function stepConfirmDeleted() {
    STEP(9, "Confirm object is gone from S3 (HeadObject should fail)");
    try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: S3_UPLOAD_NAME }));
        // If we reach here, object still exists
        FAIL("Object still exists on S3 after delete — delete may not have worked");
    } catch (err) {
        const code = err.$metadata?.httpStatusCode;
        if (code === 404 || code === 403) {
            PASS(`Object is gone from S3 (HeadObject returned ${code} — expected)`);
        } else {
            FAIL(`Unexpected error on HeadObject after delete: ${err.message} (code: ${code})`);
        }
    }
}

function stepCleanupLocalFile() {
    STEP(10, "Cleanup local downloaded copy");
    if (fs.existsSync(DOWNLOADED_COPY)) {
        fs.unlinkSync(DOWNLOADED_COPY);
        PASS(`Deleted local file: ${path.basename(DOWNLOADED_COPY)}`);
    } else {
        INFO("No local downloaded copy found — nothing to clean up");
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    DIVIDER();
    console.log("  🪣   PrintGo — S3 Real-File Test (Upload → Fetch → Delete)");
    console.log(`  📦   Bucket      : ${bucket || "(not set)"}`);
    console.log(`  🌍   Region      : ${region || "(not set)"}`);
    console.log(`  📄   Source file : ${path.basename(SOURCE_FILE)}`);
    console.log(`  🏷️   S3 key      : ${S3_UPLOAD_NAME}`);
    DIVIDER();

    const t0 = Date.now();

    stepCheckEnv();
    const fileBuffer = stepReadSourceFile();
    const uploadUrl  = await stepGenerateUploadUrl();

    try {
        await stepUploadFile(uploadUrl, fileBuffer);
        await stepVerifyExistsOnS3(fileBuffer);
        const downloadUrl = await stepGenerateDownloadUrl();
        await stepDownloadAndVerify(downloadUrl, fileBuffer);
    } catch (err) {
        FAIL(`Unexpected error in test flow: ${err.message}`);
    } finally {
        // Always clean up S3 object and local file
        try {
            await stepDeleteFromS3();
            await stepConfirmDeleted();
        } catch (err) {
            FAIL(`S3 cleanup error: ${err.message}`);
        }
        stepCleanupLocalFile();
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    DIVIDER();
    if (process.exitCode === 1) {
        console.log(`\n  ⚠️   Some tests FAILED — see output above. (${elapsed}s total)`);
    } else {
        console.log(`\n  🎉  All 10 steps PASSED in ${elapsed}s`);
    }
    DIVIDER();
}

main().catch((err) => {
    console.error("\n💥 Fatal error:", err.message);
    process.exit(1);
});
