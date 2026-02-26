const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const env = process.argv[2];

if (!env || !["local", "prod"].includes(env)) {
  console.error('Usage: node ./scripts/db-seed.js <local|prod>');
  process.exit(1);
}

const scriptsDir = __dirname;

const sqlFiles = fs
  .readdirSync(scriptsDir)
  .filter((file) => file.toLowerCase().endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

if (sqlFiles.length === 0) {
  console.log("No .sql files found in scripts directory, nothing to seed.");
  process.exit(0);
}

const envFlag = env === "local" ? "--local" : "--remote";

for (const file of sqlFiles) {
  const fullPath = path.join(scriptsDir, file);
  console.log(`Executing SQL file: ${file}`);

  execSync(
    `npx wrangler d1 execute nav-app-db ${envFlag} --file "${fullPath}"`,
    {
      stdio: "inherit",
    }
  );
}

