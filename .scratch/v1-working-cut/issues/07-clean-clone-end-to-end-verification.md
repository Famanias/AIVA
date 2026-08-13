# 07 Clean Clone End-to-End Verification

Type: task
Status: open
Blocked by: 02, 06

## Question

How do we construct and run an automated certification test that boots the stack, submits a topic brief and a custom script brief, validates master MP4 + SRT outputs, triggers a timeline single-scene re-render, and asserts 100% test passage on a clean workspace?

## Context

Previous certifications used stubbed test scripts (`scripts/certify_pipeline.ts` hardcoding PASS). A true verification must exercise the actual running services and assert real generated media.

## Acceptance Criteria

1. Verification script tests topic brief end-to-end (producing valid `composition.mp4` and `subtitles.srt`).
2. Verification script tests custom script brief end-to-end (bypassing research/outline).
3. Verification script triggers single-scene re-render and verifies the updated MP4 is re-composed.
4. Clean Docker build passes without errors.
