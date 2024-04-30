"""
Acceptance tests for the application requirements.
"""
import json
import os

import pytest

from cartesi.testclient import TestClient
from cartesi.abi import encode_model, get_abi_types_from_model, decode_to_model
from cartesi.models import ABIFunctionSelectorHeader

from cartesapp.manager import Manager
from cartesapp.utils import hex2bytes, str2bytes

from core.core_settings import generate_cartridge_id, generate_rule_id
from core.cartridge import InserCartridgePayload, CartridgeInfo, CartridgesOutput, RemoveCartridgePayload
from core.tape import VerifyPayload, VerificationOutput, RulePayload

import logging
logger = logging.getLogger(__name__)


###
# Setup tests variables

CARTRIDGE1 = 'antcopter'
CARTRIDGE2 = 'particles'
CARTRIDGE3 = 'snake'

with open(f"misc/{CARTRIDGE1}.sqfs", 'rb') as fin:
    CARTRIDGE1_DATA = fin.read()

CARTRIDGE1_ID = generate_cartridge_id(CARTRIDGE1_DATA)

with open(f"misc/{CARTRIDGE2}.sqfs", 'rb') as fin:
    CARTRIDGE2_DATA = fin.read()

CARTRIDGE2_ID = generate_cartridge_id(CARTRIDGE2_DATA)

with open(f"misc/{CARTRIDGE3}.sqfs", 'rb') as fin:
    CARTRIDGE3_DATA = fin.read()

CARTRIDGE3_ID = generate_cartridge_id(CARTRIDGE3_DATA)

# finished level 5
CARTRIDGE1_LOG1 = '0x010107045a00000063000000b8000000858384825588ab0ec25000c5767a2eec0197ec21c60424cbc49053235804210183e07bf875042068459326890010e6832501321642926c03fe6eac5f2d0b84cd9fc64e8a2b5339ae762ad8d6d570e85e7936cd659f3debf56862cc8bd8a76d75dc2062582a0f8174b1501144a3c7f9c49ca6f72e6b88a1d5863d1997db727803'
CARTRIDGE1_OUTHASH1 = '0x0a82193a55c985f71a9daf7f23181ed610ef241023eaac5f5657e8c4c23e87b7'

# died on level 2 without berries
CARTRIDGE1_LOG2 = '0x01010805c2000000a1000000a50000008584838281458dcb4e024114443955cd3cba87a165009108242446c5b81123262cddb940d77ebb1fe36220de9b4aa56a516730400092c00032081b5b9224fbd20bf77e36f0f92483c197b78ddd2f1a49bd008464bb6f113db9c74ac606230828887f2ac6e76c21c99618341fdae7b782b273c3babe5dfcea343dc4cfe8b038568f65aa1f625abf8e422007c8415c194d0c1d623b6bab18d3e1a9d0fedef3704deb25c9efa9b8a9779362f13cdbd4a73aa5a21d366135b47ecae5f7749d8aa66cab72b6ada237345e0d618e35a223918deec2177ad9e54e665cc0384859d0c964601be228a6eaf807'
CARTRIDGE1_OUTHASH2 = '0xb1053c9679853136f74fefe5b60072d0175085f496a5575ba8636dffad3c6811'

CARTRIDGE2_LOG1 = '0x01000504140000001b0000003e000000808281830000010202020103020003000001000201030203001505050a060611061b0f0201020a0b0b021405'
CARTRIDGE2_OUTHASH1 = '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

OUTHASH_BLANK = '0x' + '0'*64

USER2_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
USER3_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

@pytest.fixture(scope='session')
def dapp_client() -> TestClient:
    # set required environment 
    os.environ["OPERATOR_ADDRESS"] = USER2_ADDRESS
    # os.environ.get["RIVEMU_PATH"]
    os.environ["GENESIS_CARTRIDGES"] = ''

    # Mimics the run command to set up the manager
    m = Manager()
    m.add_module('core')
    m.setup_manager(reset_storage=True)
    client = TestClient(m.dapp)
    return client


###
# Cartridge Tests

@pytest.fixture()
def insert_error_cartridge_payload() -> bytes:

    model = InserCartridgePayload(
        data=b'\0' + CARTRIDGE1_DATA
    )

    return encode_model(model, packed=False)

def test_should_fail_insert_cartridge_error_data(
        dapp_client: TestClient,
        insert_error_cartridge_payload: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.insert_cartridge",
        argument_types=get_abi_types_from_model(InserCartridgePayload)
    ).to_bytes()

    hex_payload = '0x' + (header + insert_error_cartridge_payload).hex()
    dapp_client.send_advance(hex_payload=hex_payload)

    assert not dapp_client.rollup.status

    report = dapp_client.rollup.reports[-1]['data']['payload']
    report = bytes.fromhex(report[2:])
    report = report.decode('utf-8')

    assert report.startswith("Couldn't insert cartridge: Error getting info: FATAL ERROR: Can't find a valid SQUASHFS superblock")


@pytest.fixture()
def insert_cartridge1_payload() -> bytes:

    model = InserCartridgePayload(
        data=CARTRIDGE1_DATA
    )

    return encode_model(model, packed=False)

def test_should_insert_cartridge1(
        dapp_client: TestClient,
        insert_cartridge1_payload: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.insert_cartridge",
        argument_types=get_abi_types_from_model(InserCartridgePayload)
    ).to_bytes()

    hex_payload = '0x' + (header + insert_cartridge1_payload).hex()
    dapp_client.send_advance(hex_payload=hex_payload)

    assert dapp_client.rollup.status

@pytest.mark.order(after="test_should_insert_cartridge1")
def test_should_fail_insert_cartridge1_again(
        dapp_client: TestClient,
        insert_cartridge1_payload: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.insert_cartridge",
        argument_types=get_abi_types_from_model(InserCartridgePayload)
    ).to_bytes()

    hex_payload = '0x' + (header + insert_cartridge1_payload).hex()
    dapp_client.send_advance(hex_payload=hex_payload)

    assert not dapp_client.rollup.status

    report = dapp_client.rollup.reports[-1]['data']['payload']
    report = bytes.fromhex(report[2:])
    report = report.decode('utf-8')

    assert report == "Couldn't insert cartridge: Cartridge already exists"

@pytest.fixture()
def insert_cartridge2_payload() -> bytes:

    model = InserCartridgePayload(
        data=CARTRIDGE2_DATA
    )

    return encode_model(model, packed=False)

def test_should_insert_cartridge2(
        dapp_client: TestClient,
        insert_cartridge2_payload: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.insert_cartridge",
        argument_types=get_abi_types_from_model(InserCartridgePayload)
    ).to_bytes()

    hex_payload = '0x' + (header + insert_cartridge2_payload).hex()
    dapp_client.send_advance(hex_payload=hex_payload, msg_sender=USER2_ADDRESS)

    assert dapp_client.rollup.status

@pytest.fixture()
def insert_cartridge3_payload() -> bytes:

    model = InserCartridgePayload(
        data=CARTRIDGE3_DATA
    )

    return encode_model(model, packed=False)

def test_should_insert_cartridge3(
        dapp_client: TestClient,
        insert_cartridge3_payload: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.insert_cartridge",
        argument_types=get_abi_types_from_model(InserCartridgePayload)
    ).to_bytes()

    hex_payload = '0x' + (header + insert_cartridge3_payload).hex()
    dapp_client.send_advance(hex_payload=hex_payload, msg_sender=USER3_ADDRESS)

    assert dapp_client.rollup.status


@pytest.mark.order(after="test_should_insert_cartridge1")
def test_should_retrieve_cartridge1_info(dapp_client: TestClient):

    path = f"core/cartridge_info?id={CARTRIDGE1_ID}"
    inspect_payload = '0x' + path.encode('ascii').hex()
    dapp_client.send_inspect(hex_payload=inspect_payload)

    assert dapp_client.rollup.status

    report = dapp_client.rollup.reports[-1]['data']['payload']
    report = bytes.fromhex(report[2:])
    report = json.loads(report.decode('utf-8'))
    assert isinstance(report, dict)

    output = CartridgeInfo.parse_obj(report)

    assert output.name.lower() == CARTRIDGE1.lower()


@pytest.mark.order(before="test_should_remove_cartridge3",after=["test_should_insert_cartridge1","test_should_insert_cartridge2","test_should_insert_cartridge3"])
def test_should_retrieve_cartridges(dapp_client: TestClient):

    path = f"core/cartridges"
    inspect_payload = '0x' + path.encode('ascii').hex()
    dapp_client.send_inspect(hex_payload=inspect_payload)

    assert dapp_client.rollup.status

    report = dapp_client.rollup.reports[-1]['data']['payload']
    report = bytes.fromhex(report[2:])
    report = json.loads(report.decode('utf-8'))
    assert isinstance(report, dict)

    output = CartridgesOutput.parse_obj(report)

    assert output.total == 3



@pytest.fixture()
def remove_cartridge3_payload() -> bytes:

    model = RemoveCartridgePayload(
        id=hex2bytes(CARTRIDGE3_ID)
    )

    return encode_model(model, packed=False)

@pytest.mark.order(after="test_should_retrieve_cartridges")
def test_should_fail_to_remove_cartridge3(
        dapp_client: TestClient,
        remove_cartridge3_payload: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.remove_cartridge",
        argument_types=get_abi_types_from_model(RemoveCartridgePayload)
    ).to_bytes()

    hex_payload = '0x' + (header + remove_cartridge3_payload).hex()
    dapp_client.send_advance(hex_payload=hex_payload)

    assert not dapp_client.rollup.status

    report = dapp_client.rollup.reports[-1]['data']['payload']
    report = bytes.fromhex(report[2:])
    report = report.decode('utf-8')
    assert report == "Couldn't remove cartridge: Sender not allowed"


@pytest.mark.order(after="test_should_retrieve_cartridges")
def test_should_remove_cartridge3(
        dapp_client: TestClient,
        remove_cartridge3_payload: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.remove_cartridge",
        argument_types=get_abi_types_from_model(RemoveCartridgePayload)
    ).to_bytes()

    hex_payload = '0x' + (header + remove_cartridge3_payload).hex()
    dapp_client.send_advance(hex_payload=hex_payload, msg_sender=USER3_ADDRESS)

    assert dapp_client.rollup.status




###
# Verification Tests

@pytest.fixture()
def verify_tape_error_rule() -> bytes:

    model = VerifyPayload(
        rule_id=hex2bytes(generate_rule_id(hex2bytes(CARTRIDGE1_ID),str2bytes('random name'))),
        outcard_hash=hex2bytes(CARTRIDGE1_OUTHASH1),
        tape=CARTRIDGE1_LOG1,
        claimed_score=11516
    )

    return encode_model(model, packed=False)


@pytest.mark.order(after=["test_should_insert_cartridge1"])
def test_should_fail_verify_cartridge1_error_rule(
        dapp_client: TestClient,
        verify_tape_error_rule: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.verify",
        argument_types=get_abi_types_from_model(VerifyPayload)
    ).to_bytes()

    hex_payload = '0x' + (header + verify_tape_error_rule).hex()
    dapp_client.send_advance(hex_payload=hex_payload, msg_sender=USER2_ADDRESS)

    assert not dapp_client.rollup.status

    report = dapp_client.rollup.reports[-1]['data']['payload']
    report = bytes.fromhex(report[2:])
    report = report.decode('utf-8')
    assert report.startswith("rule") and report.endswith("doesn't exist")

@pytest.fixture()
def verify_tape_error_outhash() -> bytes:

    model = VerifyPayload(
        rule_id=hex2bytes(generate_rule_id(hex2bytes(CARTRIDGE1_ID),str2bytes('default'))),
        outcard_hash=hex2bytes(CARTRIDGE1_OUTHASH1)[:31]+b'\0',
        tape=hex2bytes(CARTRIDGE1_LOG1),
        claimed_score=11516
    )

    return encode_model(model, packed=False)


@pytest.mark.order(after=["test_should_insert_cartridge1"])
def test_should_fail_verify_cartridge1_error_outhash(
        dapp_client: TestClient,
        verify_tape_error_outhash: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.verify",
        argument_types=get_abi_types_from_model(VerifyPayload)
    ).to_bytes()

    hex_payload = '0x' + (header + verify_tape_error_outhash).hex()
    dapp_client.send_advance(hex_payload=hex_payload, msg_sender=USER2_ADDRESS)

    assert not dapp_client.rollup.status

    report = dapp_client.rollup.reports[-1]['data']['payload']
    report = bytes.fromhex(report[2:])
    report = report.decode('utf-8')
    assert report == "Out card hash doesn't match"



@pytest.fixture()
def verify_tape_error_score() -> bytes:

    model = VerifyPayload(
        rule_id=hex2bytes(generate_rule_id(hex2bytes(CARTRIDGE1_ID),str2bytes('default'))),
        outcard_hash=hex2bytes(CARTRIDGE1_OUTHASH1),
        tape=hex2bytes(CARTRIDGE1_LOG1),
        claimed_score=100000
    )

    return encode_model(model, packed=False)


@pytest.mark.order(after=["test_should_insert_cartridge1"])
def test_should_fail_verify_cartridge1_error_score(
        dapp_client: TestClient,
        verify_tape_error_score: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.verify",
        argument_types=get_abi_types_from_model(VerifyPayload)
    ).to_bytes()

    hex_payload = '0x' + (header + verify_tape_error_score).hex()
    dapp_client.send_advance(hex_payload=hex_payload, msg_sender=USER2_ADDRESS)

    assert not dapp_client.rollup.status

    report = dapp_client.rollup.reports[-1]['data']['payload']
    report = bytes.fromhex(report[2:])
    report = report.decode('utf-8')
    assert report == "Score doesn't match"

@pytest.fixture()
def verify_tape_cartridge1() -> bytes:

    model = VerifyPayload(
        rule_id=hex2bytes(generate_rule_id(hex2bytes(CARTRIDGE1_ID),str2bytes('default'))),
        outcard_hash=hex2bytes(CARTRIDGE1_OUTHASH1),
        tape=hex2bytes(CARTRIDGE1_LOG1),
        claimed_score=11516
    )

    return encode_model(model, packed=False)


@pytest.mark.order(after=["test_should_insert_cartridge1"])
def test_should_fail_user_verify_cartridge1(
        dapp_client: TestClient,
        verify_tape_cartridge1: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.verify",
        argument_types=get_abi_types_from_model(VerifyPayload)
    ).to_bytes()

    hex_payload = '0x' + (header + verify_tape_cartridge1).hex()
    dapp_client.send_advance(hex_payload=hex_payload, msg_sender=USER3_ADDRESS)

    assert not dapp_client.rollup.status

@pytest.mark.order(after=["test_should_insert_cartridge1"])
def test_should_pass_verify_cartridge1(
        dapp_client: TestClient,
        verify_tape_cartridge1: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.verify",
        argument_types=get_abi_types_from_model(VerifyPayload)
    ).to_bytes()

    hex_payload = '0x' + (header + verify_tape_cartridge1).hex()
    dapp_client.send_advance(hex_payload=hex_payload, msg_sender=USER2_ADDRESS)

    assert dapp_client.rollup.status

    notice = dapp_client.rollup.notices[-1]['data']['payload']
    notice = bytes.fromhex(notice[2:])
    notice = decode_to_model(model=VerificationOutput,data=notice)
    assert notice.score == 11516


@pytest.mark.order(after=["test_should_pass_verify_cartridge1"])
def test_should_fail_verify_duplicate(
        dapp_client: TestClient,
        verify_tape_cartridge1: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.verify",
        argument_types=get_abi_types_from_model(VerifyPayload)
    ).to_bytes()

    hex_payload = '0x' + (header + verify_tape_cartridge1).hex()
    dapp_client.send_advance(hex_payload=hex_payload, msg_sender=USER2_ADDRESS)

    assert not dapp_client.rollup.status

    report = dapp_client.rollup.reports[-1]['data']['payload']
    report = bytes.fromhex(report[2:])
    report = report.decode('utf-8')
    assert report == "Tape already submitted"

@pytest.fixture()
def verify_tape_cartridge2() -> bytes:

    model = VerifyPayload(
        rule_id=hex2bytes(generate_rule_id(hex2bytes(CARTRIDGE2_ID),str2bytes('default'))),
        outcard_hash=hex2bytes(CARTRIDGE2_OUTHASH1),
        tape=hex2bytes(CARTRIDGE2_LOG1),
        claimed_score=0
    )

    return encode_model(model, packed=False)


@pytest.mark.order(after=["test_should_insert_cartridge2"])
def test_should_pass_verify_cartridge2(
        dapp_client: TestClient,
        verify_tape_cartridge2: bytes):

    header = ABIFunctionSelectorHeader(
        function="core.verify",
        argument_types=get_abi_types_from_model(VerifyPayload)
    ).to_bytes()

    hex_payload = '0x' + (header + verify_tape_cartridge2).hex()
    dapp_client.send_advance(hex_payload=hex_payload, msg_sender=USER2_ADDRESS)

    assert dapp_client.rollup.status

    notice = dapp_client.rollup.notices[-1]['data']['payload']
    notice = bytes.fromhex(notice[2:])
    notice = decode_to_model(model=VerificationOutput,data=notice)
    assert notice.score == 0


###
# External Verification Tests

# TODO: test request external verification wrong rule
# TODO: test request external verification wrong cartridge
# TODO: test request external verification 1
# TODO: test request external verification 1 duplicate
# TODO: test request external verification 2
# TODO: test request external verification 3
# TODO: test external verification wrong sizes
# TODO: test external verification wrong rule
# TODO: test external verification wrong cartridge
# TODO: test external verification unsubmitted tape
# TODO: test external verification 1
# TODO: test external verification 2 and 3

###
# Rule Tests

# TODO: test rule creation wrong operator wallet
# TODO: test rule creation wrong formula
# TODO: test rule creation wrong args
# TODO: test rule creation invalid dates
# TODO: test rule creation
# TODO: test rule creation duplicate
# TODO: test rule creation duplicate name different game
# TODO: test list rules
# TODO: test tape verification non-standard rule correct
# TODO: test tape verification out of dates


# @pytest.fixture()
# def rives_antcopter_replay1_payload_wrong_outhash() -> bytes:

#     model = Replay(
#         cartridge_id    = bytes.fromhex(ANTCOPTER_ID),
#         outcard_hash    = bytes.fromhex('faca'*16),
#         args            = '',
#         in_card         = b'',
#         log             = bytes.fromhex(ANTCOPTER_LOG1[2:]),
#         user_alias      = ''
#     )

#     return encode_model(model, packed=False)

# def test_should_send_replay_wrong_outhash(
#         dapp_client: TestClient,
#         rives_antcopter_replay1_payload_wrong_outhash: bytes):

#     header = ABIFunctionSelectorHeader(
#         function="app.replay",
#         argument_types=get_abi_types_from_model(Replay)
#     ).to_bytes()

#     hex_payload = '0x' + (header + rives_antcopter_replay1_payload_wrong_outhash).hex()
#     dapp_client.send_advance(hex_payload=hex_payload)

#     assert not dapp_client.rollup.status

