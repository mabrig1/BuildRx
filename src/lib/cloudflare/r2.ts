import {
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  cloudflareAccountId,
  cloudflareR2AccessKeyId,
  cloudflareR2Bucket,
  cloudflareR2SecretAccessKey,
  isCloudflareR2Configured,
} from "@/lib/cloudflare/config";

let client: S3Client | undefined;

function r2Client(): S3Client {
  if (!isCloudflareR2Configured()) {
    throw new Error("Cloudflare R2 is not configured.");
  }
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${cloudflareAccountId()}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cloudflareR2AccessKeyId()!,
      secretAccessKey: cloudflareR2SecretAccessKey()!,
    },
  });
  return client;
}

export async function verifyR2Bucket(): Promise<void> {
  await r2Client().send(
    new HeadBucketCommand({ Bucket: cloudflareR2Bucket()! })
  );
}

/** Immutable archive backup; source-of-truth project files remain in Supabase. */
export async function storeBuildArtifact(input: {
  projectId: string;
  slug: string;
  archive: Uint8Array;
}): Promise<string | null> {
  if (!isCloudflareR2Configured()) return null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `build-artifacts/${input.projectId}/${timestamp}-${input.slug}.zip`;
  await r2Client().send(
    new PutObjectCommand({
      Bucket: cloudflareR2Bucket()!,
      Key: key,
      Body: input.archive,
      ContentType: "application/zip",
      ServerSideEncryption: "AES256",
      Metadata: { "project-id": input.projectId },
    })
  );
  return key;
}
