import fs from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const PRIMARY_KEY_VARIABLES = Object.freeze([
  "GENLAYER_PRIVATE_KEY",
  "STUDIONET_PRIVATE_KEY",
  "PRIVATE_KEY",
]);
export const MERCHANT_KEY_VARIABLES = Object.freeze([
  "STUDIONET_MERCHANT_PRIVATE_KEY",
  "STUDIONET_INTEGRATOR_PRIVATE_KEY",
  "STUDIONET_USER_PRIVATE_KEY",
]);

const CONTRACT_PATH = path.resolve("contracts", "ap2_mandate_settlement.py");
const EVIDENCE_PATH = path.resolve("docs", "evidence", "studionet", "deployment.json");
const PUBLIC_FIXTURE_PATH = "docs/evidence/public-fixtures/ap2-violation.json";
const AP2_SPEC_URL = "https://raw.githubusercontent.com/google-agentic-commerce/AP2/main/docs/ap2/specification.md";
const EXPLORER_URL = "https://explorer-studio.genlayer.com";
const DEFAULT_RPC_URL = studionet.rpcUrls.default.http[0];
const MANDATE_ID = "ap2-001";
const ESCROW_WEI = 10_000_000_000_000_000n;
const DISPUTE_BOND_WEI = 1_000_000_000_000_000n;
const TERMINAL_FAILURES = new Set([
  "UNDETERMINED",
  "CANCELED",
  "LEADER_TIMEOUT",
  "VALIDATORS_TIMEOUT",
]);
const CONSENSUS_FAILURE_RESULTS = new Set([
  "MAJORITY_DISAGREE",
  "UNDETERMINED",
  "CANCELED",
  "LEADER_TIMEOUT",
  "VALIDATORS_TIMEOUT",
]);

export function extractExecutionResult(receipt) {
  const normalized = receipt?.execution_result ?? receipt?.executionResult;
  const rawLeader = receipt?.consensus_data?.leader_receipt;
  const raw = Array.isArray(rawLeader) && rawLeader.length > 0
    ? rawLeader[0]?.execution_result
    : null;
  const selected = normalized ?? raw;
  if (!selected) {
    return {
      result: "UNKNOWN",
      error: "execution result missing",
      returnData: null,
    };
  }
  return {
    result: String(selected.result ?? selected.status ?? "UNKNOWN"),
    error: String(selected.error ?? selected.message ?? ""),
    returnData: selected.return_data ?? selected.returnData ?? null,
  };
}

export function summarizeReceipt(receipt) {
  return {
    hash: receipt?.hash ?? receipt?.transactionHash ?? "",
    status: receipt?.status ?? "",
    from: receipt?.from ?? "",
    to: receipt?.to ?? "",
    execution: extractExecutionResult(receipt),
  };
}

export function parseEnvText(text) {
  const result = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[line.slice(0, index).trim()] = value;
  }
  return result;
}

export function discoverEnvPresence(projectEnv = "", parentEnv = "") {
  const merged = {
    ...parseEnvText(parentEnv),
    ...parseEnvText(projectEnv),
  };
  return {
    hasPrimaryPrivateKey: PRIMARY_KEY_VARIABLES.some((name) => Boolean(merged[name])),
    hasMerchantPrivateKey: MERCHANT_KEY_VARIABLES.some((name) => Boolean(merged[name])),
    hasCustomRpcUrl: Boolean(merged.STUDIONET_RPC_URL || merged.GENLAYER_RPC_URL),
    checkedPrimaryVariables: [...PRIMARY_KEY_VARIABLES],
    checkedMerchantVariables: [...MERCHANT_KEY_VARIABLES],
  };
}

export function inferRawGithubUrl(remoteUrl, commit, fixturePath = PUBLIC_FIXTURE_PATH) {
  const normalized = String(remoteUrl || "").trim();
  const match =
    normalized.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/) ??
    normalized.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (!match) return null;
  if (!/^[0-9a-f]{40}$/.test(commit)) return null;
  const [, owner, repo] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/${fixturePath}`;
}

export function assertSuccessReceipt(receipt) {
  const consensus = receipt?.result_name ?? receipt?.resultName ?? receipt?.txResultName ?? "";
  if (CONSENSUS_FAILURE_RESULTS.has(String(consensus))) {
    throw new Error(`Receipt consensus result is ${consensus}`);
  }
  const execution = extractExecutionResult(receipt);
  if (execution.result !== "SUCCESS") {
    throw new Error(`Receipt result is ${execution.result}: ${execution.error}`);
  }
  return execution;
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function currentCommit() {
  try {
    return execSync("git rev-parse HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "UNKNOWN";
  }
}

function loadEnvPresenceOnly() {
  const candidates = [path.resolve(".env"), path.resolve("..", ".env")];
  const found = [];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      for (const [key, value] of Object.entries(parseEnvText(readTextIfExists(file)))) {
        if (value !== "") process.env[key] = process.env[key] ?? value;
      }
      found.push(file);
    }
  }
  return found;
}

function requirePrivateKey(names) {
  for (const name of names) {
    const value = process.env[name];
    if (!value || !value.trim()) continue;
    const trimmed = value.trim();
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(trimmed)) {
      throw new Error(`${name} is not a 32-byte hex key`);
    }
    return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  }
  throw new Error(`${names.join(" or ")} is missing from ignored .env`);
}

function jsonSafe(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

function readEvidence() {
  if (!fs.existsSync(EVIDENCE_PATH)) return null;
  return JSON.parse(fs.readFileSync(EVIDENCE_PATH, "utf8"));
}

function sanitizeTransactions(transactions) {
  if (!transactions || typeof transactions !== "object" || Array.isArray(transactions)) return undefined;
  const safe = {};
  for (const [name, transaction] of Object.entries(transactions)) {
    if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) continue;
    const record = {};
    for (const key of ["transactionHash", "status", "execution", "submittedAt", "finalizedAt"]) {
      if (transaction[key] !== undefined) record[key] = transaction[key];
    }
    safe[name] = record;
  }
  return safe;
}

function projectSafeEvidence(input) {
  const output = {};
  for (const key of [
    "network",
    "sourceCommit",
    "contractAddress",
    "transactionHash",
    "result",
    "timestamp",
    "actorRoles",
    "mandateId",
    "disputeEvidence",
    "transactions",
    "canonicalReads",
    "limits",
  ]) {
    if (key === "transactions") {
      const transactions = sanitizeTransactions(input[key]);
      if (transactions !== undefined) output.transactions = transactions;
    } else if (input[key] !== undefined) {
      output[key] = input[key];
    }
  }
  return jsonSafe(output);
}

function writeEvidence(patch, { replace = false } = {}) {
  const previous = replace ? {} : (readEvidence() ?? {});
  const evidence = projectSafeEvidence({
    ...previous,
    ...patch,
    network: "studionet",
    sourceCommit: currentCommit(),
    limits: {
      noFrontend: !fs.existsSync(path.resolve("frontend")),
      contractOnlyTrack: true,
      evidenceIsSanitized: true,
      parserDoesNotPersistRawReceipts: true,
    },
  });
  fs.mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return evidence;
}

function archiveEvidence(existing, reason) {
  if (!existing?.contractAddress) return;
  const safeAddress = String(existing.contractAddress).toLowerCase().replace(/^0x/, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archivePath = path.resolve(
    "docs",
    "evidence",
    "studionet",
    "archive",
    `deployment-${safeAddress}-${stamp}.json`,
  );
  fs.mkdirSync(dirname(archivePath), { recursive: true });
  fs.writeFileSync(
    archivePath,
    `${JSON.stringify({ ...existing, archivedReason: reason }, null, 2)}\n`,
    "utf8",
  );
}

function getRemoteUrl() {
  try {
    return execSync("git remote get-url origin", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function assertCommittedSource() {
  const commit = currentCommit();
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error("A git commit is required before Studionet deploy/demo");
  }
  return commit;
}

function loadAccounts() {
  loadEnvPresenceOnly();
  const user = createAccount(requirePrivateKey(PRIMARY_KEY_VARIABLES));
  const merchant = createAccount(requirePrivateKey(MERCHANT_KEY_VARIABLES));
  return { user, merchant };
}

function signingClient(account) {
  return createClient({ chain: studionet, endpoint: rpcUrl(), account });
}

function publicClient() {
  return createClient({ chain: studionet, endpoint: rpcUrl() });
}

function rpcUrl() {
  return process.env.STUDIONET_RPC_URL?.trim() || process.env.GENLAYER_RPC_URL?.trim() || DEFAULT_RPC_URL;
}

async function assertStudionet(client) {
  const chainHex = await client.request({ method: "eth_chainId", params: [] });
  const chainId = Number(BigInt(chainHex));
  if (chainId !== studionet.id) {
    throw new Error(`Connected chain ${chainId} is not studionet ${studionet.id}`);
  }
  return chainId;
}

async function waitForFinality(client, hash, retries = 240) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const status = await client.request({ method: "gen_getTransactionStatus", params: [hash] });
    if (status === "FINALIZED") return status;
    if (TERMINAL_FAILURES.has(status)) {
      throw new Error(`Transaction ${hash} reached ${status}`);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5000));
  }
  throw new Error(`Transaction ${hash} did not finalize before timeout`);
}

function executionName(receipt) {
  const normalized =
    receipt?.txExecutionResultName ??
    receipt?.tx_execution_result_name ??
    receipt?.executionResultName;
  if (normalized) return normalized;
  const rawLeaderReceipt = receipt?.consensus_data?.leader_receipt;
  const leaderReceipt = Array.isArray(rawLeaderReceipt) ? rawLeaderReceipt[0] : rawLeaderReceipt;
  const rawExecution = leaderReceipt?.execution_result;
  if (rawExecution === "SUCCESS") return "FINISHED_WITH_RETURN";
  if (typeof rawExecution === "string" && rawExecution.length > 0) return "FINISHED_WITH_ERROR";
  return "UNKNOWN";
}

function deploymentAddress(receipt) {
  const result = extractExecutionResult(receipt);
  return (
    receipt?.txDataDecoded?.contractAddress ??
    receipt?.tx_data_decoded?.contract_address ??
    receipt?.data?.contract_address ??
    receipt?.data?.contractAddress ??
    result?.returnData?.contract_address ??
    result?.returnData?.contractAddress ??
    null
  );
}

async function waitForReceipt(client, hash) {
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: "ACCEPTED",
    interval: 5000,
    retries: 120,
    fullTransaction: true,
  });
  const networkStatus = await waitForFinality(client, hash);
  return { ...receipt, networkStatus };
}

function assertExecution(receipt, operation) {
  if (receipt.networkStatus !== "FINALIZED") {
    throw new Error(`${operation} did not finalize`);
  }
  const consensus = receipt?.result_name ?? receipt?.resultName ?? receipt?.txResultName ?? "";
  if (CONSENSUS_FAILURE_RESULTS.has(String(consensus))) {
    throw new Error(`${operation} reached consensus result ${consensus}`);
  }
  const execution = executionName(receipt);
  if (execution !== "FINISHED_WITH_RETURN") {
    throw new Error(`${operation} failed with ${execution}`);
  }
}

function transactionRecord(hash, receipt) {
  return {
    transactionHash: hash,
    status: receipt.networkStatus,
    execution: executionName(receipt),
    finalizedAt: new Date().toISOString(),
  };
}

async function writeFinalized(client, address, functionName, args, value = 0n, existing = null, onPending = () => {}) {
  let hash = existing?.transactionHash;
  if (!hash) {
    hash = await client.writeContract({ address, functionName, args, value });
    await onPending({
      transactionHash: hash,
      status: "SUBMITTED",
      submittedAt: new Date().toISOString(),
    });
  }
  const receipt = await waitForReceipt(client, hash);
  assertExecution(receipt, functionName);
  return transactionRecord(hash, receipt);
}

async function readView(client, address, functionName, args = []) {
  return jsonSafe(
    await client.readContract({
      address,
      functionName,
      args,
      jsonSafeReturn: true,
    }),
  );
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }
  return response.text();
}

async function sourceHash(url) {
  return crypto.createHash("sha256").update(await fetchText(url), "utf8").digest("hex");
}

async function disputeEvidenceUrl(commit) {
  if (process.env.AP2_EVIDENCE_URL?.trim()) return process.env.AP2_EVIDENCE_URL.trim();
  const inferred = inferRawGithubUrl(getRemoteUrl(), commit);
  if (!inferred) {
    throw new Error(
      "AP2_EVIDENCE_URL is missing and origin is not a GitHub remote that can form a commit-pinned raw URL",
    );
  }
  return inferred;
}

async function deploy() {
  const commit = assertCommittedSource();
  const evidence = readEvidence();
  if (evidence?.contractAddress && evidence?.sourceCommit === commit) {
    console.log(JSON.stringify(projectSafeEvidence({ ...evidence, result: "EXISTING_DEPLOYMENT" }), null, 2));
    return evidence.contractAddress;
  }
  let replaceEvidence = false;
  if (evidence?.contractAddress && evidence?.sourceCommit !== commit) {
    archiveEvidence(evidence, "Source commit changed before redeploy");
    replaceEvidence = true;
  }

  const { user, merchant } = loadAccounts();
  const client = signingClient(user);
  await assertStudionet(client);
  const code = new Uint8Array(fs.readFileSync(CONTRACT_PATH));
  const hash = await client.deployContract({ code, args: [] });
  writeEvidence(
    {
      result: "DEPLOY_SUBMITTED",
      transactionHash: hash,
      actorRoles: {
        user: user.address,
        merchant: merchant.address,
      },
    },
    { replace: replaceEvidence },
  );
  const receipt = await waitForReceipt(client, hash);
  assertExecution(receipt, "deploy Ap2MandateSettlement");
  const address = deploymentAddress(receipt);
  if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) {
    throw new Error("Deployed contract address missing from receipt");
  }
  const finalEvidence = writeEvidence({
    result: "SUCCESS",
    contractAddress: address,
    transactionHash: hash,
    timestamp: new Date().toISOString(),
    actorRoles: {
      user: user.address,
      merchant: merchant.address,
    },
    canonicalReads: {
      explorerAddress: `${EXPLORER_URL}/address/${address}`,
    },
  });
  console.log(JSON.stringify(finalEvidence, null, 2));
  return address;
}

async function runDemo() {
  const commit = assertCommittedSource();
  const evidence = readEvidence();
  if (!evidence?.contractAddress) {
    throw new Error("Run deploy before demo");
  }
  const { user, merchant } = loadAccounts();
  const userClient = signingClient(user);
  const merchantClient = signingClient(merchant);
  const reader = publicClient();
  await assertStudionet(userClient);

  const address = evidence.contractAddress;
  const transactions = { ...(evidence.transactions ?? {}) };
  const persistPending = (name) => (pending) => {
    transactions[name] = pending;
    writeEvidence({ ...evidence, transactions });
  };
  const ap2SpecHash = await sourceHash(AP2_SPEC_URL);
  const evidenceUrl = await disputeEvidenceUrl(commit);
  const evidenceBody = await fetchText(evidenceUrl);
  const evidenceDigest = crypto.createHash("sha256").update(evidenceBody, "utf8").digest("hex");

  transactions.openMandate = await writeFinalized(
    userClient,
    address,
    "open_mandate",
    [
      MANDATE_ID,
      merchant.address,
      "demo-merchant.example",
      "supershoe_limited_edition_gold_sneaker_womens_9_0",
      ESCROW_WEI,
      "USD",
      "2026-01-01",
      "2026-12-31",
      AP2_SPEC_URL,
      ap2SpecHash,
      DISPUTE_BOND_WEI,
    ],
    ESCROW_WEI,
    transactions.openMandate,
    persistPending("openMandate"),
  );
  transactions.acceptMandate = await writeFinalized(
    merchantClient,
    address,
    "accept_mandate",
    [MANDATE_ID],
    0n,
    transactions.acceptMandate,
    persistPending("acceptMandate"),
  );
  transactions.openDispute = await writeFinalized(
    userClient,
    address,
    "open_dispute",
    [MANDATE_ID, evidenceUrl, evidenceDigest],
    DISPUTE_BOND_WEI,
    transactions.openDispute,
    persistPending("openDispute"),
  );
  transactions.adjudicateDispute = await writeFinalized(
    userClient,
    address,
    "adjudicate_dispute",
    [MANDATE_ID],
    0n,
    transactions.adjudicateDispute,
    persistPending("adjudicateDispute"),
  );

  const userCreditBeforeWithdraw = await readView(reader, address, "get_credit", [user.address]);
  if (BigInt(userCreditBeforeWithdraw) > 0n) {
    transactions.withdrawUserCredit = await writeFinalized(
      userClient,
      address,
      "withdraw_credit",
      [BigInt(userCreditBeforeWithdraw)],
      0n,
      transactions.withdrawUserCredit,
      persistPending("withdrawUserCredit"),
    );
  }

  const canonicalReads = {
    status: await readView(reader, address, "get_status", [MANDATE_ID]),
    mandate: await readView(reader, address, "get_mandate", [MANDATE_ID]),
    dispute: await readView(reader, address, "get_dispute", [MANDATE_ID]),
    userCreditBeforeWithdraw,
    userCreditAfterWithdraw: await readView(reader, address, "get_credit", [user.address]),
    merchantCredit: await readView(reader, address, "get_credit", [merchant.address]),
    accounting: await readView(reader, address, "get_accounting", []),
  };
  const finalEvidence = writeEvidence({
    ...evidence,
    result: "SUCCESS",
    contractAddress: address,
    transactionHash: evidence.transactionHash,
    actorRoles: {
      user: user.address,
      merchant: merchant.address,
    },
    mandateId: MANDATE_ID,
    disputeEvidence: {
      url: evidenceUrl,
      sha256: evidenceDigest,
    },
    transactions,
    canonicalReads,
  });
  console.log(JSON.stringify(projectSafeEvidence(finalEvidence), null, 2));
}

async function main() {
  const command = process.argv[2] ?? "inspect";
  const envFiles = loadEnvPresenceOnly();
  fs.mkdirSync(path.dirname(EVIDENCE_PATH), { recursive: true });

  if (command === "inspect") {
    const projectEnv = readTextIfExists(path.resolve(".env"));
    const parentEnv = readTextIfExists(path.resolve("..", ".env"));
    const presence = discoverEnvPresence(projectEnv, parentEnv);
    const safe = {
      network: "studionet",
      contractFile: "contracts/ap2_mandate_settlement.py",
      envFilesChecked: envFiles.length,
      hasPrimaryPrivateKey: presence.hasPrimaryPrivateKey,
      hasMerchantPrivateKey: presence.hasMerchantPrivateKey,
      hasCustomRpcUrl: presence.hasCustomRpcUrl,
      sourceCommit: currentCommit(),
      deploymentPath: path.relative(process.cwd(), EVIDENCE_PATH),
    };
    console.log(JSON.stringify(safe, null, 2));
    return;
  }

  if (command === "deploy") {
    await deploy();
    return;
  }

  if (command === "demo") {
    await runDemo();
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
