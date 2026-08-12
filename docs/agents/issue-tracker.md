# Issue Tracker Configuration

- **Type**: GitHub Issues
- **Repository**: `Famanias/AIVA`
- **CLI Tool**: `gh`
- **PRs as request surface**: false

## Agent Rules

1. **Reading Issues**:
   - List open issues: `gh issue list`
   - View specific issue details: `gh issue view <issue-number>`
   - View comments: `gh issue view <issue-number> --comments`

2. **Creating & Updating Issues**:
   - Create issue: `gh issue create --title "<title>" --body "<body>"`
   - Add comment: `gh issue comment <issue-number> --body "<body>"`
   - Close issue: `gh issue close <issue-number>`

3. **Constraints**:
   - Always verify issue state before modifying.
   - Do not create duplicate issues for known tasks.
