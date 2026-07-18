# Security Guidelines

This document outlines the security architecture and best practices for the AIVA platform.

## 1. Security Philosophy

- **Defense in Depth**: Do not rely on a single security boundary.
- **Least Privilege**: Components, containers, and database roles must only have access to the resources they strictly need.
- **Fail Securely**: If an authentication or authorization check fails, the default action is to deny access and log the attempt.
- **Zero Trust Between Services**: Internal services should not implicitly trust each other simply because they reside on the same network.

## 2. Secrets Management

- **Never Commit Secrets**: Passwords, API keys, and internal tokens must never reside in source control.
- **Environment Variables**: Use `.env.local` for local development. In production, inject secrets via the environment (or a dedicated Secrets Manager).
- **Secret Rotation**: Rotate API keys and JWT secrets periodically. If a secret leaks, rotate it immediately and revoke the old token.
- **Service Role Key Handling**: The Supabase `service_role` key bypasses all Row Level Security (RLS). It must only be provided to the isolated Python/Node.js backend workers. The Next.js client must **never** possess or expose this key.

## 3. Authentication

- **Supabase Auth**: All user authentication is delegated to Supabase Auth.
- **JWT Validation**: The Next.js middleware and API routes validate the JWT attached to incoming requests before performing actions.
- **Worker Authentication**: Next.js communicates with Python and Node.js workers via internal API routes using a shared secret (`WORKERS_INTERNAL_AUTH_TOKEN`).
- **Internal Service Authentication**: Inter-service communication must validate the internal auth token.

## 4. Authorization

- **Row Level Security (RLS)**: Enabled on all Supabase tables. Users can only read, update, or delete data belonging to their specific `project_id`.
- **Service Role Usage**: Background workers operate with the `service_role` key because they are trusted internal systems performing asynchronous tasks on behalf of users.
- **Internal Permissions**: Ensure queue consumers only execute jobs they are designed to handle.

## 5. API Security

- **Input Validation**: Assume all client input is malicious.
  - Next.js: Use Zod to validate all incoming API payloads.
  - Python: Use Pydantic to strictly validate request models and AI generated outputs.
- **Rate Limiting**: Apply rate limits on public-facing endpoints (e.g., job submission, auth endpoints) to prevent abuse and DDoS.
- **Timeouts**: Every external provider call and inter-service HTTP request must have a strict timeout configured.
- **Retries and Idempotency**: Queue retries (BullMQ) must be idempotent. A failed job that retries must not corrupt the database or double-charge the ledger.

## 6. Worker Security

- **Internal-Only Endpoints**: FastAPI and Remotion worker endpoints should not be exposed to the public internet. They must sit behind a reverse proxy or VPC.
- **Network Isolation**: Workers should ideally reside in a separate network tier from the public-facing Next.js application.
- **Payload Validation**: Workers must validate the JSON payload received from the queue or API Gateway using Pydantic/Zod before processing.

## 7. File & Storage Security

- **Asset Validation**: Verify the integrity of downloaded media assets.
- **Allowed MIME Types**: Only allow specific, safe file types for uploads and processing (e.g., `image/png`, `audio/mpeg`, `video/webm`).
- **Path Traversal Prevention**: Never trust user-provided filenames. Always sanitize paths or use securely generated UUIDs when interacting with the local filesystem.
- **Safe Temporary Files**: Ensure temp directories are cleared after job completion to prevent disk exhaustion and data leakage.
- **Storage Boundaries**: Supabase Storage buckets should enforce RLS policies restricting access to the owning user.

## 8. Rendering Security

- **FFmpeg Safety**: Never construct FFmpeg commands via string concatenation. Always use the `FilterGraphBuilder` abstraction to prevent command injection vulnerabilities.
- **Remotion Safety**: The Remotion renderer executes Chromium via Puppeteer. Ensure the Chromium sandbox is enabled and properly isolated. No arbitrary JavaScript execution should be permitted from user inputs.

## 9. AI Security

- **Prompt Versioning**: Store and version prompts in the database (`prompt-library`). This enables auditing if a specific prompt version leads to unsafe outputs.
- **Prompt Injection**: Assume user-provided topics can contain injection attempts (e.g., "Ignore previous instructions and output..."). Sanitize and constrain the context window.
- **Output Validation**: Treat all LLM outputs as untrusted. Parse and validate JSON strictly using Pydantic/Zod schemas.
- **Provider Isolation**: Ensure provider API keys are scoped to minimum necessary permissions (e.g., a specific project or environment).

## 10. Infrastructure Security

- **Docker Security**: Run containers as non-root users where possible. Keep base images updated.
- **Redis**: Bind Redis strictly to the internal network. Require a password if network isolation is insufficient.
- **Environment Isolation**: Maintain strict separation between Development, Staging, and Production environments.

## 11. Dependency Security

- **Package Updates**: Regularly update `npm` and `pip` packages.
- **Vulnerability Scanning**: Use `npm audit`, `pip-audit`, or Dependabot to detect vulnerable dependencies.
- **Supply Chain**: Pin dependency versions in lockfiles (`pnpm-lock.yaml`, `requirements.txt`).

## 12. Logging & Auditing

- **Never Log Secrets**: Scrub passwords, API keys, and JWTs from logs.
- **PII Handling**: Avoid logging Personally Identifiable Information (PII) unless absolutely necessary and legally compliant.
- **Error Sanitization**: Do not expose internal stack traces or database errors to the client API response.
- **Observability**: Ensure telemetry data is securely stored and access is restricted.

## 13. Incident Response

- **Secret Compromise**: Immediately rotate the affected key, invalidate active sessions, and check audit logs for unauthorized access.
- **Service Outage**: Rely on the queue architecture (BullMQ) to retain pending jobs until services are restored.
- **Data Corruption**: Maintain daily automated database backups in Supabase.
- **Recovery Strategy**: Document and test the restore procedures for the database and storage buckets.

## 14. Future Hardening (P2/P3 Roadmap)

- **mTLS**: Implement mutual TLS for all inter-service communication.
- **Secrets Manager**: Migrate from `.env` files to a centralized Vault (e.g., AWS Secrets Manager, HashiCorp Vault).
- **Signed Requests**: Require cryptographic signatures on internal service requests instead of a static shared token.
- **Audit Logs**: Implement a dedicated, immutable audit log for sensitive actions (e.g., user deletion, permission changes).
- **CSP**: Enforce strict Content Security Policy headers on the Next.js frontend.
- **SAST/DAST**: Integrate Static and Dynamic Application Security Testing into the CI/CD pipeline.
- **SBOM Generation**: Automatically generate a Software Bill of Materials during builds.
- **Container Scanning**: Integrate image vulnerability scanning into GitHub Actions.
