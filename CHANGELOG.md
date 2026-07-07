# Changelog

## 2026-07-07

### Added

- Added the real Hangzhou event topic pool in `hangzhou-event-topics.json`, including three public backup topics.
- Added a controlled redraw action for locked speakers, allowing the host to release only the current speaker's draw result and run the same non-self draw flow again.

### Changed

- Switched the Feishu sync default topic file from the sample data to `hangzhou-event-topics.json`.
- Updated the server-side fallback topic pool to the real Hangzhou topics, so production will not fall back to the old sample topics if the JSON file is unavailable in the serverless bundle.
- Configured Vercel to include `hangzhou-event-topics.json` in the event data function bundle.
- Topic validation now allows disabled blank placeholders while still blocking enabled topics without titles or PPT filenames.
- Kept 阿巧's topic slot as a disabled blank placeholder until the real title and PPT are submitted.

## 2026-07-02

### Added

- Added non-self topic draw rules: topics can now carry `submitterId` and `submitterName`, and a speaker cannot draw a topic or PPT submitted by themselves.
- Added full draw-plan generation before locking results, so the host is warned if the remaining topic pool cannot avoid self-submitted topics.
- Added `scripts/validate-event-topics.mjs` to validate participants, topic submitters, topic counts, and non-self draw feasibility before the event.
- Added Demo Flash / Demo Wall workflow from `codex/demo-flash-workflow`.
- Added reusable stage timer presets for formal talks, demo flashes, and handoff buffers.
- Added streamlined host run controls for moving through the live event flow.
- Added an opening overview on the projection standby screen with live signup stats and a four-step event flow.

### Changed

- Topic sample data and Feishu sync output now preserve `submitterId`, `submitterName`, `status`, and `enabled`.
- Draw logs now export submitter metadata and the applied draw rule.
- Stage mode can show the timer on the projection page, and timer state syncs across control and stage windows.

### Not Included

- Did not merge `9360336 fix: keep stage brand penguin visible`; that visual change remains only on the experimental branch.
