# Submission Draft

## Category

Intelligent Contracts

## Title

AP2 Mandate Settlement Bond

## Repository

https://github.com/duclucky/ap2-mandate-settlement

## Primary Contract

- Network: studionet
- Address: `0xD5c88F2e88CEF57A19945c40a64c74F7f3e1093F`
- Explorer: https://explorer-studio.genlayer.com/address/0xD5c88F2e88CEF57A19945c40a64c74F7f3e1093F
- Source commit: `b7c9eb0d9c83f0f4114b1066933cc27fba5b3d2e`

## Evidence

- Lifecycle evidence: `docs/evidence/studionet/deployment.json`
- Public dispute bundle: `docs/evidence/public-fixtures/ap2-violation.json`
- Superseded diagnostic archive: `docs/evidence/studionet/archive/`

## Counts

- Contracts: 1
- Frontend: 0
- Direct tests: 39
- Deployment parser tests: 7

## Description

AP2 Mandate Settlement Bond is a reusable GenLayer Intelligent Contract for agentic-payment disputes. A user funds a mandate escrow, a merchant accepts it, and either party can open a dispute with a commit-pinned public AP2 evidence bundle plus SHA-256 digest. Validators independently fetch the bundle and judge whether the checkout/payment conformed to the locked merchant, item, amount, currency, payment reference, and receipt-linkage constraints. A finalized AUTHORIZED verdict releases escrow to the merchant, a VIOLATION verdict refunds the user, and UNVERIFIABLE refunds only the dispute bond so parties can retry with better evidence. The public interface is contract-only: writes and views let AP2 agents, gateways, and marketplaces integrate settlement without copying the adjudication logic or trusting a backend verdict.

## Honest Limits

- No frontend or browser-wallet evidence by design.
- No full SD-JWT cryptographic verification library in GenVM; AP2 signature semantics are bounded validator judgment in v1.
- CI link is pending; do not submit until CI is available or the portal accepts local plus Studionet evidence.
