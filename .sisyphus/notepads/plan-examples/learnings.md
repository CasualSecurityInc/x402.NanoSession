Plan: Fix examples/server/package.json to remove Express and adopt workspace-based setup.
- Change: package name to @nanosession/examples-server
- Change: version to 0.1.0
- Change: start script to use tsx src/index.ts
- Change: dependencies to use workspace:* for @nanosession/core and @nanosession/server
- Guardrail: no heavy frameworks (remove Express)
- Verification: ensure 'express' does not appear in the file via grep express

Actions taken:
- Updated examples/server/package.json to exact content specified.
- Verified by reading the file; Express dependency is removed.

Success criteria:
- package.json content matches expected values
- No Express dependency exists in the file
- Uses workspace:* dependencies
- Uses tsx in start script
