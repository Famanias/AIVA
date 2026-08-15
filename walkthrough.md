# Walkthrough: AI Studio Briefing & Dynamic Visual Video Engine

We upgraded AIVA from rigid template selectors to an interactive **AI Studio Briefing Chatroom**, integrated **Multi-Tier Free Video & AI Asset Providers (Pexels, Pixabay, Pollinations.ai)**, fixed the FFmpeg visual track data contract, and enabled the **Remotion Ken Burns Motion Engine** for cinematic 60 FPS video generation.

---

## What Was Changed

### 1. Interactive AI Studio Briefing Chat
- **New API Route** ([route.ts](file:///d:/repos/AIVA/apps/web/src/app/api/v1/studio/brief/route.ts)): Coordinates conversational creative briefing with the active LLM provider (OmniRoute / OpenRouter / Ollama).
- **Redesigned Dashboard Component** ([initialize-pipeline.tsx](file:///d:/repos/AIVA/apps/web/src/components/dashboard/initialize-pipeline.tsx)):
  - Replaced rigid template dropdowns with an **AI Studio Producer Chat**.
  - When entering a concept, the AI analyzes the angle and asks 2–3 sharp questions to nail down tone, mood, and visual vibe.
  - Retained a dedicated **Quick Script Launch** tab for 1-click video creation when pasting full scripts.

### 2. Multi-Tier Free Asset Providers & Hybrid Smart Routing
- **Updated Provider Engine** ([asset_providers.py](file:///d:/repos/AIVA/apps/workers/app/providers/asset_providers.py)):
  - **Pexels Video API**: Searches portrait HD video clips with portrait/landscape fallbacks and photo backup.
  - **Pixabay Video API**: Integrated for free stock video clips and dynamic background loops.
  - **Pollinations.ai Provider**: 100% free, zero-key Flux/SDXL image generator at 9:16 portrait resolution for abstract, historical, or imaginative scenes.
- **Hybrid Selection Strategy** ([asset_strategy.py](file:///d:/repos/AIVA/apps/workers/app/services/asset_strategy.py)): Chains `Pexels -> Pixabay -> Pollinations -> SDXL`.

### 3. Pipeline Data Contract & Asset Slot Alignment
- **Fixed Composition Handler** ([CompositionHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/CompositionHandler.ts)): Correctly extracts `scene.asset_manifest.asset_slots.background.storage_key` and aligns per-scene durations from voiceovers.
- **Fixed Render Handler** ([RenderHandler.ts](file:///d:/repos/AIVA/apps/web/src/services/pipeline/handlers/RenderHandler.ts)): Propagates resolved `assetUrl` into Remotion `PipelineIR`.
- **Enriched Asset Router** ([assets.py](file:///d:/repos/AIVA/apps/workers/app/routers/assets.py)): Enriches scene payloads with `assetUrl`, `asset_url`, and `asset_ref`.

### 4. Remotion Ken Burns & FFmpeg Composition Engine
- **Ken Burns Motion Template** ([KenBurns.tsx](file:///d:/repos/AIVA/apps/template-renderer/src/templates/ken-burns/KenBurns.tsx)): Renders real image/video assets with cinematic spring-based pan, tilt, zoom, and dark gradient overlays.
- **FFmpeg Trimming & Concatenation** ([graph_builder.py](file:///d:/repos/AIVA/apps/workers/app/core/composition/graph_builder.py)): Crops, scales (1080x1920 9:16), trims each background video to its voiceover duration, and concatenates all scenes seamlessly with auto-ducked ambient audio.

---

## Verification Results

### Automated Tests
- **Monorepo Build:** `pnpm build` completed with **4/4 packages successful** (0 TypeScript/Next.js/Remotion errors).
- **Worker Tests:** `pytest tests/` passed **33/33 tests** (`33 passed in 40.34s`).

---

## Manual QA Verification Steps

You can validate these new capabilities directly in your browser:

### Step 1: Test the Interactive AI Studio Briefing
1. Navigate to [http://localhost:3000](http://localhost:3000).
2. On the **Studio Briefing** tab, enter a concept topic (e.g., *"The Mystery of the Voynich Manuscript"* or *"Why did Coffee change the world?"*).
3. Click **Start Briefing Chat**.
4. Observe the AI Creative Director analyzing your topic and asking 2–3 creative direction questions (tone, mood, visual preference).
5. Reply in chat (e.g., *"Make it dark and mysterious with cinematic visuals"*).
6. Click **Generate Video with this Brief**.

### Step 2: Test 1-Click Quick Script Launch
1. On the dashboard, switch to the **Quick Script Launch** tab.
2. Paste a custom script.
3. Click **Launch 1-Click Video Generation**.

### Step 3: Verify Visual Footage & Final Video
1. Once the pipeline completes, open the generated video on the project page or play `storage/projects/<project_id>/composition.mp4`.
2. Confirm:
   - **Real moving video footage / Ken Burns animated visuals** play across all scenes.
   - **Voiceover narration** is crisp and synchronized.
   - **Kinetic subtitles** are animated and legible over the visual backdrop.
   - **Ambient background music** auto-ducks during spoken narration.
