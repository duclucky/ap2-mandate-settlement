import hashlib

from tests.direct.conftest import to_hex
from tests.direct.test_mandate_state import (
    CONTRACT_PATH,
    DISPUTE_BOND,
    ESCROW,
    activate_mandate,
)


VALID_EVIDENCE_URL = (
    "https://raw.githubusercontent.com/example/ap2-evidence/"
    "0123456789abcdef0123456789abcdef01234567/bundles/ap2-authorized.json"
)
VALID_DIGEST = hashlib.sha256(b"valid-ap2-evidence").hexdigest()


def open_valid_dispute(contract, vm, user, merchant, claimant=None, evidence_digest=VALID_DIGEST):
    activate_mandate(contract, vm, user, merchant)
    vm.sender = claimant if claimant is not None else user
    vm.value = DISPUTE_BOND
    contract.open_dispute("ap2-001", VALID_EVIDENCE_URL, evidence_digest)
    contract_address = vm._contract_address
    current_balance = vm._balances.get(bytes(contract_address), 0)
    vm.deal(contract_address, current_balance + DISPUTE_BOND)
    vm.value = 0


def test_user_or_merchant_opens_dispute_with_bond(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    open_valid_dispute(contract, direct_vm, direct_alice, direct_bob)

    dispute = contract.get_dispute("ap2-001")
    accounting = contract.get_accounting()
    assert contract.get_status("ap2-001") == "DISPUTE_OPEN"
    assert dispute.mandate_id == "ap2-001"
    assert dispute.claimant.as_hex == to_hex(direct_alice)
    assert dispute.evidence_url == VALID_EVIDENCE_URL
    assert dispute.status == "OPEN"
    assert int(accounting["locked_escrow"]) == ESCROW
    assert int(accounting["locked_dispute_bonds"]) == DISPUTE_BOND


def test_only_mandate_parties_can_open_dispute(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    activate_mandate(contract, direct_vm, direct_alice, direct_bob)

    direct_vm.sender = direct_charlie
    direct_vm.value = DISPUTE_BOND
    with direct_vm.expect_revert("Only mandate parties can open dispute"):
        contract.open_dispute("ap2-001", VALID_EVIDENCE_URL, VALID_DIGEST)


def test_dispute_guards_and_one_active_dispute(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    activate_mandate(contract, direct_vm, direct_alice, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = DISPUTE_BOND - 1
    with direct_vm.expect_revert("Dispute bond value"):
        contract.open_dispute("ap2-001", VALID_EVIDENCE_URL, VALID_DIGEST)

    direct_vm.value = DISPUTE_BOND
    with direct_vm.expect_revert("Evidence URL"):
        contract.open_dispute("ap2-001", "https://example.com/evidence.json", VALID_DIGEST)

    with direct_vm.expect_revert("Evidence digest"):
        contract.open_dispute("ap2-001", VALID_EVIDENCE_URL, "bad")

    contract.open_dispute("ap2-001", VALID_EVIDENCE_URL, VALID_DIGEST)
    with direct_vm.expect_revert("Mandate already has an active dispute"):
        contract.open_dispute("ap2-001", VALID_EVIDENCE_URL, VALID_DIGEST)


def test_close_dispute_refunds_bond_and_restores_active(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    open_valid_dispute(contract, direct_vm, direct_alice, direct_bob)

    direct_vm.sender = direct_alice
    contract.close_dispute("ap2-001")

    dispute = contract.get_dispute("ap2-001")
    assert dispute.status == "CLOSED"
    assert dispute.settled is True
    assert contract.get_status("ap2-001") == "ACTIVE"
    assert int(contract.get_credit(to_hex(direct_alice))) == DISPUTE_BOND
    accounting = contract.get_accounting()
    assert int(accounting["locked_escrow"]) == ESCROW
    assert int(accounting["locked_dispute_bonds"]) == 0
    assert int(accounting["withdrawable_credits"]) == DISPUTE_BOND


def test_bilateral_close_refunds_user_escrow(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    activate_mandate(contract, direct_vm, direct_alice, direct_bob)

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only mandate parties can propose close"):
        contract.propose_close("ap2-001")

    direct_vm.sender = direct_alice
    contract.propose_close("ap2-001")
    with direct_vm.expect_revert("Opposite party must accept close"):
        contract.accept_close("ap2-001")

    direct_vm.sender = direct_bob
    contract.accept_close("ap2-001")

    assert contract.get_status("ap2-001") == "CLOSED"
    assert int(contract.get_credit(to_hex(direct_alice))) == ESCROW
    accounting = contract.get_accounting()
    assert int(accounting["locked_escrow"]) == 0
    assert int(accounting["locked_dispute_bonds"]) == 0
    assert int(accounting["withdrawable_credits"]) == ESCROW


def test_bilateral_close_is_blocked_during_dispute(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    open_valid_dispute(contract, direct_vm, direct_alice, direct_bob)

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Open dispute blocks close"):
        contract.propose_close("ap2-001")


def test_withdrawal_debits_before_external_send(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    open_valid_dispute(contract, direct_vm, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    contract.close_dispute("ap2-001")

    sends = []

    def capture_send(_vm, request):
        if "PostMessage" in request:
            sends.append(request["PostMessage"])
            assert int(contract.get_credit(to_hex(direct_alice))) == DISPUTE_BOND - 40
            contract_address = _vm._contract_address
            current_balance = _vm._balances.get(bytes(contract_address), 0)
            _vm.deal(contract_address, current_balance - int(request["PostMessage"]["value"]))
            return {"ok": None}
        return None

    direct_vm._gl_call_hook = capture_send
    contract.withdraw_credit(40)

    assert len(sends) == 1
    assert int(sends[0]["value"]) == 40
    assert sends[0]["address"].as_hex == to_hex(direct_alice)
    assert sends[0]["on"] == "finalized"
    assert int(contract.get_credit(to_hex(direct_alice))) == DISPUTE_BOND - 40
    with direct_vm.expect_revert("Insufficient credit"):
        contract.withdraw_credit(DISPUTE_BOND)
    with direct_vm.expect_revert("Withdrawal amount must be positive"):
        contract.withdraw_credit(0)
