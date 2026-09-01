function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function cloudflareAccountId(): string | undefined {
  return clean(process.env.CLOUDFLARE_ACCOUNT_ID);
}

export function cloudflareApiToken(): string | undefined {
  return clean(process.env.CLOUDFLARE_API_TOKEN);
}

export function cloudflareR2Bucket(): string | undefined {
  return clean(process.env.CLOUDFLARE_R2_BUCKET);
}

export function cloudflareR2AccessKeyId(): string | undefined {
  return clean(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
}

export function cloudflareR2SecretAccessKey(): string | undefined {
  return clean(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
}

export function isCloudflareApiConfigured(): boolean {
  return Boolean(cloudflareAccountId() && cloudflareApiToken());
}

export function isCloudflareR2Configured(): boolean {
  return Boolean(
    cloudflareAccountId() &&
      cloudflareR2Bucket() &&
      cloudflareR2AccessKeyId() &&
      cloudflareR2SecretAccessKey()
  );
}
