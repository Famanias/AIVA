#!/bin/bash
set -e

echo "=========================================="
echo "    Supabase Migration Validator (CI)     "
echo "=========================================="

# Ensure we are in the packages/database directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR/.."

echo "1. Starting Supabase Local Emulator..."
npx supabase start -x studio,migra,inbucket

echo "2. Applying Migrations to Fresh Database..."
npx supabase db reset

echo "3. Generating TypeScript Types..."
npx supabase gen types typescript --local > src/schema.ts

echo "4. Typechecking Generated Schema..."
pnpm tsc --noEmit

echo "5. Tearing Down Local Emulator..."
npx supabase stop

echo "✅ Migrations and Schema are perfectly reproducible!"
