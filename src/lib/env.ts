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
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL,
  // No siteUrl here on purpose. It used to default to localhost, which made a
  // request-less email send in production emit localhost links. The site's
  // address now has exactly one answer: siteOrigin() in src/lib/site-url.ts,
  // which understands SITE_URL *and* Vercel's domain variables.
};
