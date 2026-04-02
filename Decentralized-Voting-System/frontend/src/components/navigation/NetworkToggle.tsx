"use client";

import type { AppNetwork } from "../../lib/types";
import { useAppNetwork } from "../../providers/network-provider";

const networkOrder: AppNetwork[] = ["amoy", "local"];

export function NetworkToggle() {
  const { activeNetwork, isLoadingNetworks, networks, selectedNetwork, setSelectedNetwork } = useAppNetwork();

  return (
    <div className="network-switcher">
      <div className="row-between">
        <span className="section-label">Network</span>
        <span className={`state-chip ${selectedNetwork === "local" ? "upcoming" : "live"}`}>
          {selectedNetwork === "local" ? "Demo Mode" : "Production"}
        </span>
      </div>

      <div className="pill-row">
        {networkOrder.map((networkKey) => {
          const network = networks[networkKey];

          return (
            <button
              className={`pill ${selectedNetwork === networkKey ? "active" : ""}`}
              key={networkKey}
              type="button"
              onClick={() => setSelectedNetwork(networkKey)}
            >
              <strong>{network.label}</strong>
              <span className="pill-caption">{network.mode === "demo" ? "Free demo chain" : "Live Amoy contract"}</span>
            </button>
          );
        })}
      </div>

      <p className="muted network-note">
        {isLoadingNetworks
          ? "Checking backend network status..."
          : activeNetwork.note || `Contract: ${activeNetwork.contractAddress || "Starting demo deployment..."}`}
      </p>
    </div>
  );
}
