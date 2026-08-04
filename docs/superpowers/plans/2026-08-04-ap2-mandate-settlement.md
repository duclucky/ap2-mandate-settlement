# AP2 Mandate Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, test, deploy, document, and package a standalone AP2 mandate dispute settlement Intelligent Contract with no frontend.

**Architecture:** One GenVM contract owns mandate escrow, dispute evidence commitments, validator adjudication, settlement credits, and canonical views. Evidence is a bounded, commit-pinned public JSON bundle whose SHA-256 digest is locked before nondeterministic adjudication. The validator compares AP2 conformance meaning rather than rationale text or JSON shape.

**Tech Stack:** GenVM Python contract, `genlayer-test==0.29.2`, pytest, Node test runner for deployment parser fixtures, PowerShell check script, Studionet deployment scripts.

## Global Constraints

- Category is `Intelligent Contracts`; do not create `frontend/` and do not deploy to Vercel.
- Network is `studionet`; do not use testnet evidence or wording.
- Contract file line 1 is `# v0.2.16`, line 2 is the pinned `py-genlayer` Depends hash, line 3 is `from genlayer import *`.
- Contract source must be pure ASCII.
- One contract only unless a real independent state owner appears; none is justified for this primitive.
- Every value-receiving public entrypoint uses `@gl.public.write.payable`.
- Nondeterminism must live inside no-arg functions and use a validator comparing verdict meaning.
- Never print or commit secrets; `.env` remains ignored.

---

### Task 1: Project Scaffold And Specification

**Files:**
- Create: `.gitignore`, `.env.example`, `package.json`, `requirements-dev.txt`, `gltest.config.yaml`
- Create: `docs/README.md`
- Modify: `../docs/IDEA-REGISTRY.md`

**Interfaces:**
- Produces project layout consumed by all tasks.
- Produces spec sections for the contract and tests.

- [ ] Register `IDEA-008` with seven-part fingerprint, gate matrix, analogues, and source list.
- [ ] Create contract-only repo scaffold with `contracts/`, `tests/direct/`, `scripts/`, `docs/evidence/studionet/`.
- [ ] Write `docs/README.md` with no blank claim-to-code cells.
- [ ] Run `Test-Path frontend` and expect `False`.

### Task 2: Contract Core And Deterministic Guards

**Files:**
- Create: `contracts/ap2_mandate_settlement.py`
- Create: `tests/direct/conftest.py`
- Create: `tests/direct/test_mandate_state.py`
- Create: `tests/direct/test_static_contract.py`

**Interfaces:**
- Produces `open_mandate`, `accept_mandate`, views, storage structs, ID/date/hash/url validators.
- Tests call `direct_deploy("contracts/ap2_mandate_settlement.py")`.

- [ ] Write failing tests for open/accept, role authorization, invalid ID/date/hash/source URL, zero value, wrong escrow amount, entity isolation, and no frontend.
- [ ] Run `.\.venv\Scripts\python.exe -m pytest tests/direct/test_mandate_state.py tests/direct/test_static_contract.py -v`; expected failures before implementation.
- [ ] Implement storage structs `Mandate` and `Dispute`, helper validators, `open_mandate`, `accept_mandate`, and basic views.
- [ ] Rerun focused tests; expected pass.

### Task 3: Dispute, Consensus, And Settlement

**Files:**
- Modify: `contracts/ap2_mandate_settlement.py`
- Create: `tests/direct/test_dispute_accounting.py`
- Create: `tests/direct/test_adjudication.py`

**Interfaces:**
- Consumes `Mandate` storage and views from Task 2.
- Produces `open_dispute`, `adjudicate_dispute`, `withdraw_credit`, `get_accounting`, `can_open_dispute`.

- [ ] Write failing tests for claim bond, one active dispute, close/retry behavior, digest mismatch, AP2 source unavailable, malformed LLM JSON, prompt injection, malicious leader semantic mismatch, `AUTHORIZED`, `VIOLATION`, `UNVERIFIABLE`, withdrawals and debit-before-send.
- [ ] Run focused tests; expected failures before implementation.
- [ ] Implement commit-pinned evidence fetch, deterministic hash check, LLM prompt, result normalization, semantic validator fingerprint, settlement, credits, and withdrawal.
- [ ] Rerun focused tests; expected pass.

### Task 4: Tooling, Parser Fixtures, And Full Local Check

**Files:**
- Create: `scripts/check.ps1`
- Create: `scripts/ascii_header_check.py`
- Create: `scripts/deploy_studionet.mjs`
- Create: `docs/evidence/public-fixtures/ap2-authorized.json`
- Create: `docs/evidence/public-fixtures/ap2-violation.json`
- Create: `tests/deployment_parser.test.mjs`

**Interfaces:**
- Produces `npm run check`.
- Produces deploy parser helpers for raw and normalized Studio receipt shapes.

- [ ] Write parser fixture tests for success, error, missing result, raw Studio receipt, normalized receipt.
- [x] Implement parser helpers inside `scripts/deploy_studionet.mjs`.
- [x] Run `node --test tests/deployment_parser.test.mjs`; expected pass.
- [ ] Run ASCII/header check and pytest direct suite.
- [ ] Run `npm run check`; expected pass.

### Task 5: Deployment, Evidence, Public Git, Submission Packet

**Files:**
- Modify: `README.md`
- Modify/Create: `docs/evidence/studionet/deployment.json`
- Create: `docs/SUBMISSION.md`

**Interfaces:**
- Consumes tested contract and deployment script.
- Produces verified Studionet address, public repo URL, and copy-ready portal text.

- [x] Safely discover project `.env`, then parent `.env`, checking only presence.
- [x] Deploy to Studionet using the authorized wallet; verify `Result: SUCCESS`.
- [x] Execute one consequential lifecycle and canonical reads; save only allowlisted evidence.
- [x] Run public hygiene audit: `git rev-parse --show-toplevel`, `git status --short`, `git diff --check`, staged file list, `git ls-files`, secret/path scan.
- [x] Make meaningful commits, create/push public GitHub repo, verify URL.
- [x] Draft portal Title, Description under 1000 chars, and Evidence URL.

## Self-Review

- Spec coverage: all contract, evidence, test, deployment, public Git, and submission requirements map to tasks.
- Placeholder scan: no TBD/TODO/later placeholders are present.
- Type consistency: method names and project paths match the scaffold and planned tests.
