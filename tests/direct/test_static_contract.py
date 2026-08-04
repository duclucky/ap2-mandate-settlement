from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "contracts" / "ap2_mandate_settlement.py"


def test_contract_file_exists():
    assert CONTRACT.exists()


def test_contract_is_ascii():
    data = CONTRACT.read_bytes()
    data.decode("ascii")


def test_contract_header_shape():
    lines = CONTRACT.read_text(encoding="ascii").splitlines()
    assert lines[0] == "# v0.2.16"
    assert lines[1].startswith('# { "Depends": "py-genlayer:')
    assert lines[2] == "from genlayer import *"


def test_no_frontend_directory():
    assert not (ROOT / "frontend").exists()
