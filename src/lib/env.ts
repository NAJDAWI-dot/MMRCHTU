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
  // Fallback only — prefer getSiteUrl() below, which reads the actual
  // request host so links stay correct even when the dev server picks a
  // different port (3001, 3002, ...) because 3000 was already in use.
  siteUrl: process.env.SITE_URL ?? "http://localhost:3000",
};
