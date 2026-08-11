# AP2 Evidence Authenticity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require issuer-signed AP2 dispute records before checkout/payment/receipt facts can drive escrow settlement.

**Architecture:** Keep commit-pinned GitHub JSON as the replayable transport, then verify an Ed25519 issuer-signed payload inside the nondeterministic evaluation before deriving AP2 mismatches. Invalid authenticity returns `UNVERIFIABLE` and cannot release/refund escrow.

**Tech Stack:** GenVM Python contract, Python stdlib `hashlib`/`json`, pytest direct tests, existing PowerShell `npm run check`.

## Global Constraints

- Contract source remains pure ASCII.
- No new external runtime dependency is introduced.
- Public facts that move escrow must pass deterministic issuer signature checks.
- Regression tests must fail before production code changes and pass after.

---

### Task 1: Signed Evidence Test Fixtures

**Files:**
- Modify: `tests/direct/test_mandate_state.py`
- Modify: `tests/direct/test_adjudication.py`
- Modify: `tests/direct/test_dispute_accounting.py`

**Interfaces:**
- Produces `ISSUER_ID`, `ISSUER_PUBLIC_KEY`, and signed AP2 bundle helpers.
- Updates `open_valid_mandate` to pass issuer identity/key.

- [x] Write signed bundle helpers and failing tests for unsigned fabricated, forged, replay, stale/future, authorized, and violation evidence.
- [x] Run focused adjudication tests and confirm failure against the current contract.

### Task 2: Contract Signature Verification

**Files:**
- Modify: `contracts/ap2_mandate_settlement.py`

**Interfaces:**
- `open_mandate(..., ap2_spec_hash, authorized_issuer_id, authorized_issuer_public_key, dispute_bond_amount)`
- `_verified_payload_or_unverifiable(...) -> dict`

- [x] Add mandate issuer fields and parameter validation.
- [x] Implement pure-Python Ed25519 verification.
- [x] Verify envelope, payload binding, and timestamp before mismatch extraction.
- [x] Rerun focused tests until green.

### Task 3: Documentation And Claims

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/SUBMISSION.md`
- Modify: `docs/evidence/public-fixtures/ap2-authorized.json`
- Modify: `docs/evidence/public-fixtures/ap2-violation.json`

**Interfaces:**
- README reflects Evidence availability/authenticity gates separately.
- Submission text says full SD-JWT is a milestone, while v2 verifies issuer-signed records.

- [x] Replace commit/hash-only authenticity claims with issuer-signed evidence claims.
- [x] Update public fixture shape to signed envelopes.
- [x] Remove v1 limitation that signature semantics are only LLM judged.

### Task 4: Verification

**Files:**
- Review all changed files.

- [x] Run focused direct tests.
- [x] Run `npm run check`.
- [x] Review diffs for secrets, generated junk, stale claims, and unintended project changes.

## Verification Evidence

- Focused RED: fabricated hash-valid unsigned evidence failed before contract implementation because `open_mandate` did not yet accept issuer identity/key.
- Focused GREEN: `tests/direct/test_adjudication.py::test_fabricated_hash_valid_unsigned_evidence_is_unverifiable` passed after implementation.
- Local suite: `npm run check` passed on 2026-08-12 with 47 direct tests and 7 deployment parser tests.
