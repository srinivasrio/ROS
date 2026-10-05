import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
function getBucketName(): string {
    return process.env.CLOUDFLARE_R2_BUCKET_NAME || 'dineinone-assets';
}

let _r2ClientInstance: S3Client | null = null;
export function getR2Client(): S3Client {
    if (!_r2ClientInstance) {
        _r2ClientInstance = new S3Client({
            region: 'auto',
            endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
            },
        });
    }
    return _r2ClientInstance;
}

// S3Client proxy for backwards-compatibility
export const r2Client = new Proxy({} as S3Client, {
    get(_, prop, receiver) {
        return Reflect.get(getR2Client(), prop, receiver);
    }
});

/**
 * Uploads a file buffer to Cloudflare R2.
 */
export async function uploadToR2(key: string, fileBuffer: Buffer, contentType: string) {
    const bucket = getBucketName();
    if (!bucket) throw new Error('CLOUDFLARE_R2_BUCKET_NAME is not configured');
    
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
    });
    return getR2Client().send(command);
}

/**
 * Deletes an object from Cloudflare R2.
 */
export async function deleteFromR2(key: string) {
    const bucket = getBucketName();
    if (!bucket) throw new Error('CLOUDFLARE_R2_BUCKET_NAME is not configured');

    const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    return getR2Client().send(command);
}

/**
 * Generates a short-lived secure download URL for a private file.
 */
export async function getPrivatePresignedUrl(key: string, expiresInSeconds = 900) {
    const bucket = getBucketName();
    if (!bucket) throw new Error('CLOUDFLARE_R2_BUCKET_NAME is not configured');

    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds });
}
