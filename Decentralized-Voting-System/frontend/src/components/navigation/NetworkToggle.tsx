"use client";

import { useAppNetwork } from "../../providers/network-provider";

export function NetworkToggle() {
  const { activeNetwork, isLoadingNetworks, selectedNetwork, setSelectedNetwork } = useAppNetwork();

  return (
    <div className="network-switcher">
      <div className="network-mode-label">
        <span className="network-mode-title">Network</span>
        <div className="network-live-status">
          <span className={`pulse-dot ${selectedNetwork === "local" ? "amber" : ""}`}></span>
          <span>{selectedNetwork === "local" ? "Demo Node" : "Active Main"}</span>
        </div>
      </div>

      <div className="pill-row">
        <button
          className={`pill ${selectedNetwork === "amoy" ? "active" : ""}`}
          type="button"
          onClick={() => setSelectedNetwork("amoy")}
          title="Polygon Amoy Live Testnet"
        >
          <span>Polygon Amoy</span>
          <span className="pill-badge">Live</span>
        </button>

        <button
          className={`pill ${selectedNetwork === "local" ? "active" : ""}`}
          type="button"
          onClick={() => setSelectedNetwork("local")}
          title="Demo Hardhat Chain with Free Demo ETH"
        >
          <span>Demo Hardhat</span>
          <span className="pill-badge">Free ETH</span>
        </button>
      </div>
    </div>
  );
}
