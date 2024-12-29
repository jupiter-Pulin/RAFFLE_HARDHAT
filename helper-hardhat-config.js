const { ethers } = require("hardhat")

const CONFIRMAION = 3
//mock合约 部署参数
const _baseFee = ethers.parseEther("0.1")
const _gasPrice = 1e9
const _weiPerUnitLink = 500000
const networkConfig = {
    11155111: {
        name: "sepolia",
        vrfCoordinator: "0x9ddfaca8183c41ad55329bdeed9f6a8d53168b1b",
        enterFee: ethers.parseEther("0.1"),
        keyHash: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
        interval: "39",
        callbackGasLimit: `500000`,
        enableNativePayment: false,
        subscriptionId:
            "71038342698641640251546232328411716251635661876714968365279827331554696549765",
    },
    1337: {
        name: "localhost",
        enterFee: ethers.parseEther("0.1"),
        keyHash: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
        interval: `500`,
        callbackGasLimit: `500000`,
        enableNativePayment: false,
    },
}
developmentChains = ["hardhat", "localhost"]
module.exports = {
    networkConfig,
    developmentChains,
    CONFIRMAION,
    _baseFee,
    _gasPrice,
    _weiPerUnitLink,
}
