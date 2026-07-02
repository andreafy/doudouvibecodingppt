# Changelog

## 2026-07-02

### Added

- Added non-self topic draw rules: topics can now carry `submitterId` and `submitterName`, and a speaker cannot draw a topic or PPT submitted by themselves.
- Added full draw-plan generation before locking results, so the host is warned if the remaining topic pool cannot avoid self-submitted topics.
- Added `scripts/validate-event-topics.mjs` to validate participants, topic submitters, topic counts, and non-self draw feasibility before the event.
- Added Demo Flash / Demo Wall workflow from `codex/demo-flash-workflow`.
- Added reusable stage timer presets for formal talks, demo flashes, and handoff buffers.
- Added streamlined host run controls for moving through the live event flow.

### Changed

- Topic sample data and Feishu sync output now preserve `submitterId`, `submitterName`, `status`, and `enabled`.
- Draw logs now export submitter metadata and the applied draw rule.
- Stage mode can show the timer on the projection page, and timer state syncs across control and stage windows.

### Not Included

- Did not merge `9360336 fix: keep stage brand penguin visible`; that visual change remains only on the experimental branch.
