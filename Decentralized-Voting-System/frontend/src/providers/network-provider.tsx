"use client";

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../lib/api";
import { DEFAULT_APP_NETWORK, getFallbackNetworkStatus, getStoredAppNetwork, persistAppNetworkSelection } from "../lib/network";
import type { AppNetwork, NetworkDetails } from "../lib/types";

type NetworkContextValue = {
  activeNetwork: NetworkDetails;
  isDemoMode: boolean;
  isLoadingNetworks: boolean;
  networks: Record<AppNetwork, NetworkDetails>;
  selectedNetwork: AppNetwork;
  setSelectedNetwork: (network: AppNetwork) => void;
};

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

export function NetworkProvider({ children }: PropsWithChildren) {
  const fallbackStatus = useMemo(() => getFallbackNetworkStatus(), []);
  const [selectedNetwork, setSelectedNetworkState] = useState<AppNetwork>(DEFAULT_APP_NETWORK);
  const [networks, setNetworks] = useState<Record<AppNetwork, NetworkDetails>>(fallbackStatus.networks);
  const [isLoadingNetworks, setIsLoadingNetworks] = useState(true);

  useEffect(() => {
    setSelectedNetworkState(getStoredAppNetwork());
  }, []);

  useEffect(() => {
    let active = true;

    api
      .getNetworkStatus()
      .then((response) => {
        if (!active) {
          return;
        }

        setNetworks({
          amoy: {
            ...fallbackStatus.networks.amoy,
            ...response.networks.amoy,
          },
          local: {
            ...fallbackStatus.networks.local,
            ...response.networks.local,
          },
        });
      })
      .catch(() => {
        if (active) {
          setNetworks(fallbackStatus.networks);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingNetworks(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fallbackStatus]);

  const setSelectedNetwork = useCallback((network: AppNetwork) => {
    persistAppNetworkSelection(network);
    setSelectedNetworkState(network);
  }, []);

  const activeNetwork = networks[selectedNetwork] ?? networks[DEFAULT_APP_NETWORK];
  const value = useMemo(
    () => ({
      activeNetwork,
      isDemoMode: selectedNetwork === "local",
      isLoadingNetworks,
      networks,
      selectedNetwork,
      setSelectedNetwork,
    }),
    [activeNetwork, isLoadingNetworks, networks, selectedNetwork, setSelectedNetwork]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useAppNetwork() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useAppNetwork must be used within NetworkProvider");
  }

  return context;
}
