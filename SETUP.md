# AIVA Setup Guide

This guide provides detailed, step-by-step instructions to get the AIVA platform up and running on your local machine for development.

## 1. Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js**: v20.0.0 or higher
- **pnpm**: v9.0.0 or higher
- **Python**: v3.11 or higher
- **Docker & Docker Compose**: Required for running Redis and optionally the Python ML workers.
- **Supabase CLI**: For local database development. Install via `npm i -g supabase` or Homebrew.
- **FFmpeg**: Required if running the Python workers natively (without Docker).

## 2. Initial Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd AIVA
   ```

2. **Bootstrap the Monorepo:**
   Install all Node.js dependencies and validate the Supabase migrations. 
   *(Note: This step spins up a temporary local Supabase emulator to generate TypeScript types and validate the schema, then tears it down).*
   ```bash
   pnpm bootstrap
   ```

## 3. Environment Variables

AIVA requires various API keys to function. 

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and configure your necessary keys. For local testing, at minimum, you will need:
   - **Supabase Keys**: See the *Database Setup* section below.
   - **LLM Provider**: e.g., `GEMINI_API_KEY` (if `LLM_PROVIDER=gemini`).
   - **Search Provider**: e.g., `TAVILY_API_KEY` (if `SEARCH_PROVIDER=tavily`).
   - **Security**: Generate a random 32-byte hex key for `DATABASE_ENCRYPTION_KEY` (e.g., run `openssl rand -hex 32`).

## 4. Database Setup (Supabase)

You can choose to use a cloud-managed Supabase project or run it locally.

### Option A: Local Supabase (Recommended for Dev)
Start the local Supabase emulator. It will run in Docker and persist data locally.
```bash
npx supabase start
```
*After starting, the CLI will output your local `API URL`, `anon key`, and `service_role key`. Update your `.env` file with these values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.*

if the command failed, try this:
```bash
npx supabase start -x studio
```
### Option B: Cloud Supabase
If using a managed project at app.supabase.com:
1. Link your project: `npx supabase link --project-ref your-project-ref`
2. Push the migrations: `npx supabase db push`
3. Update your `.env` with the cloud keys.

## 5. Running the Application

AIVA consists of multiple services (Next.js web app, Remotion template renderer, Python ML workers, and Redis). How you run them depends on what you are actively developing.

### Option A: Hybrid Mode (Recommended for Web/UI Development)
Run the backend dependencies in Docker, and the frontend applications natively using Turborepo.

1. **Start Backend Infrastructure**:
   Spin up Redis and the Python ML workers via Docker.
   ```bash
   docker compose -f infra/docker-compose.yml up -d redis workers
   ```
   try this if it fails:
   ```bash
   docker compose -f infra/docker-compose.yml build --no-cache workers
   ```

2. **Start Frontend & Renderer**:
   Run the Next.js orchestrator and Remotion renderer.
   ```bash
   pnpm dev
   ```
   *The Next.js app will be available at `http://localhost:3000` and the Remotion server at `http://localhost:3001`.*

### Option B: Full Docker Mode
If you just want to run the entire stack without touching the code, you can bring up all services:
```bash
docker compose -f infra/docker-compose.yml up -d
```
*(Note: If you do this, you do not need to run `pnpm dev`)*

### Option C: Full Native Mode (For Python/ML Development)
If you are modifying the ML pipeline, you may want to run the Python workers natively.

1. **Start Redis**:
   ```bash
   docker compose -f infra/docker-compose.yml up -d redis
   ```

2. **Start Python Workers**:
   *(Note for Windows users: If running natively outside Docker, you MUST have FFmpeg installed and in your PATH, e.g. `winget install -e --id Gyan.FFmpeg`)*
   ```bash
   cd apps/workers
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Start Web & Renderer**:
   Open a new terminal at the project root:
   ```bash
   pnpm dev
   ```

## 6. Verifying the Installation

To verify that the end-to-end pipeline orchestration is working correctly (without using real API credits), run the deterministic Golden Suite tests:

```bash
pnpm certify
```
This runs the orchestration logic with mocked API providers and confirms that the jobs pass through the queue successfully.
