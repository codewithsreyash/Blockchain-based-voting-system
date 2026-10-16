import { defineChain, type Chain } from "viem";
import { createConfig, http, fallback } from "wagmi";
import { injected } from "@wagmi/core";
import { walletConnect } from "@wagmi/connectors";
import { polygonAmoy } from "wagmi/chains";
import {
  DEMO_HARDHAT_CHAIN_ID,
  DEMO_HARDHAT_NETWORK_NAME,
  getConfiguredApiBaseUrl,
  getDemoRpcUrl,
  resolvePublicDemoRpcUrl,
} from "./network";
import type { AppNetwork } from "./types";

const configuredAmoyRpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim();
const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const demoRpcUrl = resolvePublicDemoRpcUrl(getDemoRpcUrl());
const configuredApiBaseUrl = (() => {
  try {
    return getConfiguredApiBaseUrl();
  } catch {
    return undefined;
  }
})();

function getOrigin(url: string | undefined) {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

const demoHardhatChain = defineChain({
  id: DEMO_HARDHAT_CHAIN_ID,
  name: DEMO_HARDHAT_NETWORK_NAME,
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [demoRpcUrl],
    },
  },
  testnet: true,
});

const amoyRpcUrl =
  configuredAmoyRpcUrl ||
  "https://polygon-amoy.g.alchemy.com/v2/75_3FkknbchD8uZ0ZQSoP";
const walletMetadataUrl =
  configuredAppUrl ??
  (typeof window !== "undefined" ? window.location.origin : getOrigin(configuredApiBaseUrl));
const wagmiChains = [polygonAmoy, demoHardhatChain] as const;
const walletConnectConnector =
  walletConnectProjectId && walletMetadataUrl
    ? walletConnect({
        isNewChainsStale: false,
        projectId: walletConnectProjectId,
        showQrModal: true,
        metadata: {
          name: "DVA Campus Voting",
          description: "Role-based campus voting with mobile wallet support",
          url: walletMetadataUrl,
          icons: [],
        },
      })
    : null;
const connectors = walletConnectConnector ? [injected(), walletConnectConnector] : [injected()];

export const chainByAppNetwork: Record<AppNetwork, Chain> = {
  amoy: polygonAmoy,
  local: demoHardhatChain,
};

export const wagmiConfig = createConfig({
  chains: wagmiChains,
  connectors,
  transports: {
    [polygonAmoy.id]: fallback([
      http(amoyRpcUrl),
      http("https://polygon-amoy.g.alchemy.com/v2/75_3FkknbchD8uZ0ZQSoP"),
      http("https://rpc.ankr.com/polygon_amoy"),
      http("https://polygon-amoy-bor-rpc.publicnode.com"),
      http(polygonAmoy.rpcUrls.default.http[0]),
    ]),
    [demoHardhatChain.id]: http(demoRpcUrl),
  },
});
