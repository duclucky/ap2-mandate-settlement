import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverEnvPresence,
  extractExecutionResult,
  inferRawGithubUrl,
  summarizeReceipt,
} from "../scripts/deploy_studionet.mjs";

test("extractExecutionResult reads normalized SDK receipt", () => {
  const receipt = {
    status: "FINALIZED",
    execution_result: {
      result: "SUCCESS",
      return_data: { contract_address: "0xabc" },
    },
  };

  assert.deepEqual(extractExecutionResult(receipt), {
    result: "SUCCESS",
    error: "",
    returnData: { contract_address: "0xabc" },
  });
});

test("extractExecutionResult reads raw Studio leader receipt", () => {
  const receipt = {
    consensus_data: {
      leader_receipt: [
        {
          execution_result: {
            result: "ERROR",
            error: "schema load failed",
          },
        },
      ],
    },
  };

  assert.deepEqual(extractExecutionResult(receipt), {
    result: "ERROR",
    error: "schema load failed",
    returnData: null,
  });
});

test("extractExecutionResult handles missing execution result", () => {
  assert.deepEqual(extractExecutionResult({ status: "FINALIZED" }), {
    result: "UNKNOWN",
    error: "execution result missing",
    returnData: null,
  });
});

test("summarizeReceipt projects safe allowlisted fields", () => {
  const receipt = {
    hash: "0x123",
    status: "FINALIZED",
    from: "0xuser",
    to: "0xcontract",
    node_config: { private_key: "must-not-leak" },
    execution_result: { result: "SUCCESS", return_data: "0xabc" },
  };

  assert.deepEqual(summarizeReceipt(receipt), {
    hash: "0x123",
    status: "FINALIZED",
    from: "0xuser",
    to: "0xcontract",
    execution: {
      result: "SUCCESS",
      error: "",
      returnData: "0xabc",
    },
  });
});

test("discoverEnvPresence recognizes workspace Studionet key names without exposing values", () => {
  const presence = discoverEnvPresence(
    "STUDIONET_PRIVATE_KEY=dummy-primary\n",
    "STUDIONET_INTEGRATOR_PRIVATE_KEY=dummy-merchant\nSTUDIONET_RPC_URL=https://rpc.example\n"
  );

  assert.equal(presence.hasPrimaryPrivateKey, true);
  assert.equal(presence.hasMerchantPrivateKey, true);
  assert.equal(presence.hasCustomRpcUrl, true);
  assert.deepEqual(presence.checkedPrimaryVariables, [
    "GENLAYER_PRIVATE_KEY",
    "STUDIONET_PRIVATE_KEY",
    "PRIVATE_KEY",
  ]);
});

test("inferRawGithubUrl requires a 40 character commit and GitHub remote", () => {
  const commit = "0123456789abcdef0123456789abcdef01234567";

  assert.equal(
    inferRawGithubUrl("https://github.com/acme/ap2-mandate-settlement.git", commit),
    `https://raw.githubusercontent.com/acme/ap2-mandate-settlement/${commit}/docs/evidence/public-fixtures/ap2-violation.json`
  );
  assert.equal(inferRawGithubUrl("https://example.com/acme/repo.git", commit), null);
  assert.equal(inferRawGithubUrl("https://github.com/acme/repo.git", "main"), null);
});
