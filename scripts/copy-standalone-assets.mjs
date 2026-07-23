// next.config.mjs sets output:"standalone", which only copies server code --
// static assets and public/ must be copied in manually (this mirrors the
// COPY steps in the Dockerfile, so local `node .next/standalone/server.js`
// runs behave the same as the production container).
import { cpSync, existsSync } from "node:fs";

function copy(src, dest) {
  if (!existsSync(src)) return;
  cpSync(src, dest, { recursive: true });
  console.log(`Copied ${src} -> ${dest}`);
}

copy(".next/static", ".next/standalone/.next/static");
copy("public", ".next/standalone/public");
copy(".env", ".next/standalone/.env");
