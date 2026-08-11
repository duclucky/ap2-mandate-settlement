import hashlib
import json


Q = 2**255 - 19
L = 2**252 + 27742317777372353535851937790883648493


def _inv(x):
    return pow(x, Q - 2, Q)


D = (-121665 * _inv(121666)) % Q
I = pow(2, (Q - 1) // 4, Q)


def _xrecover(y):
    xx = (y * y - 1) * _inv(D * y * y + 1)
    x = pow(xx, (Q + 3) // 8, Q)
    if (x * x - xx) % Q != 0:
        x = (x * I) % Q
    if x % 2 != 0:
        x = Q - x
    return x


BY = (4 * _inv(5)) % Q
B = (_xrecover(BY), BY)


def _edwards_add(p, q):
    x1, y1 = p
    x2, y2 = q
    denom = D * x1 * x2 * y1 * y2
    x3 = (x1 * y2 + x2 * y1) * _inv(1 + denom)
    y3 = (y1 * y2 + x1 * x2) * _inv(1 - denom)
    return (x3 % Q, y3 % Q)


def _scalarmult(p, e):
    q = (0, 1)
    while e > 0:
        if e & 1:
            q = _edwards_add(q, p)
        p = _edwards_add(p, p)
        e >>= 1
    return q


def _encode_point(p):
    x, y = p
    encoded = bytearray(y.to_bytes(32, "little"))
    encoded[31] |= (x & 1) << 7
    return bytes(encoded)


def _hint(data):
    return int.from_bytes(hashlib.sha512(data).digest(), "little")


def _secret_expand(seed):
    digest = hashlib.sha512(seed).digest()
    scalar = bytearray(digest[:32])
    scalar[0] &= 248
    scalar[31] &= 63
    scalar[31] |= 64
    return int.from_bytes(scalar, "little"), digest[32:]


def _public_key(seed):
    scalar, _ = _secret_expand(seed)
    return _encode_point(_scalarmult(B, scalar))


def _sign(seed, message):
    scalar, prefix = _secret_expand(seed)
    public_key = _public_key(seed)
    r = _hint(prefix + message) % L
    encoded_r = _encode_point(_scalarmult(B, r))
    h = _hint(encoded_r + public_key + message) % L
    s = (r + h * scalar) % L
    return encoded_r + s.to_bytes(32, "little")


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


ISSUER_ID = "ap2-demo-issuer"
ISSUER_SEED = bytes.fromhex("1f" * 32)
ISSUER_PUBLIC_KEY = _public_key(ISSUER_SEED).hex()


def signed_bundle(payload, *, seed=ISSUER_SEED, issuer_id=ISSUER_ID, signature=None):
    signed_payload = canonical_json(payload)
    public_key = _public_key(seed).hex()
    sig = signature if signature is not None else _sign(seed, signed_payload.encode("utf-8")).hex()
    return canonical_json(
        {
            "signature_alg": "ED25519",
            "issuer_id": issuer_id,
            "issuer_public_key": public_key,
            "signed_payload": signed_payload,
            "signature": sig,
        }
    )
