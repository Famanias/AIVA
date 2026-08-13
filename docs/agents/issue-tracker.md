# Issue Tracker Configuration

- **Type**: Local Markdown
- **Location**: `.scratch/`
- **CLI Tool**: none
- **PRs as request surface**: false

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is recorded as a `Status:` line near the top of each issue file
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Wayfinding operations

- **Map**: `.scratch/<effort>/map.md`
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`
- **Blocking**: `Blocked by: NN, NN` line near top
- **Claim**: `Status: claimed`
- **Resolve**: `Status: resolved` under `## Answer`

