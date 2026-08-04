from pathlib import Path


contract = Path("contracts/ap2_mandate_settlement.py")
data = contract.read_bytes()
data.decode("ascii")
lines = contract.read_text(encoding="ascii").splitlines()
assert lines[0] == "# v0.2.16", "line 1 must be Studio version pragma"
assert lines[1].startswith('# { "Depends": "py-genlayer:'), "line 2 must be Depends"
assert lines[2] == "from genlayer import *", "line 3 must be from genlayer import *"
print("ASCII/header check passed")
