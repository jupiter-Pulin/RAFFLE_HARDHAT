require("@nomicfoundation/hardhat-toolbox")
require("hardhat-deploy")
require("@chainlink/env-enc").config()
/** @type import('hardhat/config').HardhatUserConfig */
const SEPOLIA_URL = process.env.SEPOLIA_URL
const PRIVATE_KEY01 = process.env.PRIVATE_KEY01
const PRIVATE_KEY02 = process.env.PRIVATE_KEY02
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
module.exports = {
    solidity: "0.8.28",
    namedAccounts: {
        firstAccount: {
            default: 0,
        },
        secoundAccount: {
            default: 1,
        },
    },
    networks: {
        hardhat: {
            chainId: 1337,
        },
        sepolia: {
            url: SEPOLIA_URL,
            accounts: [PRIVATE_KEY01, PRIVATE_KEY02],

            chainId: 11155111,
        },
    },
    gasReporter: {
        enabled: false,
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
    mocha: {
        timeout: 300000,
    },
}
