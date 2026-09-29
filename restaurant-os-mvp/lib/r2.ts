import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || '';

// S3 S3Client configuration for R2
export const r2Client = new S3Client({
    region: 'auto',
    endpoint: endpoint,
    credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
    },
});

/**
 * Uploads a file buffer to Cloudflare R2.
 */
export async function uploadToR2(key: string, fileBuffer: Buffer, contentType: string) {
    if (!bucketName) throw new Error('CLOUDFLARE_R2_BUCKET_NAME is not configured');
    
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
    });
    return r2Client.send(command);
}

/**
 * Deletes an object from Cloudflare R2.
 */
export async function deleteFromR2(key: string) {
    if (!bucketName) throw new Error('CLOUDFLARE_R2_BUCKET_NAME is not configured');

    const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
    });
    return r2Client.send(command);
}

/**
 * Generates a short-lived secure download URL for a private file.
 */
export async function getPrivatePresignedUrl(key: string, expiresInSeconds = 900) {
    if (!bucketName) throw new Error('CLOUDFLARE_R2_BUCKET_NAME is not configured');

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
    });
    return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}
