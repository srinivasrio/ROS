import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || '';

export const r2Client = new S3Client({
    region: 'auto',
    endpoint: endpoint,
    credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
    },
});

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

export async function deleteFromR2(key: string) {
    if (!bucketName) throw new Error('CLOUDFLARE_R2_BUCKET_NAME is not configured');

    const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
    });
    return r2Client.send(command);
}

export async function getPrivatePresignedUrl(key: string, expiresInSeconds = 900) {
    if (!bucketName) throw new Error('CLOUDFLARE_R2_BUCKET_NAME is not configured');

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
    });
    return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}
