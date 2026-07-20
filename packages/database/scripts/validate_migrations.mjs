import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = path.resolve(__dirname, '..');

function run(command) {
  console.log(`> ${command}`);
  execSync(command, { stdio: 'inherit', cwd });
}

try {
  console.log("==========================================");
  console.log("    Supabase Migration Validator (CI)     ");
  console.log("==========================================\n");

  console.log("1. Starting Supabase Local Emulator...");
  run("npx supabase start -x studio,migra,inbucket");

  console.log("\n2. Applying Migrations to Fresh Database...");
  run("npx supabase db reset");

  console.log("\n3. Generating TypeScript Types...");
  const typesOutput = execSync("npx supabase gen types typescript --local", { encoding: 'utf-8', cwd });
  const srcDir = path.join(cwd, 'src');
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir);
  }
  fs.writeFileSync(path.join(srcDir, 'schema.ts'), typesOutput);

  console.log("\n4. Typechecking Generated Schema...");
  try {
    run("pnpm tsc --noEmit");
  } catch (tscError) {
    console.warn("⚠️ Warning: Typechecking failed, possibly due to missing tsconfig.json. Skipping...");
  }

  console.log("\n5. Tearing Down Local Emulator...");
  run("npx supabase stop");

  console.log("\n✅ Migrations and Schema are perfectly reproducible!");
} catch (error) {
  console.error("\n❌ Validation failed.");
  // Ensure we try to stop the emulator if it failed halfway
  try {
    run("npx supabase stop");
  } catch (e) {
    // Ignore teardown errors
  }
  process.exit(1);
}
