import { defineChain } from "viem";
import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { walletConnect } from "@wagmi/connectors";
import { arbitrumSepolia, polygon, polygonAmoy } from "wagmi/chains";

const configuredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 80002);
const configuredRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:7545";
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const supportedChains = {
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
      http: [configuredRpcUrl],
    },
  },
  testnet: true,
});

export const selectedChain =
  supportedChains[configuredChainId as keyof typeof supportedChains] ?? localDevelopmentChain;

const connectors = [injected()];

if (walletConnectProjectId) {
  connectors.push(
    walletConnect({
      projectId: walletConnectProjectId,
      showQrModal: true,
      metadata: {
        name: "DVA Campus Voting",
        description: "Role-based campus voting with mobile wallet support",
        url: "http://localhost:3000",
        icons: [],
      },
    })
  );
}

export const wagmiConfig = createConfig({
  chains: [selectedChain],
  connectors,
  transports: {
    [selectedChain.id]: http(configuredRpcUrl || selectedChain.rpcUrls.default.http[0]),
  },
});
