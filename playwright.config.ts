import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    // next.config.mjs sets output:"standalone", which "next start" doesn't
    // support -- serve the same standalone artifact Docker ships instead.
    command: "npm run build:standalone-serve",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
