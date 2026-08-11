# AP2 Evidence Authenticity Remediation Design

## Goal

Fix the reviewer-identified trust gap: claimant-selected GitHub JSON plus a
SHA-256 digest must not be enough to drive AP2 escrow settlement.

## Selected Approach

Use an issuer-signed evidence envelope. GitHub JSON remains a public,
commit-pinned transport so validators can refetch stable bytes, but checkout,
payment, and receipt facts affect settlement only after deterministic Ed25519
signature verification.

## Contract Changes

- `open_mandate` locks `authorized_issuer_id` and
  `authorized_issuer_public_key`.
- A dispute bundle must contain `signature_alg`, `issuer_id`,
  `issuer_public_key`, `signed_payload`, and `signature`.
- The contract verifies:
  - algorithm is `ED25519`;
  - issuer id and public key match the mandate;
  - signature verifies over the exact `signed_payload` bytes;
  - payload binds `mandate_id` and `ap2_spec_hash`;
  - payload `transaction_date` is inside the mandate activation/expiry window.
- Only the verified payload is used for deterministic mismatch extraction and
  validator semantic judgment.
- Missing, forged, replayed, stale/future, or version-mismatched evidence returns
  `UNVERIFIABLE` and only refunds the dispute bond.

## Non-Goals

- Full SD-JWT/JWS implementation is not included in this remediation.
- No private payment processor API or credentialed endpoint is introduced.
- GitHub commit/digest remains an immutability layer, not an authenticity layer.

## Required Tests

- Signed authorized evidence releases merchant.
- Signed violating evidence refunds user.
- Fabricated but hash-valid claimant JSON without a valid issuer signature is
  `UNVERIFIABLE`.
- Forged signature is `UNVERIFIABLE`.
- Wrong mandate id, wrong AP2 spec hash, and out-of-window timestamp are
  `UNVERIFIABLE`.
