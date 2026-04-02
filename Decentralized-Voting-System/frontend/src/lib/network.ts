"use client";

import type { AppNetwork, NetworkStatusResponse } from "./types";

export const DEFAULT_APP_NETWORK: AppNetwork = "amoy";
const NETWORK_STORAGE_KEY = "dva-selected-network";

export function normalizeAppNetwork(value: string | null | undefined): AppNetwork {
  return value === "local" ? "local" : DEFAULT_APP_NETWORK;
}

export function getStoredAppNetwork(): AppNetwork {
  if (typeof window === "undefined") {
    return DEFAULT_APP_NETWORK;
  }

  return normalizeAppNetwork(window.localStorage.getItem(NETWORK_STORAGE_KEY));
}

export function persistAppNetworkSelection(network: AppNetwork) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(NETWORK_STORAGE_KEY, network);
  }
}

function getApiOrigin() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (!apiBaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(apiBaseUrl);
  } catch {
    throw new Error("Invalid NEXT_PUBLIC_API_BASE_URL");
  }

  return parsedUrl.origin;
}

export function getDemoRpcUrl() {
  return `${getApiOrigin()}/rpc/local`;
}

export function getFallbackNetworkStatus(): NetworkStatusResponse {
  return {
    defaultNetwork: DEFAULT_APP_NETWORK,
    networks: {
      amoy: {
        key: "amoy",
        label: "Polygon Amoy",
        mode: "production",
        chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 80002),
        contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || null,
        rpcUrl: process.env.NEXT_PUBLIC_RPC_URL?.trim() || "",
      },
      local: {
        key: "local",
        label: "Demo Hardhat",
        mode: "demo",
        chainId: 31337,
        contractAddress: null,
        rpcUrl: getDemoRpcUrl(),
        note: "Demo mode uses the backend's embedded Hardhat chain and free demo ETH.",
      },
    },
  };
}
