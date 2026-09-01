function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** MongoDB is optional and owns agent/build-run state only. */
export function mongodbUri(): string | undefined {
  return clean(process.env.MONGODB_URI);
}

export function mongodbDatabaseName(): string {
  return clean(process.env.MONGODB_DATABASE) ?? "buildrx";
}

export function isMongoConfigured(): boolean {
  return Boolean(mongodbUri());
}
