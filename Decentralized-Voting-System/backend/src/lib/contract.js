const path = require("path");
const { ethers } = require("ethers");
const { rpcUrl, contractAddress, adminPrivateKey, chainId } = require("../config/env");

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
const normalizedPrivateKey = adminPrivateKey.startsWith("0x") ? adminPrivateKey : `0x${adminPrivateKey}`;
const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
const adminSigner = new ethers.Wallet(normalizedPrivateKey, provider);
const readContract = new ethers.Contract(contractAddress, artifact.abi, provider);
const writeContract = new ethers.Contract(contractAddress, artifact.abi, adminSigner);

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

async function assertChainMatchesConfig() {
  const network = await provider.getNetwork();
  const rpcChainId = Number(network.chainId);

  if (rpcChainId !== chainId) {
    throw buildContractError(
      `RPC chain ID ${rpcChainId} does not match configured CHAIN_ID ${chainId}. Check backend/.env.`,
      500
    );
  }

  return rpcChainId;
}

async function assertAdminSignerAuthorized() {
  let owner;

  try {
    owner = await readContract.owner();
  } catch (error) {
    throw buildContractError(
      getReadableContractError(error, "Unable to read contract owner from chain."),
      500
    );
  }

  if (owner.toLowerCase() !== adminSigner.address.toLowerCase()) {
    throw buildContractError(
      `Backend signer ${adminSigner.address} is not the contract owner. Contract owner is ${owner}. Set INITIAL_ADMIN_ADDRESS and ADMIN_PRIVATE_KEY to the same wallet before deploying.`,
      500
    );
  }

  return owner;
}

async function initializeContractAccess() {
  await assertChainMatchesConfig();
  const owner = await assertAdminSignerAuthorized();

  return {
    owner,
    signerAddress: adminSigner.address,
    contractAddress,
    chainId,
  };
}

async function sendAdminTransaction(methodName, args, actionLabel) {
  await assertAdminSignerAuthorized();

  const data = writeContract.interface.encodeFunctionData(methodName, args);
  const transactionRequest = {
    to: contractAddress,
    from: adminSigner.address,
    data,
  };

  try {
    const estimatedGas = await provider.estimateGas(transactionRequest);
    const gasBuffer = estimatedGas / 5n;
    transactionRequest.gasLimit = estimatedGas + (gasBuffer > 0n ? gasBuffer : 50_000n);
  } catch (error) {
    throw buildContractError(
      `${actionLabel} failed before submission: ${getReadableContractError(
        error,
        "Unable to estimate gas for the contract write."
      )}`
    );
  }

  let transaction;
  try {
    transaction = await adminSigner.sendTransaction(transactionRequest);
  } catch (error) {
    throw buildContractError(
      `${actionLabel} failed during submission: ${getReadableContractError(
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
      `${actionLabel} failed while waiting for confirmation: ${getReadableContractError(
        error,
        "Transaction was not confirmed successfully."
      )}`
    );
  }

  if (!receipt || receipt.status !== 1) {
    throw buildContractError(`${actionLabel} failed on-chain. Transaction reverted after submission.`);
  }

  return {
    transaction,
    receipt,
    gasLimit: transactionRequest.gasLimit?.toString(),
  };
}

module.exports = {
  provider,
  adminSigner,
  readContract,
  writeContract,
  getContractRole,
  initializeContractAccess,
  assertAdminSignerAuthorized,
  sendAdminTransaction,
};
