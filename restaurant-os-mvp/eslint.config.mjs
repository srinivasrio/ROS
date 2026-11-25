import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare Workers, backups, subprojects, and non-app artifacts:
    ".open-next/**",
    ".wrangler/**",
    ".cf-migration-backup/**",
    ".cleanup_backup_20260929/**",
    "brag-output/**",
    "Claude outputs/**",
    "scratch/**",
    "marketing-repo/**",
    "super-admin/**",
    "dineinone-landing/**",
    "waiter-android/**",
    "workers/**",
    "vps/**",
    "public/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
