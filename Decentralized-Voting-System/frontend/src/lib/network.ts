"use client";

import type { AppNetwork, NetworkStatusResponse } from "./types";

export const DEFAULT_APP_NETWORK: AppNetwork = "amoy";
export const DEMO_HARDHAT_CHAIN_ID = 31337;
export const DEMO_HARDHAT_NETWORK_NAME = "Demo Hardhat";
const NETWORK_STORAGE_KEY = "dva-selected-network";
const configuredApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "";

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

function parseConfiguredApiBaseUrl() {
  if (!configuredApiBaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");
  }

  try {
    return new URL(configuredApiBaseUrl);
  } catch {
    throw new Error("Invalid NEXT_PUBLIC_API_BASE_URL");
  }
}

export function getConfiguredApiBaseUrl() {
  const parsedUrl = parseConfiguredApiBaseUrl();
  const normalizedPathname = parsedUrl.pathname.replace(/\/+$/, "");

  if (!normalizedPathname || normalizedPathname === "/") {
    parsedUrl.pathname = "/api";
  } else if (!normalizedPathname.endsWith("/api")) {
    parsedUrl.pathname = `${normalizedPathname}/api`;
  } else {
    parsedUrl.pathname = normalizedPathname;
  }

  return parsedUrl.toString().replace(/\/+$/, "");
}

export function getConfiguredBackendBaseUrl() {
  const parsedUrl = new URL(getConfiguredApiBaseUrl());
  const normalizedPathname = parsedUrl.pathname.replace(/\/+$/, "");
  parsedUrl.pathname = normalizedPathname.endsWith("/api") ? normalizedPathname.slice(0, -4) || "/" : normalizedPathname || "/";
  return parsedUrl.toString().replace(/\/+$/, "");
}

export function getDemoRpcUrl() {
  return `${getConfiguredBackendBaseUrl()}/rpc/local`;
}

export function isLocalRpcUrl(rpcUrl: string) {
  try {
    const hostname = new URL(rpcUrl).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function resolvePublicDemoRpcUrl(rpcUrl?: string | null) {
  const resolvedRpcUrl = rpcUrl?.trim() || getDemoRpcUrl();

  if (!resolvedRpcUrl) {
    throw new Error("Demo Mode is missing the public RPC URL from the backend.");
  }

  if (isLocalRpcUrl(resolvedRpcUrl)) {
    throw new Error(
      `Demo Mode RPC is misconfigured: ${resolvedRpcUrl}. Mobile wallets must use the public Render RPC bridge instead of localhost.`
    );
  }

  return resolvedRpcUrl;
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
        blockExplorerUrl: "https://amoy.polygonscan.com",
      },
      local: {
        key: "local",
        label: DEMO_HARDHAT_NETWORK_NAME,
        mode: "demo",
        chainId: DEMO_HARDHAT_CHAIN_ID,
        contractAddress: null,
        rpcUrl: resolvePublicDemoRpcUrl(),
        blockExplorerUrl: null,
        note: "Demo mode uses the backend's embedded Hardhat chain and free demo ETH.",
      },
    },
  };
}
