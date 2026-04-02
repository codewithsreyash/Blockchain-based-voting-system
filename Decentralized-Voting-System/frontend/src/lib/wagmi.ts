import { defineChain, type Chain } from "viem";
import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { walletConnect } from "@wagmi/connectors";
import { arbitrumSepolia, polygon, polygonAmoy } from "wagmi/chains";

const configuredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 80002);
const configuredRpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim();
const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

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

const supportedChains: Record<number, Chain> = {
  137: polygon,
  421614: arbitrumSepolia,
  80002: polygonAmoy,
};

const localDevelopmentChain = defineChain({
  id: configuredChainId,
  name: configuredChainId === 1337 ? "Local Ganache" : `Custom Chain ${configuredChainId}`,
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: configuredRpcUrl ? [configuredRpcUrl] : [],
    },
  },
  testnet: true,
});

export const selectedChain: Chain = supportedChains[configuredChainId] ?? localDevelopmentChain;
const selectedRpcUrl = configuredRpcUrl ?? selectedChain.rpcUrls.default.http[0];
const walletMetadataUrl =
  configuredAppUrl ??
  (typeof window !== "undefined" ? window.location.origin : getOrigin(configuredApiBaseUrl));
const walletConnectConnector =
  walletConnectProjectId && walletMetadataUrl
    ? walletConnect({
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

if (!selectedRpcUrl) {
  throw new Error("Missing NEXT_PUBLIC_RPC_URL for the configured chain.");
}

export const wagmiConfig = createConfig({
  chains: [selectedChain],
  connectors,
  transports: {
    [selectedChain.id]: http(selectedRpcUrl),
  },
});
