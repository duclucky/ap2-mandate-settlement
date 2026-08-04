import pytest

from tests.direct.conftest import to_hex


CONTRACT_PATH = "contracts/ap2_mandate_settlement.py"
ESCROW = 10_000
DISPUTE_BOND = 500
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
AP2_SPEC_URL = "https://ap2-protocol.org/ap2/specification/"
AP2_SPEC_HASH = "a" * 64


def open_valid_mandate(contract, vm, user, merchant, mandate_id="ap2-001"):
    vm.sender = user
    vm.value = ESCROW
    contract.open_mandate(
        mandate_id,
        to_hex(merchant),
        "demo-merchant.example",
        "supershoe_limited_edition_gold_sneaker_womens_9_0",
        ESCROW,
        "USD",
        "2026-01-01",
        "2026-12-31",
        AP2_SPEC_URL,
        AP2_SPEC_HASH,
        DISPUTE_BOND,
    )
    contract_address = vm._contract_address
    current_balance = vm._balances.get(bytes(contract_address), 0)
    vm.deal(contract_address, current_balance + ESCROW)
    vm.value = 0


def activate_mandate(contract, vm, user, merchant, mandate_id="ap2-001"):
    open_valid_mandate(contract, vm, user, merchant, mandate_id)
    vm.sender = merchant
    contract.accept_mandate(mandate_id)


def test_open_and_accept_mandate(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    open_valid_mandate(contract, direct_vm, direct_alice, direct_bob)

    mandate = contract.get_mandate("ap2-001")
    accounting = contract.get_accounting()
    assert contract.get_status("ap2-001") == "DRAFT"
    assert mandate.user.as_hex == to_hex(direct_alice)
    assert mandate.merchant.as_hex == to_hex(direct_bob)
    assert mandate.allowed_merchant_domain == "demo-merchant.example"
    assert mandate.required_item_id == "supershoe_limited_edition_gold_sneaker_womens_9_0"
    assert int(mandate.escrow_remaining) == ESCROW
    assert int(accounting["locked_escrow"]) == ESCROW

    direct_vm.sender = direct_bob
    contract.accept_mandate("ap2-001")
    assert contract.get_status("ap2-001") == "ACTIVE"
    assert contract.can_open_dispute("ap2-001") is True


def test_only_merchant_accepts(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    open_valid_mandate(contract, direct_vm, direct_alice, direct_bob)

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only merchant can accept mandate"):
        contract.accept_mandate("ap2-001")


def test_mandates_are_isolated(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy(CONTRACT_PATH)
    open_valid_mandate(contract, direct_vm, direct_alice, direct_bob, "ap2-001")
    open_valid_mandate(contract, direct_vm, direct_charlie, direct_bob, "ap2-002")

    assert contract.get_mandate("ap2-001").user.as_hex == to_hex(direct_alice)
    assert contract.get_mandate("ap2-002").user.as_hex == to_hex(direct_charlie)
    assert contract.get_status("ap2-001") == "DRAFT"
    assert contract.get_status("ap2-002") == "DRAFT"


@pytest.mark.parametrize("mandate_id", ["", "abc", "contains space", "bad:colon", "x" * 65])
def test_invalid_mandate_id_is_rejected(mandate_id, direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    direct_vm.value = ESCROW
    with direct_vm.expect_revert("Mandate ID"):
        contract.open_mandate(
            mandate_id,
            to_hex(direct_bob),
            "demo-merchant.example",
            "sku-1",
            ESCROW,
            "USD",
            "2026-01-01",
            "2026-12-31",
            AP2_SPEC_URL,
            AP2_SPEC_HASH,
            DISPUTE_BOND,
        )


@pytest.mark.parametrize(
    ("merchant", "domain", "item", "amount", "currency", "start", "end", "spec_url", "spec_hash", "bond", "value", "message"),
    [
        (ZERO_ADDRESS, "demo-merchant.example", "sku-1", ESCROW, "USD", "2026-01-01", "2026-12-31", AP2_SPEC_URL, AP2_SPEC_HASH, DISPUTE_BOND, ESCROW, "Merchant cannot be zero address"),
        ("MERCHANT", "", "sku-1", ESCROW, "USD", "2026-01-01", "2026-12-31", AP2_SPEC_URL, AP2_SPEC_HASH, DISPUTE_BOND, ESCROW, "Merchant domain"),
        ("MERCHANT", "demo-merchant.example", "", ESCROW, "USD", "2026-01-01", "2026-12-31", AP2_SPEC_URL, AP2_SPEC_HASH, DISPUTE_BOND, ESCROW, "Item ID"),
        ("MERCHANT", "demo-merchant.example", "sku-1", 0, "USD", "2026-01-01", "2026-12-31", AP2_SPEC_URL, AP2_SPEC_HASH, DISPUTE_BOND, ESCROW, "Amount must be positive"),
        ("MERCHANT", "demo-merchant.example", "sku-1", ESCROW, "US", "2026-01-01", "2026-12-31", AP2_SPEC_URL, AP2_SPEC_HASH, DISPUTE_BOND, ESCROW, "Currency"),
        ("MERCHANT", "demo-merchant.example", "sku-1", ESCROW, "USD", "2026-1-01", "2026-12-31", AP2_SPEC_URL, AP2_SPEC_HASH, DISPUTE_BOND, ESCROW, "Date"),
        ("MERCHANT", "demo-merchant.example", "sku-1", ESCROW, "USD", "2027-01-01", "2026-12-31", AP2_SPEC_URL, AP2_SPEC_HASH, DISPUTE_BOND, ESCROW, "Expiry"),
        ("MERCHANT", "demo-merchant.example", "sku-1", ESCROW, "USD", "2026-01-01", "2026-12-31", "https://example.com/spec", AP2_SPEC_HASH, DISPUTE_BOND, ESCROW, "AP2 spec URL"),
        ("MERCHANT", "demo-merchant.example", "sku-1", ESCROW, "USD", "2026-01-01", "2026-12-31", AP2_SPEC_URL, "bad", DISPUTE_BOND, ESCROW, "AP2 spec hash"),
        ("MERCHANT", "demo-merchant.example", "sku-1", ESCROW, "USD", "2026-01-01", "2026-12-31", AP2_SPEC_URL, AP2_SPEC_HASH, 0, ESCROW, "Dispute bond"),
        ("MERCHANT", "demo-merchant.example", "sku-1", ESCROW, "USD", "2026-01-01", "2026-12-31", AP2_SPEC_URL, AP2_SPEC_HASH, DISPUTE_BOND, ESCROW - 1, "Escrow value"),
    ],
)
def test_mandate_guards(
    merchant,
    domain,
    item,
    amount,
    currency,
    start,
    end,
    spec_url,
    spec_hash,
    bond,
    value,
    message,
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = direct_deploy(CONTRACT_PATH)
    merchant_arg = to_hex(direct_bob) if merchant == "MERCHANT" else merchant
    direct_vm.sender = direct_alice
    direct_vm.value = value
    with direct_vm.expect_revert(message):
        contract.open_mandate(
            "ap2-001",
            merchant_arg,
            domain,
            item,
            amount,
            currency,
            start,
            end,
            spec_url,
            spec_hash,
            bond,
        )


def test_duplicate_mandate_id_is_rejected(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    open_valid_mandate(contract, direct_vm, direct_alice, direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = ESCROW
    with direct_vm.expect_revert("Mandate already exists"):
        contract.open_mandate(
            "ap2-001",
            to_hex(direct_bob),
            "demo-merchant.example",
            "sku-1",
            ESCROW,
            "USD",
            "2026-01-01",
            "2026-12-31",
            AP2_SPEC_URL,
            AP2_SPEC_HASH,
            DISPUTE_BOND,
        )
