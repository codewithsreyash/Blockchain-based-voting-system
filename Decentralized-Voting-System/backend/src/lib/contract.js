const path = require("path");
const { spawn } = require("child_process");
const { ethers } = require("ethers");
const {
  rpcUrl,
  contractAddress,
  adminPrivateKey,
  chainId,
  localDemoRpcPort,
  localDemoChainId,
  localDemoFundingEth,
} = require("../config/env");

const NETWORK_KEYS = Object.freeze({
  AMOY: "amoy",
  LOCAL: "local",
});

const NETWORK_LABELS = Object.freeze({
  [NETWORK_KEYS.AMOY]: "Polygon Amoy",
  [NETWORK_KEYS.LOCAL]: "Demo Hardhat",
});

const LOCAL_DEMO_HOST = "127.0.0.1";
const LOCAL_DEMO_RPC_URL = `http://${LOCAL_DEMO_HOST}:${localDemoRpcPort}`;
const LOCAL_DEMO_RPC_PATH = "/rpc/local";
const contractContexts = new Map();
let localDemoProcess = null;
let localDemoStartedByBackend = false;
let localDemoContextPromise = null;

function loadArtifact() {
  try {
    return require(path.resolve(__dirname, "../../../build/contracts/Voting.json"));
  } catch (error) {
    throw new Error(
      "Unable to find build/contracts/Voting.json. Run `truffle compile` before starting the backend."
    );
  }
}

const artifact = loadArtifact();

function normalizePrivateKey(privateKey) {
  if (!privateKey) {
    return privateKey;
  }

  return privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
}

function resolveContractNetwork(requestedNetwork) {
  const rawValue = Array.isArray(requestedNetwork) ? requestedNetwork[0] : requestedNetwork;
  return rawValue === NETWORK_KEYS.LOCAL ? NETWORK_KEYS.LOCAL : NETWORK_KEYS.AMOY;
}

function buildContractError(message, statusCode = 400, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function getReadableContractError(error, fallbackMessage) {
  const candidates = [
    error?.shortMessage,
    error?.reason,
    error?.info?.error?.message,
    error?.info?.error?.data?.message,
    error?.data?.message,
    error?.message,
  ].filter(Boolean);

  const rawMessage = candidates[0];
  if (!rawMessage) {
    return fallbackMessage;
  }

  return rawMessage.replace(/^execution reverted:\s*/i, "").trim();
}

async function resolveSignerAddress(signer) {
  if (typeof signer.getAddress === "function") {
    return signer.getAddress();
  }

  return signer.address;
}

function createContractContext({
  networkKey,
  mode,
  provider,
  adminSigner,
  contractAddress: resolvedContractAddress,
  rpcUrl: resolvedRpcUrl,
  chainId: resolvedChainId,
  publicRpcPath,
}) {
  return {
    networkKey,
    label: NETWORK_LABELS[networkKey],
    mode,
    provider,
    adminSigner,
    contractAddress: resolvedContractAddress,
    rpcUrl: resolvedRpcUrl,
    chainId: resolvedChainId,
    publicRpcPath: publicRpcPath || null,
    readContract: new ethers.Contract(resolvedContractAddress, artifact.abi, provider),
    writeContract: new ethers.Contract(resolvedContractAddress, artifact.abi, adminSigner),
  };
}

async function assertChainMatchesConfig(context) {
  let network;

  try {
    network = await context.provider.getNetwork();
  } catch (error) {
    throw buildContractError(
      `Unable to reach ${context.label} RPC ${context.rpcUrl}: ${getReadableContractError(
        error,
        "RPC endpoint is unavailable."
      )}`,
      500
    );
  }

  const rpcChainId = Number(network.chainId);

  if (rpcChainId !== context.chainId) {
    throw buildContractError(
      `${context.label} RPC chain ID ${rpcChainId} does not match configured chain ID ${context.chainId}.`,
      500
    );
  }

  return rpcChainId;
}

async function assertAdminSignerAuthorized(context) {
  let owner;

  try {
    owner = await context.readContract.owner();
  } catch (error) {
    throw buildContractError(
      getReadableContractError(error, `Unable to read the ${context.label} contract owner.`),
      500
    );
  }

  const signerAddress = await resolveSignerAddress(context.adminSigner);

  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    throw buildContractError(
      `${context.label} signer ${signerAddress} is not the contract owner. Contract owner is ${owner}.`,
      500
    );
  }

  return owner;
}

function getBackendRootDir() {
  return path.resolve(__dirname, "../..");
}

function resolveHardhatCliScript() {
  try {
    return require.resolve("hardhat/internal/cli/bootstrap.js", {
      paths: [getBackendRootDir()],
    });
  } catch {
    throw buildContractError(
      "Missing Hardhat runtime in the backend dependency tree. Run `npm install` in the backend before starting demo mode.",
      500
    );
  }
}

function spawnHardhatNode(hardhatCliScript, backendRootDir) {
  const args = [hardhatCliScript, "node", "--hostname", LOCAL_DEMO_HOST, "--port", String(localDemoRpcPort)];

  return spawn(process.execPath, args, {
    cwd: backendRootDir,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function logDemoNodeOutput(source, chunk) {
  const lines = chunk
    .toString()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    console.log(`[demo-node:${source}] ${line}`);
  }
}

async function wait(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function connectToExistingDemoProvider() {
  const provider = new ethers.JsonRpcProvider(LOCAL_DEMO_RPC_URL, localDemoChainId);

  try {
    const network = await provider.getNetwork();
    const rpcChainId = Number(network.chainId);

    if (rpcChainId !== localDemoChainId) {
      throw buildContractError(
        `Port ${localDemoRpcPort} is already serving chain ${rpcChainId}, expected the demo Hardhat chain ${localDemoChainId}.`,
        500
      );
    }

    await provider.getBlockNumber();
    return provider;
  } catch (error) {
    const message = getReadableContractError(error, "");

    if (
      message.includes("ECONNREFUSED") ||
      message.includes("ECONNRESET") ||
      message.includes("failed to connect") ||
      message.includes("missing response") ||
      message.includes("socket hang up")
    ) {
      return null;
    }

    if (error.statusCode) {
      throw error;
    }

    throw buildContractError(
      `Unable to connect to the embedded demo RPC ${LOCAL_DEMO_RPC_URL}: ${message || "Unexpected RPC error."}`,
      500
    );
  }
}

async function waitForDemoRpc(childProcess) {
  const provider = new ethers.JsonRpcProvider(LOCAL_DEMO_RPC_URL, localDemoChainId);
  const timeoutAt = Date.now() + 30_000;

  while (Date.now() < timeoutAt) {
    if (childProcess.exitCode !== null) {
      throw buildContractError("Embedded Hardhat demo node exited before it became ready.", 500);
    }

    try {
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== localDemoChainId) {
        throw buildContractError(
          `Embedded Hardhat demo node started on unexpected chain ${Number(network.chainId)}.`,
          500
        );
      }

      await provider.getBlockNumber();
      return provider;
    } catch (error) {
      await wait(500);
    }
  }

  throw buildContractError("Embedded Hardhat demo node did not become ready within 30 seconds.", 500);
}

async function stopTrackedLocalDemoNode() {
  if (!localDemoProcess || !localDemoStartedByBackend) {
    return;
  }

  const childProcess = localDemoProcess;

  await new Promise((resolve) => {
    if (childProcess.exitCode !== null) {
      resolve();
      return;
    }

    childProcess.once("exit", () => {
      resolve();
    });

    try {
      childProcess.kill("SIGTERM");
    } catch {
      resolve();
    }
  });
}

async function ensureLocalDemoProvider() {
  const existingProvider = await connectToExistingDemoProvider();
  if (existingProvider) {
    return existingProvider;
  }

  if (localDemoProcess && localDemoProcess.exitCode === null && localDemoStartedByBackend) {
    console.warn("Embedded demo node became unresponsive. Restarting it before serving the next JSON-RPC request.");
    await stopTrackedLocalDemoNode();
  }

  const hardhatCliScript = resolveHardhatCliScript();
  const backendRootDir = getBackendRootDir();

  localDemoProcess = spawnHardhatNode(hardhatCliScript, backendRootDir);
  localDemoStartedByBackend = true;

  localDemoProcess.stdout.on("data", (chunk) => {
    logDemoNodeOutput("stdout", chunk);
  });
  localDemoProcess.stderr.on("data", (chunk) => {
    logDemoNodeOutput("stderr", chunk);
  });
  localDemoProcess.on("exit", (code, signal) => {
    if (signal !== "SIGTERM" && code !== 0) {
      console.error(`Embedded demo node exited unexpectedly with code ${code ?? "unknown"} and signal ${signal ?? "none"}`);
    }

    contractContexts.delete(NETWORK_KEYS.LOCAL);
    localDemoProcess = null;
    localDemoStartedByBackend = false;
  });

  return waitForDemoRpc(localDemoProcess);
}

async function isLocalDemoContextHealthy(context) {
  try {
    await assertChainMatchesConfig(context);
    await context.readContract.owner();
    return true;
  } catch {
    return false;
  }
}

async function initializeAmoyContext() {
  const normalizedPrivateKey = normalizePrivateKey(adminPrivateKey);
  const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
  const adminSigner = new ethers.Wallet(normalizedPrivateKey, provider);
  const context = createContractContext({
    networkKey: NETWORK_KEYS.AMOY,
    mode: "production",
    provider,
    adminSigner,
    contractAddress,
    rpcUrl,
    chainId,
  });

  await assertChainMatchesConfig(context);
  await assertAdminSignerAuthorized(context);

  return context;
}

async function initializeLocalDemoContext() {
  const provider = await ensureLocalDemoProvider();
  const adminSigner = await provider.getSigner(0);
  const adminAddress = await resolveSignerAddress(adminSigner);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, adminSigner);
  const deployedContract = await factory.deploy(adminAddress);

  await deployedContract.waitForDeployment();

  const deployedContractAddress = await deployedContract.getAddress();
  const context = createContractContext({
    networkKey: NETWORK_KEYS.LOCAL,
    mode: "demo",
    provider,
    adminSigner,
    contractAddress: deployedContractAddress,
    rpcUrl: LOCAL_DEMO_RPC_URL,
    chainId: localDemoChainId,
    publicRpcPath: LOCAL_DEMO_RPC_PATH,
  });

  await assertChainMatchesConfig(context);
  await assertAdminSignerAuthorized(context);

  return context;
}

async function ensureLocalDemoContextReady() {
  const existingContext = contractContexts.get(NETWORK_KEYS.LOCAL);

  if (existingContext && (await isLocalDemoContextHealthy(existingContext))) {
    return existingContext;
  }

  if (existingContext) {
    console.warn("Demo Hardhat context became stale. Reinitializing the embedded node and redeploying the demo contract.");
    contractContexts.delete(NETWORK_KEYS.LOCAL);
  }

  if (!localDemoContextPromise) {
    localDemoContextPromise = (async () => {
      const localContext = await initializeLocalDemoContext();
      contractContexts.set(NETWORK_KEYS.LOCAL, localContext);
      return localContext;
    })().finally(() => {
      localDemoContextPromise = null;
    });
  }

  return localDemoContextPromise;
}

async function initializeContractAccess() {
  const amoyContext = await initializeAmoyContext();
  contractContexts.set(NETWORK_KEYS.AMOY, amoyContext);

  await ensureLocalDemoContextReady();

  return getNetworkCatalog();
}

function getContractContext(requestedNetwork) {
  const networkKey = resolveContractNetwork(requestedNetwork);
  const context = contractContexts.get(networkKey);

  if (!context) {
    throw buildContractError(`${NETWORK_LABELS[networkKey]} is not ready yet.`, 503);
  }

  return context;
}

function getReadContract(requestedNetwork) {
  return getContractContext(requestedNetwork).readContract;
}

function getWriteContract(requestedNetwork) {
  return getContractContext(requestedNetwork).writeContract;
}

async function getReadyContractContext(requestedNetwork) {
  const networkKey = resolveContractNetwork(requestedNetwork);

  if (networkKey === NETWORK_KEYS.LOCAL) {
    return ensureLocalDemoContextReady();
  }

  return getContractContext(networkKey);
}

async function getReadContractAsync(requestedNetwork) {
  return (await getReadyContractContext(requestedNetwork)).readContract;
}

async function getWriteContractAsync(requestedNetwork) {
  return (await getReadyContractContext(requestedNetwork)).writeContract;
}

const contractRoleMap = {
  admin: 1,
  student: 2,
  teacher: 3,
};

function getContractRole(role) {
  const contractRole = contractRoleMap[role];
  if (!contractRole) {
    throw new Error(`Unsupported role for contract verification: ${role}`);
  }

  return contractRole;
}

async function sendAdminTransaction(methodName, args, actionLabel, requestedNetwork = NETWORK_KEYS.AMOY) {
  const context = await getReadyContractContext(requestedNetwork);
  await assertAdminSignerAuthorized(context);

  const signerAddress = await resolveSignerAddress(context.adminSigner);
  const data = context.writeContract.interface.encodeFunctionData(methodName, args);
  const transactionRequest = {
    to: context.contractAddress,
    from: signerAddress,
    data,
  };

  try {
    const estimatedGas = await context.provider.estimateGas(transactionRequest);
    const gasBuffer = estimatedGas / 5n;
    transactionRequest.gasLimit = estimatedGas + (gasBuffer > 0n ? gasBuffer : 50_000n);
  } catch (error) {
    throw buildContractError(
      `${actionLabel} failed before submission on ${context.label}: ${getReadableContractError(
        error,
        "Unable to estimate gas for the contract write."
      )}`
    );
  }

  let transaction;
  try {
    transaction = await context.adminSigner.sendTransaction(transactionRequest);
  } catch (error) {
    throw buildContractError(
      `${actionLabel} failed during submission on ${context.label}: ${getReadableContractError(
        error,
        "Unable to send the transaction from the backend signer."
      )}`
    );
  }

  let receipt;
  try {
    receipt = await transaction.wait();
  } catch (error) {
    throw buildContractError(
      `${actionLabel} failed while waiting for confirmation on ${context.label}: ${getReadableContractError(
        error,
        "Transaction was not confirmed successfully."
      )}`
    );
  }

  if (!receipt || receipt.status !== 1) {
    throw buildContractError(`${actionLabel} failed on ${context.label}. Transaction reverted after submission.`);
  }

  return {
    transaction,
    receipt,
    gasLimit: transactionRequest.gasLimit?.toString(),
    network: context.networkKey,
    contractAddress: context.contractAddress,
  };
}

async function ensureDemoWalletFunds(requestedNetwork, walletAddress) {
  if (resolveContractNetwork(requestedNetwork) !== NETWORK_KEYS.LOCAL) {
    return null;
  }

  const context = await getReadyContractContext(NETWORK_KEYS.LOCAL);
  const normalizedAddress = ethers.getAddress(walletAddress);
  const currentBalance = await context.provider.getBalance(normalizedAddress);
  const fundingAmount = ethers.parseEther(localDemoFundingEth);
  const minimumBalance = fundingAmount / 10n;

  if (currentBalance >= minimumBalance) {
    return null;
  }

  const transaction = await context.adminSigner.sendTransaction({
    to: normalizedAddress,
    value: fundingAmount,
  });
  const receipt = await transaction.wait();

  return {
    transactionHash: receipt.hash,
    amountEth: localDemoFundingEth,
  };
}

async function forwardLocalDemoRpcRequest(body) {
  if (typeof body === "undefined") {
    throw buildContractError("JSON-RPC requests to /rpc/local must include a JSON body.", 400);
  }

  await ensureLocalDemoContextReady();

  async function proxyRequest() {
    let response;

    try {
      response = await fetch(LOCAL_DEMO_RPC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw buildContractError(
        `Unable to reach the embedded demo RPC: ${getReadableContractError(error, "JSON-RPC bridge failed.")}`,
        502
      );
    }

    return {
      status: response.status,
      contentType: response.headers.get("content-type") || "application/json; charset=utf-8",
      payload: await response.text(),
    };
  }

  try {
    return await proxyRequest();
  } catch (error) {
    if (error?.statusCode !== 502) {
      throw error;
    }

    console.warn("Embedded demo RPC bridge lost its upstream connection. Restarting the demo node and retrying once.");
    contractContexts.delete(NETWORK_KEYS.LOCAL);
    await stopTrackedLocalDemoNode();
    await ensureLocalDemoContextReady();
    return proxyRequest();
  }
}

function getPublicDemoRpcUrl(baseUrl) {
  if (!baseUrl) {
    return LOCAL_DEMO_RPC_PATH;
  }

  return new URL(LOCAL_DEMO_RPC_PATH, baseUrl).toString();
}

function getNetworkCatalog(baseUrl) {
  const amoyContext = contractContexts.get(NETWORK_KEYS.AMOY);
  const localContext = contractContexts.get(NETWORK_KEYS.LOCAL);

  return {
    defaultNetwork: NETWORK_KEYS.AMOY,
    networks: {
      [NETWORK_KEYS.AMOY]: {
        key: NETWORK_KEYS.AMOY,
        label: NETWORK_LABELS[NETWORK_KEYS.AMOY],
        mode: "production",
        chainId: amoyContext?.chainId ?? chainId,
        contractAddress: amoyContext?.contractAddress ?? contractAddress,
        rpcUrl: amoyContext?.rpcUrl ?? rpcUrl,
        blockExplorerUrl: "https://amoy.polygonscan.com",
      },
      [NETWORK_KEYS.LOCAL]: {
        key: NETWORK_KEYS.LOCAL,
        label: NETWORK_LABELS[NETWORK_KEYS.LOCAL],
        mode: "demo",
        chainId: localContext?.chainId ?? localDemoChainId,
        contractAddress: localContext?.contractAddress ?? null,
        rpcUrl: getPublicDemoRpcUrl(baseUrl),
        blockExplorerUrl: null,
        note: "Demo mode runs on an embedded Hardhat node and auto-funds verified wallets with free ETH.",
      },
    },
  };
}

async function shutdownLocalDemoNode() {
  await stopTrackedLocalDemoNode();
}

module.exports = {
  NETWORK_KEYS,
  resolveContractNetwork,
  getContractRole,
  getContractContext,
  getReadContract,
  getReadContractAsync,
  getWriteContract,
  getWriteContractAsync,
  getNetworkCatalog,
  initializeContractAccess,
  sendAdminTransaction,
  ensureDemoWalletFunds,
  forwardLocalDemoRpcRequest,
  shutdownLocalDemoNode,
};
