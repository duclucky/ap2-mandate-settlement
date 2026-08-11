# AP2 Mandate Settlement Bond

AP2 Mandate Settlement Bond is a standalone GenLayer Intelligent Contract for agentic-payment disputes. A user funds an AP2-backed escrow, a merchant accepts the mandate, and validators decide whether issuer-signed AP2 dispute evidence means the closed checkout and payment matched the user-authorized constraints.

This repository is for the **Intelligent Contracts** contribution track. It intentionally contains no frontend and no Vercel deployment.

## Public API

- `open_mandate(...)`: user funds a mandate escrow and locks AP2 source/version constraints plus the authorized issuer id/public key.
- `accept_mandate(mandate_id)`: merchant accepts the mandate terms.
- `open_dispute(...)`: user or merchant opens one active dispute with a claim bond and a commit-pinned signed evidence envelope.
- `adjudicate_dispute(mandate_id)`: validators fetch the evidence envelope, verify the issuer signature, then agree on the meaning of AP2 conformance.
- `withdraw_credit(amount)`: withdraw settled credit.
- Views: `get_mandate`, `get_dispute`, `get_status`, `get_credit`, `get_accounting`, `can_open_dispute`.

## Consensus

The validator checks meaning, not JSON format. Checkout/payment/receipt facts can drive settlement only after deterministic Ed25519 verification against the issuer id/key locked in the mandate. Consensus-critical fields are the verdict enum, AP2 source coverage, mismatch classes, critical field IDs, and consequence class. Rationale text is stored for explanation but is not used as the equality boundary.

## Local Verification

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
npm run check
```

## Deployment

Network: `studionet`.

v2 authenticity-remediated contract: `0xf95Dd8ff9849016A6d6EED976343b3d0FDD202AD`.

v2 source commit: `9ce0a67c2d57b886f7978949dfdace851af074fe`.

Lifecycle demo status: `open_mandate`, `accept_mandate`, and `open_dispute` finalized; `adjudicate_dispute` was submitted but finality/canonical settlement reads are pending because the default Studionet RPC returned `Rate limit exceeded: 500 requests per hour`.

Previous v1 contract, not resubmission-ready: `0xb5b7e9bb4f72F756E98ee3ecA4B121F15262D5F1`.

The demo dispute evidence is stored under `docs/evidence/public-fixtures/` as signed envelopes and must be reachable through a commit-pinned raw GitHub URL before the live dispute is opened.

```powershell
node scripts/deploy_studionet.mjs inspect
node scripts/deploy_studionet.mjs deploy
node scripts/deploy_studionet.mjs demo
```

Set `STUDIONET_RPC_URL` in ignored `.env` only when the default Studionet RPC is unavailable or rate-limited.

Deployment and lifecycle evidence are saved under `docs/evidence/studionet/deployment.json`.
