import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = (process.env.AWS_REGION || "").trim();
const bucket = (process.env.AWS_BUCKET || "").trim();
const accessKeyId = (process.env.AWS_ACCESS_KEY || "").trim();
const secretAccessKey = (process.env.AWS_SECRET_KEY || "").trim();

if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    console.warn("[s3Storage] Missing one or more AWS env vars (AWS_REGION, AWS_BUCKET, AWS_ACCESS_KEY, AWS_SECRET_KEY)");
}

console.log(`[s3Storage] Using bucket: "${bucket}", region: "${region}"`);

const s3 = new S3Client({
    region,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});

export function getS3BucketName() {
    return bucket;
}

export async function createSignedUploadUrl({ key, contentType = "application/pdf", expiresIn = 600 }) {
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn });
    return uploadUrl;
}

export async function createSignedDownloadUrl({ key, expiresIn = 300 }) {
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });

    const downloadUrl = await getSignedUrl(s3, command, { expiresIn });
    console.log(`[s3Storage] Signed download URL generated for key: ${key} (expires in ${expiresIn}s)`);
    return downloadUrl;
}

export async function deleteObjectByKey(key) {
    const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    await s3.send(command);
}
