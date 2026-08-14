# AIVA Accounts & API Keys Guide

The AIVA platform relies on several third-party services for its core functionalities (LLMs, TTS, Stock Media, Database). Depending on which providers you configure in your `.env` file, you will need to sign up for those services and generate API keys.

This guide provides step-by-step instructions on where to get every possible API key listed in the `.env.example` file.

---

## 1. Database & Queue Backing Store (Local PostgreSQL & Redis)
AIVA is 100% local-first and self-hosted. It does **not** require any cloud database account or Supabase API keys.

1. **PostgreSQL & Redis**:
   - Run `pnpm services:up` (or `docker compose -f infra/docker-compose.yml up -d postgres redis`).
   - Run `pnpm db:migrate` to apply all database tables and seed data.
   - Configure `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aiva` in `.env`.
   - Configure `AIVA_AUTH_MODE=local` for zero-config single-user local development.

---

## 2. Large Language Models (LLM_PROVIDER)
AIVA can use different LLM providers for the Research, Outline, and Script generation steps. You only need the key for the provider you select in `LLM_PROVIDER`.

### Gemini (`GEMINI_API_KEY`)
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with a Google account.
3. Click **Get API key** in the left sidebar.
4. Click **Create API key** and copy the generated key.

### Groq (`GROQ_API_KEY`)
1. Go to the [Groq Console](https://console.groq.com/keys).
2. Sign up or log in.
3. Navigate to **API Keys** in the sidebar.
4. Click **Create API Key**, name it (e.g., "AIVA"), and copy the resulting string.

### OpenRouter (`OPENROUTER_API_KEY`)
1. Go to [OpenRouter](https://openrouter.ai/).
2. Sign up or log in.
3. Navigate to **Keys** in your account settings.
4. Click **Create Key**, set a name, and copy the generated key. Note: OpenRouter requires adding credits to your account for most models.

---

## 3. Web Search (SEARCH_PROVIDER)
Used by the AI agents to perform research on the provided video topics. You only need the key for the provider you select in `SEARCH_PROVIDER`.

### Tavily (`TAVILY_API_KEY`)
1. Go to the [Tavily Developer Portal](https://app.tavily.com/home).
2. Sign up for a free account.
3. On your dashboard, you will immediately see your API Key under **API Keys**.

### Brave Search (`BRAVE_SEARCH_API_KEY`)
1. Go to [Brave Search API](https://brave.com/search/api/).
2. Create an account or log in.
3. Navigate to your dashboard to create a new API key. You can use the free tier for development.

### SerpApi (`SERPAPI_KEY`)
1. Go to [SerpApi](https://serpapi.com/).
2. Sign up for a free account.
3. Navigate to the **Dashboard**; your API key will be displayed prominently at the top.

---

## 4. Stock Media / B-Roll
Used for finding background videos for your scenes.

### Pexels (`PEXELS_API_KEY`)
1. Go to [Pexels API](https://www.pexels.com/api/).
2. Create an account or log in.
3. Click **Get Started** to apply for an API key. Fill out the quick form (you can say it's for a personal development project).
4. Your API key will be available immediately after form submission.

### Pixabay (`PIXABAY_API_KEY`)
1. Go to [Pixabay API](https://pixabay.com/api/docs/).
2. Create an account or log in.
3. Scroll down the API documentation page to the **Parameters** section. Your API key will be displayed inline next to the `key` parameter.

---

## 5. Image Generation (IMAGE_PROVIDER)
Used as a fallback when B-Roll cannot be found, or for generating specific visual assets.

### Cloudflare Workers AI (`CLOUDFLARE_ACCOUNT_ID` & `CLOUDFLARE_WORKERS_AI_TOKEN`)
1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and create an account.
2. In the left sidebar, click on **AI** -> **Workers AI**.
3. In the right sidebar or on the overview page, you will see your **Account ID**. Copy this to `CLOUDFLARE_ACCOUNT_ID`.
4. To get your token, click on **Use API**. It will prompt you to create an API token with Workers AI Read/Write permissions.
5. Create the token and copy it to `CLOUDFLARE_WORKERS_AI_TOKEN`.

---

## 6. S3-Compatible Storage
*Only required if `STORAGE_PROVIDER=s3`. If you are using `STORAGE_PROVIDER=supabase`, Supabase handles storage automatically using the keys provided in Step 1.*

If you are using AWS, Cloudflare R2, or DigitalOcean Spaces:
- **`S3_ENDPOINT`**: Your provider's endpoint URL (e.g., `https://<account_id>.r2.cloudflarestorage.com`).
- **`S3_BUCKET`**: The name of the bucket you created in your provider's dashboard.
- **`S3_ACCESS_KEY_ID`**: Generated in your provider's security/credentials dashboard.
- **`S3_SECRET_ACCESS_KEY`**: Generated alongside your Access Key ID.
- **`S3_REGION`**: Typically `us-east-1` for AWS, or `auto` for Cloudflare R2.
