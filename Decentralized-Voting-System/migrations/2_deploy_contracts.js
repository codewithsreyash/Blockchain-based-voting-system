const path = require("path");
const dotenv = require("dotenv");
const Voting = artifacts.require("Voting");

dotenv.config({ path: path.resolve(__dirname, "../backend/.env") });

module.exports = async function (deployer, network, accounts) {
  const normalizedPrivateKey =
    process.env.ADMIN_PRIVATE_KEY && !process.env.ADMIN_PRIVATE_KEY.startsWith("0x")
      ? `0x${process.env.ADMIN_PRIVATE_KEY}`
      : process.env.ADMIN_PRIVATE_KEY;

  const configuredAdminAddress =
    process.env.INITIAL_ADMIN_ADDRESS ||
    (normalizedPrivateKey ? web3.eth.accounts.privateKeyToAccount(normalizedPrivateKey).address : null);

  const initialAdmin = configuredAdminAddress || accounts[0];

  console.log(`Deploying Voting with initial admin ${initialAdmin}`);
  await deployer.deploy(Voting, initialAdmin);
};
