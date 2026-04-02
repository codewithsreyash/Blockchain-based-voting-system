module.exports = {
  solidity: "0.8.24",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: Number(process.env.LOCAL_DEMO_CHAIN_ID || 31337),
    },
  },
};
