function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: requireEnv("DATABASE_URL"),
  sessionSecret: requireEnv("SESSION_SECRET"),
};

// Soft-required: features degrade gracefully (skip email) rather than crash
// the app when these aren't set yet.
export const optionalEnv = {
  resendApiKey: process.env.RESEND_API_KEY,
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL,
  siteUrl: process.env.SITE_URL ?? "http://localhost:3000",
};
