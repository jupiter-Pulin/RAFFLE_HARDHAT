const {
    _baseFee,
    _gasPrice,
    _weiPerUnitLink,
    developmentChains,
} = require("../helper-hardhat-config")
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments
    const { firstAccount } = await getNamedAccounts()
    if (developmentChains.includes(network.name)) {
        await deploy("VRFCoordinatorV2_5Mock", {
            from: firstAccount,
            log: true,
            args: [_baseFee, _gasPrice, _weiPerUnitLink],
        })
        console.log("deployed VRFCoordinatorV2_5Mock!!!!!")
    } else {
        console.log("deploy is not on local ,mock contract is skipped...")
    }
    console.log(`------------------------`)
}
module.exports.tags = ["mock", "all"]
