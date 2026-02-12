# Rev 4 Documentation Restructure

## TL;DR

> **Quick Summary**: Restructure x402.NanoSession documentation for Rev 4 by adding a Communication Flow section to Protocol, moving Motivation to Intro, merging Terminology into Glossary, and removing the tree view injection from the build script.
> 
> **Deliverables**:
> - `docs/x402_NanoSession_rev4_Protocol.md` - with new Communication Flow section
> - `docs/x402_NanoSession_rev4_Intro.md` - with "Why NanoSession?" motivation section
> - `docs/x402_NanoSession_rev4_Glossary.md` - with merged terminology
> - `docs/x402_NanoSession_rev4_Extension_A_Pools.md` - updated backlink
> - `docs/x402_NanoSession_rev4_Extension_B_Stochastic.md` - updated backlink
> - `docs/x402_NanoSession_rev4_Extension_x402_Compat.md` - updated backlink
> - Updated `site/scripts/prepare-rev.js` - remove tree view injection
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (Protocol) → Task 4 (Extensions) → Task 6 (Build Test)

---

## Context

### Original Request
User requested Rev 4 documentation restructure with:
1. Add Communication Flow section to Protocol (emulating x402.org docs style)
2. Move Motivation from Protocol to Intro (as "Why NanoSession?")
3. Merge Terminology section into Glossary
4. Remove "📂 Specification Structure" tree from Protocol (sidebar handles navigation)

### Current State (Rev 3)
- **Protocol** has: Abstract, §1 Motivation, §2 Terminology, §3 Architecture, §4 Technical Spec, §5 Extensions
- **Intro** has: Opening paragraph, comparison table (15 lines total)
- **Glossary** has: 7 defined terms (Raw Tagging, Nano Dust, TAG_MODULUS, Spent Set, Async Verification, Janitor Process, Session, Purse)
- **Extensions**: 3 files (Pools, Stochastic, x402 Compat)

### Rev 4 Target Structure
- **Protocol**: Abstract, §1 Communication Flow (NEW), §2 Architecture (was §3), §3 Technical Spec (was §4), §4 Extensions (was §5)
- **Intro**: Opening paragraph, comparison table, §Why NanoSession? (moved from Protocol Motivation)
- **Glossary**: Existing terms + Session/Raw Tagging/Async Verification/Spent Set from Terminology

---

## Work Objectives

### Core Objective
Create Rev 4 documentation with improved structure: Communication Flow section for clarity, consolidated glossary for single source of truth, and streamlined Protocol without redundant navigation.

### Concrete Deliverables
- 7 markdown files in `docs/` with `rev4` prefix
- Updated `prepare-rev.js` without tree view injection

### Definition of Done
- [x] `SPEC_REV=rev4 pnpm docs:build` succeeds in `site/`
- [x] `pnpm docs:preview` shows all pages correctly
- [x] No dead links in generated site
- [x] Protocol has Communication Flow as §1
- [x] Intro has "Why NanoSession?" section after table
- [x] Glossary has all terminology definitions

### Must Have
- Communication Flow section with simplified diagram + detailed steps
- ASCII sequence diagram for visual learners
- All existing content preserved (just restructured)
- Extensions backlink to rev4 Protocol

### Must NOT Have (Guardrails)
- Do NOT duplicate content between Protocol and Glossary
- Do NOT add content not in Rev 3 (just restructure)
- Do NOT change technical specifications
- Do NOT break existing links in Extensions

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: N/A (documentation, not code)
- **Automated tests**: None (manual verification via site build)
- **Framework**: VitePress build + preview

### Agent-Executed QA Scenarios

All verification performed by agent via Bash commands:

```
Scenario: Site builds successfully with Rev 4
  Tool: Bash
  Preconditions: pnpm installed, site dependencies installed
  Steps:
    1. cd site && SPEC_REV=rev4 pnpm docs:build
    2. Assert: Exit code 0
    3. Assert: No "dead link" errors in output
  Expected Result: Build completes without errors
  Evidence: Build output captured

Scenario: Protocol has new structure
  Tool: Bash (grep)
  Preconditions: Rev 4 files created
  Steps:
    1. grep "## 1. Communication Flow" docs/x402_NanoSession_rev4_Protocol.md
    2. grep "## 2. Architecture" docs/x402_NanoSession_rev4_Protocol.md
    3. Assert: Both patterns found
    4. grep "## 1. Motivation" docs/x402_NanoSession_rev4_Protocol.md
    5. Assert: Pattern NOT found
  Expected Result: New section structure verified
  Evidence: grep output

Scenario: Intro has Why NanoSession section
  Tool: Bash (grep)
  Preconditions: Rev 4 Intro created
  Steps:
    1. grep -i "Why NanoSession" docs/x402_NanoSession_rev4_Intro.md
    2. Assert: Pattern found
  Expected Result: Motivation content moved to Intro
  Evidence: grep output

Scenario: Glossary has merged terminology
  Tool: Bash (grep)
  Preconditions: Rev 4 Glossary created
  Steps:
    1. grep "## Session" docs/x402_NanoSession_rev4_Glossary.md
    2. grep "## Raw Tagging" docs/x402_NanoSession_rev4_Glossary.md
    3. grep "## Async Verification" docs/x402_NanoSession_rev4_Glossary.md
    4. grep "## Spent Set" docs/x402_NanoSession_rev4_Glossary.md
    5. Assert: All patterns found
  Expected Result: All terminology merged into glossary
  Evidence: grep output
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Create rev4 Protocol (no dependencies)
├── Task 2: Create rev4 Intro (no dependencies)
└── Task 3: Create rev4 Glossary (no dependencies)

Wave 2 (After Wave 1):
├── Task 4: Create rev4 Extensions (depends: 1 for backlink target)
└── Task 5: Update prepare-rev.js (no strict dependency, but logically after docs)

Wave 3 (After Wave 2):
└── Task 6: Test site build (depends: all above)
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 4, 6 | 2, 3 |
| 2 | None | 6 | 1, 3 |
| 3 | None | 6 | 1, 2 |
| 4 | 1 | 6 | 5 |
| 5 | None | 6 | 4 |
| 6 | 1, 2, 3, 4, 5 | None | None (final) |

---

## TODOs

- [x] 1. Create Rev 4 Protocol with Communication Flow

  **What to do**:
  - Copy `docs/x402_NanoSession_rev3_Protocol.md` to `docs/x402_NanoSession_rev4_Protocol.md`
  - Update date to "February 12, 2026" and Previous Version to `rev3`
  - Remove §1 Motivation section entirely
  - Remove §2 Terminology section entirely
  - Add new §1 "Communication Flow" with:
    - §1.1 Overview (simplified ASCII diagram: Client → 402 → Payment → Verify → Access)
    - §1.2 Typical Payment Flow (numbered steps with descriptions)
    - §1.3 Sequence Diagram (ASCII mermaid-style or ASCII art)
  - Renumber sections: Architecture becomes §2, Technical Spec becomes §3, Extensions becomes §4
  - Update any internal cross-references

  **Must NOT do**:
  - Add new technical content not in Rev 3
  - Change the actual specification logic
  - Duplicate glossary definitions in flow descriptions

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation restructuring task focused on prose and structure
  - **Skills**: `[]` (no special skills needed)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4 (extensions need backlink target)
  - **Blocked By**: None

  **References**:
  - `docs/x402_NanoSession_rev3_Protocol.md` - Source content for all sections
  - `docs/x402_NanoSession_rev3_Protocol.md:49-64` - Verification Flow steps (use as basis for Communication Flow)
  - x402 docs pattern: Simplified overview → Detailed steps → Diagram

  **Communication Flow Content Guide**:
  
  §1.1 Overview should show:
  ```
  ┌────────┐         ┌────────┐         ┌──────────┐
  │ Client │         │ Server │         │   Nano   │
  └───┬────┘         └───┬────┘         └────┬─────┘
      │  GET /resource   │                   │
      │─────────────────>│                   │
      │  402 + Headers   │                   │
      │<─────────────────│                   │
      │           Send Block                 │
      │─────────────────────────────────────>│
      │  GET /resource + Block Hash          │
      │─────────────────>│                   │
      │                  │  Verify Block     │
      │                  │──────────────────>│
      │  200 OK          │                   │
      │<─────────────────│                   │
  ```

  §1.2 Typical Payment Flow (expand from existing §4.2):
  1. Client requests protected resource
  2. Server returns 402 with payment requirements
  3. Client calculates tagged amount
  4. Client signs and broadcasts send block
  5. Client retries request with block hash
  6. Server verifies block on network
  7. Server grants access

  §1.3 Keep it simple - the ASCII diagram above suffices

  **Acceptance Criteria**:
  - [ ] File exists: `docs/x402_NanoSession_rev4_Protocol.md`
  - [ ] `grep "## 1. Communication Flow" docs/x402_NanoSession_rev4_Protocol.md` → found
  - [ ] `grep "## 2. Architecture" docs/x402_NanoSession_rev4_Protocol.md` → found
  - [ ] `grep "## 3. Technical Specification" docs/x402_NanoSession_rev4_Protocol.md` → found
  - [ ] `grep "## 1. Motivation" docs/x402_NanoSession_rev4_Protocol.md` → NOT found
  - [ ] `grep "## 2. Terminology" docs/x402_NanoSession_rev4_Protocol.md` → NOT found
  - [ ] Date line contains "February 12, 2026"

  **Commit**: YES (groups with 2, 3)
  - Message: `docs: create rev4 Protocol with Communication Flow section`
  - Files: `docs/x402_NanoSession_rev4_Protocol.md`

---

- [x] 2. Create Rev 4 Intro with Why NanoSession

  **What to do**:
  - Copy `docs/x402_NanoSession_rev3_Intro.md` to `docs/x402_NanoSession_rev4_Intro.md`
  - Update frontmatter title if needed
  - Keep existing opening paragraph and comparison table
  - Add new section "## Why NanoSession?" after the table
  - Content for "Why NanoSession?": Adapt from Rev 3 Protocol §1 Motivation:
    - The "Agent Economy" context
    - Nano's unique properties (sub-500ms verification, no fees)
    - Focus on simplest implementation

  **Must NOT do**:
  - Remove the comparison table
  - Change the technical comparison facts
  - Add content not derived from Rev 3

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation prose writing
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:
  - `docs/x402_NanoSession_rev3_Intro.md` - Source file to copy
  - `docs/x402_NanoSession_rev3_Protocol.md:14-17` - Motivation content to move

  **Acceptance Criteria**:
  - [ ] File exists: `docs/x402_NanoSession_rev4_Intro.md`
  - [ ] `grep -i "Why NanoSession" docs/x402_NanoSession_rev4_Intro.md` → found
  - [ ] `grep "Agent Economy" docs/x402_NanoSession_rev4_Intro.md` → found
  - [ ] `grep "Feature" docs/x402_NanoSession_rev4_Intro.md` → found (table preserved)

  **Commit**: YES (groups with 1, 3)
  - Message: `docs: create rev4 Intro with Why NanoSession section`
  - Files: `docs/x402_NanoSession_rev4_Intro.md`

---

- [x] 3. Create Rev 4 Glossary with Merged Terminology

  **What to do**:
  - Copy `docs/x402_NanoSession_rev3_Glossary.md` to `docs/x402_NanoSession_rev4_Glossary.md`
  - Verify these terms from Protocol §2 Terminology exist in Glossary:
    - Session ✓ (already in Glossary)
    - Raw Tagging ✓ (already in Glossary)
    - Async Verification ✓ (already in Glossary)
    - Spent Set ✓ (already in Glossary)
  - Since all terms already exist, just ensure descriptions are comprehensive
  - No changes needed if content is already merged (Rev 3 Glossary looks complete)

  **Must NOT do**:
  - Duplicate definitions
  - Remove existing glossary content
  - Change the meaning of any term

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file copy with verification
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:
  - `docs/x402_NanoSession_rev3_Glossary.md` - Source file
  - `docs/x402_NanoSession_rev3_Protocol.md:18-24` - Terminology section (verify all terms covered)

  **Acceptance Criteria**:
  - [ ] File exists: `docs/x402_NanoSession_rev4_Glossary.md`
  - [ ] `grep "## Session" docs/x402_NanoSession_rev4_Glossary.md` → found
  - [ ] `grep "## Raw Tagging" docs/x402_NanoSession_rev4_Glossary.md` → found
  - [ ] `grep "## Async Verification" docs/x402_NanoSession_rev4_Glossary.md` → found
  - [ ] `grep "## Spent Set" docs/x402_NanoSession_rev4_Glossary.md` → found

  **Commit**: YES (groups with 1, 2)
  - Message: `docs: create rev4 Glossary`
  - Files: `docs/x402_NanoSession_rev4_Glossary.md`

---

- [x] 4. Create Rev 4 Extensions with Updated Backlinks

  **What to do**:
  - Copy all 3 extension files to rev4 versions:
    - `x402_NanoSession_rev3_Extension_A_Pools.md` → `x402_NanoSession_rev4_Extension_A_Pools.md`
    - `x402_NanoSession_rev3_Extension_B_Stochastic.md` → `x402_NanoSession_rev4_Extension_B_Stochastic.md`
    - `x402_NanoSession_rev3_Extension_x402_Compat.md` → `x402_NanoSession_rev4_Extension_x402_Compat.md`
  - Update each file:
    - Change date to "February 12, 2026"
    - Change "Extension For" to `x402_NanoSession_Protocol_rev4.md`

  **Must NOT do**:
  - Change technical content
  - Break internal links

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple copy + search-replace
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1 (protocol must exist for backlink consistency)

  **References**:
  - `docs/x402_NanoSession_rev3_Extension_A_Pools.md:1-6` - Header to update
  - `docs/x402_NanoSession_rev3_Extension_B_Stochastic.md:1-6` - Header to update
  - `docs/x402_NanoSession_rev3_Extension_x402_Compat.md:1-6` - Header to update

  **Acceptance Criteria**:
  - [ ] File exists: `docs/x402_NanoSession_rev4_Extension_A_Pools.md`
  - [ ] File exists: `docs/x402_NanoSession_rev4_Extension_B_Stochastic.md`
  - [ ] File exists: `docs/x402_NanoSession_rev4_Extension_x402_Compat.md`
  - [ ] `grep "rev4" docs/x402_NanoSession_rev4_Extension_A_Pools.md` → found
  - [ ] `grep "rev4" docs/x402_NanoSession_rev4_Extension_B_Stochastic.md` → found

  **Commit**: YES
  - Message: `docs: create rev4 Extensions with updated backlinks`
  - Files: All 3 extension files

---

- [x] 5. Update prepare-rev.js to Remove Tree View Injection

  **What to do**:
  - Edit `site/scripts/prepare-rev.js`
  - Remove lines 103-111 (tree view generation):
    ```javascript
    // Inject "Tree View" at the top
    let treeView = `\n### 📂 Specification Structure\n...`
    ```
  - Remove line 124 where treeView is prepended:
    ```javascript
    const finalProtocolContent = treeView + protocolContent + seeAlso;
    ```
  - Replace with just:
    ```javascript
    const finalProtocolContent = protocolContent + seeAlso;
    ```
  - Keep the "See Also" section at the bottom (still useful)

  **Must NOT do**:
  - Remove the "See Also" injection (still valuable)
  - Break the file mapping logic
  - Change extension file handling

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, targeted code edit
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 6
  - **Blocked By**: None (logically after docs but no hard dependency)

  **References**:
  - `site/scripts/prepare-rev.js:103-111` - Tree view generation to remove
  - `site/scripts/prepare-rev.js:124` - Line that prepends treeView

  **Acceptance Criteria**:
  - [ ] `grep "Specification Structure" site/scripts/prepare-rev.js` → NOT found
  - [ ] `grep "treeView" site/scripts/prepare-rev.js` → NOT found
  - [ ] `grep "seeAlso" site/scripts/prepare-rev.js` → found (preserved)
  - [ ] Script still runs: `node site/scripts/prepare-rev.js` exits 0

  **Commit**: YES
  - Message: `chore(site): remove tree view injection from prepare-rev.js`
  - Files: `site/scripts/prepare-rev.js`

---

- [x] 6. Verify Site Build with Rev 4

  **What to do**:
  - Run site build with rev4
  - Verify no errors
  - Preview and spot-check structure

  **Must NOT do**:
  - Skip this verification step
  - Ignore build warnings

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Command execution and output verification
  - **Skills**: `["playwright"]` (if visual verification needed)

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final)
  - **Blocks**: None (final task)
  - **Blocked By**: All previous tasks

  **References**:
  - `site/package.json` - build scripts
  - `site/AGENTS.md` - build instructions

  **Acceptance Criteria**:
  - [ ] `cd site && SPEC_REV=rev4 pnpm docs:build` → exit code 0
  - [ ] No "dead link" warnings in build output
  - [ ] `ls site/.vitepress/dist/` shows generated files

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1, 2, 3 (grouped) | `docs: create rev4 documentation structure` | All 3 core docs | grep checks |
| 4 | `docs: create rev4 Extensions` | 3 extension files | grep checks |
| 5 | `chore(site): remove tree view injection` | prepare-rev.js | script run |
| 6 | N/A (verification) | N/A | build success |

---

## Success Criteria

### Verification Commands
```bash
# All rev4 docs exist
ls docs/x402_NanoSession_rev4_*.md  # Expected: 7 files

# Protocol structure correct
grep "## 1. Communication Flow" docs/x402_NanoSession_rev4_Protocol.md
grep "## 2. Architecture" docs/x402_NanoSession_rev4_Protocol.md
grep "## 1. Motivation" docs/x402_NanoSession_rev4_Protocol.md  # Expected: NOT found

# Intro has motivation
grep -i "Why NanoSession" docs/x402_NanoSession_rev4_Intro.md

# Tree view removed from script
grep "Specification Structure" site/scripts/prepare-rev.js  # Expected: NOT found

# Site builds
cd site && SPEC_REV=rev4 pnpm docs:build  # Expected: exit 0
```

### Final Checklist
- [x] All 7 rev4 markdown files created
- [x] Protocol has Communication Flow as §1
- [x] Protocol does NOT have Motivation or Terminology sections
- [x] Intro has "Why NanoSession?" section
- [x] Glossary has all terminology definitions
- [x] Extensions reference rev4 Protocol
- [x] prepare-rev.js no longer injects tree view
- [x] Site builds successfully with SPEC_REV=rev4
