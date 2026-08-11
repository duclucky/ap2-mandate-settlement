# AP2 Mandate Settlement Bond Specification

## Identity

- Idea ID: `IDEA-008`
- Project name: AP2 Mandate Settlement Bond
- Project slug: `ap2-mandate-settlement`
- Category: Intelligent Contracts
- Status: V2_DEPLOYED_LIFECYCLE_PARTIAL
- Repository: `https://github.com/duclucky/ap2-mandate-settlement`
- Target network: studionet

## One-Sentence Product Hook

Settle agentic-payment disputes by paying the merchant only when AP2 evidence means the checkout and payment matched the user-authorized mandate.

## Trust Problem

- Decision that must not depend on one party: whether a charged autonomous-agent checkout conformed to the signed AP2 checkout/payment constraints.
- Why database/ordinary EVM/backend LLM is insufficient: a database or backend LLM can store and parse the evidence, but a disputed user and merchant would still trust one operator's interpretation before escrow moves.
- Value/rights/access at risk: native GEN escrow, dispute bond, merchant payout rights, and user refund rights.

## Fingerprint

- Trust problem: neutral adjudication of AP2 mandate conformance before value moves.
- Actors/adversary: user wants refunds for mismatches; merchant wants release for authorized checkouts; agent can be prompt-injected or faulty.
- Evidence class + authenticity mechanism: commit-pinned public AP2 dispute envelope plus deterministic Ed25519 verification of issuer-signed checkout/payment/receipt payloads.
- Consensus question: whether the closed checkout/payment meaning conforms to locked merchant, item, amount, currency, reference, and receipt linkage constraints.
- State machine: `DRAFT -> ACTIVE -> DISPUTE_OPEN -> RELEASED | REFUNDED`, with `UNVERIFIABLE` returning to `ACTIVE`.
- Direct consequence: release escrow to merchant, refund user, or refund only the dispute bond.
- Reuse surface: AP2 agents, x402 gateways, and agent marketplaces call typed writes/views without copying adjudication logic.

## Mandatory Gate Matrix

| Gate | PASS/FAIL | Evidence/reason |
| --- | --- | --- |
| Replacement | PASS | Replacing GenLayer with a backend preserves storage but loses neutral validator judgment before escrow settlement. |
| Judgment | PASS | Validators independently inspect AP2 evidence and decide semantic conformance; client cannot submit a verdict. |
| Evidence availability | PASS | AP2 spec and GitHub are public; dispute envelopes are bounded, commit-pinned, and SHA-256 checked. |
| Evidence authenticity | PASS - local remediation | Checkout/payment/receipt facts can drive settlement only after deterministic Ed25519 verification against the issuer id/key locked in the mandate. |
| Equivalence | PASS | Consensus-critical fields are verdict, source stage, mismatch classes, critical field IDs, and consequence class. |
| Consequence | PASS | Final verdict releases escrow, refunds escrow, or leaves escrow active. |
| Adversarial | PASS | User and merchant have opposed incentives over the same payment. |
| State model | PASS | Storage is isolated per mandate/dispute with one active dispute, attempt counts, credits, and double-settlement prevention. |
| Reuse | PASS | Consumers integrate with documented writes/views and do not need a frontend or second contract. |
| Contract count | PASS | One contract owns escrow, evidence policy, verdict, and credits; no independent consumer boundary exists. |
| Differentiation | PASS | Different from registered SEC/FDA/recall/interface/access/deliverable ideas on evidence, consensus question, and consequence. |
| Claim-to-code | PASS | Claims map below to methods, views, tests, and Studionet evidence. |
| Full lifecycle | PENDING - v2 network retry needed | v2 deploy, open mandate, accept, and open dispute finalized; adjudication was submitted but finality/canonical settlement reads are pending after default Studionet RPC rate limit. |
| Scope honesty | PASS | Portal submission stays pending until explicit authorization. |

## Actors, Roles And Incentives

| Actor | Permissions | Value at risk | Incentive to bias |
| --- | --- | --- | --- |
| User | Opens mandate, funds escrow, opens dispute, withdraws refund credit | Escrow amount and dispute bond | Claim mismatch to recover payment even if merchant complied |
| Merchant | Accepts mandate, opens dispute, withdraws release credit | Payout and dispute bond | Claim authorization even if checkout drifted from intent |
| Shopping agent | Reflected in AP2 evidence; no direct settlement authority | Reputation and future routing | Hide prompt-injection or execution errors |
| Validators | Fetch evidence and judge conformance | Consensus reward/slash outside this contract | Must agree on meaning, not format |

## Scope And Non-Goals

### In Scope

- One standalone Intelligent Contract.
- Native GEN escrow and dispute bond accounting.
- Public commit-pinned AP2 evidence envelopes.
- Deterministic Ed25519 verification of issuer-signed AP2 evidence payloads.
- Semantic AP2 conformance judgment.
- Direct tests and Studionet script lifecycle evidence.

### Out Of Scope

- No frontend, no Vercel, no browser wallet claims.
- No full SD-JWT cryptographic library implementation in GenVM; v2 verifies an Ed25519 issuer-signed AP2 evidence envelope as the settlement trust anchor.
- No legal chargeback replacement or card-network integration.
- No private evidence or credentialed APIs.

## Product/Frontend Blueprint

Not selected. This is an Intelligent Contracts submission and has no frontend.

## State Model

### Stable IDs

- `mandate_id`: 6-64 lowercase letters, digits, `-`, `_`.
- `dispute_id`: derived as `mandate_id + ":" + attempt`.
- `source_digest`: lowercase 64-character SHA-256 hex of the signed evidence envelope.
- `source_url`: `https://raw.githubusercontent.com/<org>/<repo>/<40-hex-commit>/<path>.json`.

### Structured Storage

- `Mandate`: user, merchant, allowed merchant domain, required item id, amount, currency, AP2 spec URL/hash, authorized issuer id/public key, escrow, status, active dispute id, close proposer.
- `Dispute`: mandate id, claimant, evidence URL/digest, status, verdict, source stage, consequence, mismatch classes, critical fields, rationale, settled flag.
- `credits`: str-keyed credit ledger by address.
- `attempt_counts`: append-only dispute attempt count by mandate.

### State Machine

```text
MISSING --open_mandate/user+value--> DRAFT
DRAFT --accept_mandate/merchant--> ACTIVE
ACTIVE --open_dispute/user_or_merchant+bond--> DISPUTE_OPEN
DISPUTE_OPEN --adjudicate/AUTHORIZED--> RELEASED
DISPUTE_OPEN --adjudicate/VIOLATION--> REFUNDED
DISPUTE_OPEN --adjudicate/UNVERIFIABLE--> ACTIVE
ACTIVE --bilateral_close/user_then_merchant_or_reverse--> CLOSED
```

### Illegal Transitions

- Accept by non-merchant.
- Open dispute before activation.
- Open second active dispute.
- Adjudicate settled or missing dispute.
- Withdraw more than credit.
- Close while dispute is open.

### Authorization

- `open_mandate`: any user, with merchant address argument and escrow value.
- `accept_mandate`: only merchant.
- `open_dispute`: user or merchant.
- `close_dispute`: claimant only, before adjudication.
- `propose_close`/`accept_close`: both mandate parties.
- `withdraw_credit`: credited account only.

### Idempotency And Double-Action Prevention

- One active dispute per mandate.
- Attempts are append-only and derive `dispute_id`.
- Settlement sets `settled=True` before any withdrawal path.
- Credits are debited before external transfer.

## Evidence Policy

- Authoritative sources: AP2 specification, AP2 GitHub repository, and the authorized issuer public key locked in each mandate.
- Provenance/authentication: claimant must be one mandate party; source URL is pinned to a 40-hex Git commit; source digest is locked onchain and checked after fetch; checkout/payment/receipt facts are used only after Ed25519 verification of the `signed_payload`.
- Authorized attestor/signer: `authorized_issuer_id` and `authorized_issuer_public_key` are locked in `open_mandate`; any mismatch or invalid signature is non-penalizing.
- Anti-replay event/digest identity: signed payload must bind `mandate_id`, `ap2_spec_hash`, and `transaction_date`; attempts remain append-only as `mandate_id + attempt`.
- Signed timestamp bounds: signed payload `transaction_date` must be within mandate activation/expiry windows.
- Immutable policy/source version URLs and hashes: `ap2_spec_url` and `ap2_spec_hash` are stored in each mandate.
- Allowed schemes/domains/paths: `https://raw.githubusercontent.com/.../<40-hex-commit>/...json` for dispute bundles; `https://ap2-protocol.org/...` or `https://raw.githubusercontent.com/google-agentic-commerce/AP2/...` for AP2 spec URL metadata.
- Time/window rules: activation date must be before expiry date; evidence `transaction_date` is judged against the locked mandate window.
- Size/count bounds: evidence response max 120000 chars; LLM critical field set max 12; rationale max 600 chars.
- Missing evidence: `UNVERIFIABLE`, refund dispute bond only.
- Contradictory evidence: `UNVERIFIABLE`, refund dispute bond only unless validators agree on a concrete mismatch.
- Unavailable source: `UNVERIFIABLE`, refund dispute bond only.
- Invalid/unverifiable attestation: `UNVERIFIABLE`; no escrow release/refund.
- Prompt-injection boundary: evidence text cannot expand allowed verdicts, mismatch classes, fields, payees, actions, or consequences.
- Private/unverifiable evidence excluded: any source requiring login, cookies, local files, or private APIs is invalid.

## Consensus Design

### Leader Task

- Inputs: mandate terms, evidence URL/digest, AP2 spec URL/hash, authorized issuer id/key, dispute ID.
- Fetch: web GET evidence envelope URL; reject non-200, digest mismatch, oversize, non-JSON.
- Authentication: verify envelope `signature_alg=ED25519`, issuer id/key match the mandate, signature validates over the exact `signed_payload`, and payload binds mandate id, AP2 spec hash, and transaction date.
- Extraction: parse the verified signed payload and ask LLM to classify AP2 conformance.
- Normalization: contract derives source stage, consequence, field bounds, allowed mismatch classes, and sorted critical field IDs.
- Structured output: `{verdict, source_stage, mismatch_classes, critical_fields, consequence_class, rationale}`.

### Consensus-Critical Fields

| Field | Type/bounds | Comparison rule | Why critical |
| --- | --- | --- | --- |
| `verdict` | `AUTHORIZED`, `VIOLATION`, `UNVERIFIABLE` | Exact enum match | Controls escrow movement |
| `source_stage` | `SUFFICIENT`, `FAILED`, `HASH_MISMATCH`, `MALFORMED` | Exact enum match | Determines whether evidence can penalize |
| `mismatch_classes` | Up to 8 allowed enums | Sorted set exact match | Identifies AP2 meaning of nonconformance |
| `critical_fields` | Up to 12 allowed field IDs | Sorted set exact match | Locks the evidence basis |
| `consequence_class` | `PAY_MERCHANT`, `REFUND_USER`, `REFUND_DISPUTE_BOND` | Exact enum match | Prevents format-only validators |

### Validator

- Independent evidence/replay: validator reruns the same fetch and prompt from locked inputs.
- Semantic rule: compare only the fingerprint of critical meaning fields; ignore rationale wording.
- Rejection conditions: non-Return leader result, invalid enum, oversized sets, digest mismatch disagreement, or different consequence.
- `UNDETERMINED` handling: no fake state is written by the contract; retry is a later dispute attempt after canonical state remains active.

### Rationale Policy

Rationale is capped and stored for explanation only. It is not consensus-critical.

## Consequence And Accounting

| Verdict | Canonical state change | Consumer action | Value movement |
| --- | --- | --- | --- |
| `AUTHORIZED` | `RELEASED` | Merchant/payment gateway may treat order as paid | Escrow plus dispute bond credited to merchant |
| `VIOLATION` | `REFUNDED` | User/payment gateway may treat order as unauthorized | Escrow plus dispute bond credited to user |
| `UNVERIFIABLE` | Back to `ACTIVE` | Parties may retry with better evidence | Dispute bond credited to claimant only |

- Accepted/finalized boundary: external withdrawals are emitted on `finalized`; hard consequence is represented in canonical contract state after adjudication consensus.
- Ledger invariant: locked escrow + locked dispute bonds + withdrawable credits equals received value minus finalized withdrawals.
- Child-message/transfer evidence: withdrawal script records safe receipt fields and balance delta when executed on Studionet.
- Withdrawal/settlement: credits are debited before `emit_transfer`.
- Cure/appeal/restore: no cure path in v1; `UNVERIFIABLE` supports retry with a new attempt.

## Reusable Interface

### Write Methods

- `open_mandate(mandate_id, merchant_address, allowed_merchant_domain, required_item_id, amount, currency, activation_date, expiry_date, ap2_spec_url, ap2_spec_hash, authorized_issuer_id, authorized_issuer_public_key, dispute_bond_amount)`
- `accept_mandate(mandate_id)`
- `open_dispute(mandate_id, evidence_url, evidence_digest)`
- `close_dispute(mandate_id)`
- `propose_close(mandate_id)`
- `accept_close(mandate_id)`
- `adjudicate_dispute(mandate_id)`
- `withdraw_credit(amount)`

### View Methods

- `get_mandate(mandate_id)`
- `get_dispute(mandate_id)`
- `get_status(mandate_id)`
- `get_credit(account)`
- `get_accounting()`
- `can_open_dispute(mandate_id)`

### Consumer/Callback

- Authentication: no callback consumer in v1.
- Idempotency key: consumers read `mandate_id`, `active_dispute_id`, and status.
- Failure/retry: consumers treat `ACTIVE` after `UNVERIFIABLE` as retryable.
- Authorized cancellation: bilateral close only.

## Threat Model

| Threat | Attack | Mitigation | Test |
| --- | --- | --- | --- |
| Fake source URL | Claimant points to mutable/private evidence | Commit-pinned raw GitHub URL and digest check | invalid URL/hash tests |
| Fabricated hash-valid facts | Mandate party publishes false JSON with a matching digest | Missing/invalid issuer signature -> `UNVERIFIABLE` | unsigned fabricated evidence test |
| Forged issuer signature | Mandate party changes signed payload or signature | Ed25519 verification -> `AUTH_FAILED`/`UNVERIFIABLE` | forged signature test |
| Replay/version mismatch | Valid signature is reused for a different mandate, AP2 version hash, or time window | Signed payload binding checks -> `UNVERIFIABLE` | wrong mandate/spec/timestamp tests |
| Prompt injection | Bundle says to ignore policy and pay attacker | Locked enums and normalizer discard unknown actions | prompt injection test |
| Format-only validation | Leader emits valid JSON with wrong verdict | Validator fingerprint compares meaning fields | malicious leader test |
| Double settlement | Same dispute adjudicated twice | `settled` flag and terminal mandate status | duplicate adjudication test |
| Unauthorized role | Stranger accepts/disputes/withdraws | Address checks and credits by sender | unauthorized tests |
| Oversized evidence | Huge bundle exceeds runtime bounds | Length cap -> `UNVERIFIABLE` | oversized source test |
| Digest mismatch | Commit URL content changed or wrong hash | SHA-256 check -> `HASH_MISMATCH` | digest mismatch test |

## Test Plan

- Happy path: open, accept, authorized settlement, merchant withdrawal.
- Unauthorized: non-merchant accept, stranger dispute, wrong withdrawal.
- Isolation: two mandates retain independent state.
- Evidence failure: bad URL, unavailable source, digest mismatch, malformed JSON, unsigned fabricated JSON, forged signature, wrong mandate/spec binding, stale/future timestamp.
- Malicious leader: valid shape with wrong meaning fails validator replay.
- Prompt injection: unknown verdict/action/facts cannot expand consequence.
- Semantic mismatch: item, merchant, amount, currency, reference, receipt linkage.
- Verdict classes: `AUTHORIZED`, `VIOLATION`, `UNVERIFIABLE`.
- Duplicate: one active dispute, no double adjudication, no double withdrawal.
- Accounting/value: escrow and bond credits; debit before external send.
- Cure/restore: not in v1; retry through `UNVERIFIABLE`.
- Consumer enforcement: canonical views for pull integration.
- Undetermined/retry: no state write beyond consensus; retryable state remains `ACTIVE`.

## Claim-To-Code Matrix

| Product claim | Contract method/state | View/read | Direct test | Network evidence |
| --- | --- | --- | --- | --- |
| User locks AP2 payment escrow | `open_mandate`, `Mandate.escrow_remaining` | `get_mandate`, `get_accounting` | `test_open_and_accept_mandate` | Studionet open tx + canonical read |
| Merchant must accept before disputes | `accept_mandate`, `status=ACTIVE` | `get_status` | `test_only_merchant_accepts` | Studionet accept tx |
| Evidence must be public and pinned | `open_dispute`, URL/digest guards | `get_dispute` | `test_dispute_guards_and_one_active_dispute` | Evidence envelope URL + hash |
| Evidence facts must be issuer-signed | `adjudicate_dispute`, Ed25519 verification | `get_dispute` | `test_fabricated_hash_valid_unsigned_evidence_is_unverifiable`, `test_forged_signature_is_unverifiable` | Local remediation; Studionet redeploy pending |
| Validators judge AP2 meaning | `adjudicate_dispute`, validator fingerprint | `get_dispute` | `test_malicious_leader_with_valid_shape_fails_semantic_replay` | Finalized adjudication tx |
| Authorized AP2 evidence pays merchant | `AUTHORIZED -> RELEASED`, merchant credit | `get_credit`, `get_status` | `test_authorized_verdict_releases_to_merchant` | Canonical credit and withdrawal evidence |
| Violating AP2 evidence refunds user | `VIOLATION -> REFUNDED`, user credit | `get_credit`, `get_status` | `test_violation_verdict_refunds_user` | Canonical refund evidence |
| Unverifiable evidence is non-penalizing | `UNVERIFIABLE -> ACTIVE`, claimant bond credit | `get_status`, `get_credit` | `test_unavailable_source_is_unverifiable` | Retryable state read |
| Withdrawals debit before transfer | `withdraw_credit` | `get_credit` | `test_withdrawal_debits_before_external_send` | Withdrawal tx + balance delta |

## Analogue And Differentiation Matrix

| Analogue/prior idea | Similar dimensions | Structural difference | Collision decision |
| --- | --- | --- | --- |
| TrustlessAgent | Escrow release/refund | Generic deliverable evidence vs AP2 mandate/payment conformance and receipt linkage | Not duplicate |
| AgentAccessBond | Agentic infrastructure and adversarial claims | Web access quarantine vs payment authorization settlement | Not duplicate |
| FilingTriggerCovenant | Official source text and payout | SEC filing trigger vs AP2 dispute evidence | Not duplicate |
| LabelScope Market | Semantic settlement of value | Pooled prediction market vs bilateral AP2 escrow | Not duplicate |
| Generic escrow | Bilateral settlement | Locked AP2 fields, official spec, semantic validator, no arbitrary winner question | Reject as analogue |

## Deployment And Evidence Plan

- Network: studionet.
- Last v1 Studionet contract: `0xb5b7e9bb4f72F756E98ee3ecA4B121F15262D5F1`.
- v2 Studionet contract: `0xf95Dd8ff9849016A6d6EED976343b3d0FDD202AD`.
- v2 source commit: `9ce0a67c2d57b886f7978949dfdace851af074fe`.
- v2 lifecycle status: deploy, `open_mandate`, `accept_mandate`, and `open_dispute` finalized; `adjudicate_dispute` submitted as `0x687ebe73adc7810538614344fe9656254ec879bdfb234cb2ac000a5f4a4dc726`, with finality/canonical reads pending after default Studionet RPC rate limit.
- Actors/wallet separation: user and merchant as separate public addresses; if a second EOA is required, ask before creating/funding it.
- Deploy steps: local check, deploy contract, verify `Result: SUCCESS`, save address/tx/source commit.
- Consequential lifecycle: open mandate with GEN escrow and locked issuer id/key, accept, open dispute with signed evidence envelope and bond, adjudicate `VIOLATION` or `AUTHORIZED`, withdraw credit.
- Canonical reads: mandate, dispute, accounting, credits before and after withdrawal.
- Balance/receipt proof: safe allowlist only: tx hash, status/result, address, value, public actor addresses, balance delta.
- Public dispute fixture path: `docs/evidence/public-fixtures/ap2-violation.json`, served through a raw GitHub URL pinned to the source commit.
- Evidence path: `docs/evidence/studionet/`.
- Resume/idempotency: deployment script reuses same-commit deployment evidence, archives superseded deployment evidence, and records submitted transactions so retries do not intentionally resubmit completed steps.
- Superseded revision: `dbd380510255c2a6767cb974dce7b747a085b66e` archived after `MAJORITY_DISAGREE` left adjudication pending.

## Definition Of Done

### Intelligent Contracts

- [x] Reusable primitive.
- [x] Semantic validator judgment.
- [x] Direct consequence.
- [x] Reuse proof through documented views.
- [x] Adversarial tests.
- [ ] Real network lifecycle final adjudication and withdrawal.
- [ ] Canonical settlement evidence.

### Projects, If Selected

Not selected.

## Honest Limitations

- No frontend or browser-wallet evidence by design.
- No legal/card-network claim.
- Full AP2 SD-JWT/JWS verification remains a future milestone. This remediation implements deterministic Ed25519 verification of issuer-signed AP2 evidence envelopes before checkout/payment/receipt facts can drive settlement.
- v2 final adjudication receipt and canonical settlement reads are pending after default Studionet RPC rate limit.
- Portal submission remains pending until explicit action-time authorization.

## Kill Criteria

- If validators only check JSON shape, reject.
- If source evidence cannot be fetched publicly and boundedly, reject.
- If settlement can be replaced by a backend without losing the trust property, reject.
- If AP2 evidence cannot be reduced to stable semantic fields, reject.
- If the repo gains a frontend, move category to Projects or remove it.
