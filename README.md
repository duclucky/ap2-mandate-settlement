# AP2 Mandate Settlement Bond

AP2 Mandate Settlement Bond is a standalone GenLayer Intelligent Contract for agentic-payment disputes. A user funds an AP2-backed escrow, a merchant accepts the mandate, and validators decide whether public AP2 dispute evidence means the closed checkout and payment matched the user-authorized constraints.

This repository is for the **Intelligent Contracts** contribution track. It intentionally contains no frontend and no Vercel deployment.

## Public API

- `open_mandate(...)`: user funds a mandate escrow and locks AP2 source/version constraints.
- `accept_mandate(mandate_id)`: merchant accepts the mandate terms.
- `open_dispute(...)`: user or merchant opens one active dispute with a claim bond and a commit-pinned evidence bundle.
- `adjudicate_dispute(mandate_id)`: validators fetch the evidence bundle and agree on the meaning of AP2 conformance.
- `withdraw_credit(amount)`: withdraw settled credit.
- Views: `get_mandate`, `get_dispute`, `get_status`, `get_credit`, `get_accounting`, `can_open_dispute`.

## Consensus

The validator checks meaning, not JSON format. Consensus-critical fields are the verdict enum, AP2 source coverage, mismatch classes, critical field IDs, and consequence class. Rationale text is stored for explanation but is not used as the equality boundary.

## Local Verification

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
npm run check
```

## Deployment

Network: `studionet`.

The demo dispute evidence is stored under `docs/evidence/public-fixtures/` and must be reachable through a commit-pinned raw GitHub URL before the live dispute is opened.

```powershell
node scripts/deploy_studionet.mjs inspect
node scripts/deploy_studionet.mjs deploy
node scripts/deploy_studionet.mjs demo
```

Set `STUDIONET_RPC_URL` in ignored `.env` only when the default Studionet RPC is unavailable or rate-limited.

Deployment evidence is pending until a real Studionet lifecycle is executed and saved under `docs/evidence/studionet/`.
