# Submission Draft

## Category

Intelligent Contracts

## Title

AP2 Mandate Settlement Bond

## Repository

https://github.com/duclucky/ap2-mandate-settlement

## Primary Contract

- Network: studionet
- v2 address: pending redeploy after evidence-authenticity remediation
- v1 address, not resubmission-ready: `0xb5b7e9bb4f72F756E98ee3ecA4B121F15262D5F1`
- v2 source commit: pending

## Evidence

- v2 lifecycle evidence: pending redeploy
- Public signed dispute envelope: `docs/evidence/public-fixtures/ap2-violation.json`
- Superseded diagnostic archive: `docs/evidence/studionet/archive/`
- v2 CI: pending

## Counts

- Contracts: 1
- Frontend: 0
- Direct tests: 47 local passing
- Deployment parser tests: 7

## Description

AP2 Mandate Settlement Bond is a reusable GenLayer Intelligent Contract for agentic-payment disputes. A user funds a mandate escrow with an authorized issuer id/public key, a merchant accepts it, and either party can open a dispute with a commit-pinned public AP2 evidence envelope plus SHA-256 digest. Validators independently fetch the envelope, deterministically verify the Ed25519 issuer signature over the signed checkout/payment/receipt payload, then judge whether the verified AP2 facts conform to the locked merchant, item, amount, currency, payment reference, and receipt-linkage constraints. A finalized AUTHORIZED verdict releases escrow to the merchant, a VIOLATION verdict refunds the user, and UNVERIFIABLE refunds only the dispute bond so parties can retry with better evidence. The public interface is contract-only: writes and views let AP2 agents, gateways, and marketplaces integrate settlement without copying the adjudication logic or trusting a backend verdict.

## Honest Limits

- No frontend or browser-wallet evidence by design.
- Full AP2 SD-JWT/JWS verification remains a future milestone; v2 verifies issuer-signed Ed25519 evidence envelopes before facts can drive settlement.
- v2 Studionet deployment, lifecycle evidence, CI URL, and source commit are pending.
- Portal submission is not submitted yet; final Submit still requires explicit action-time authorization.
