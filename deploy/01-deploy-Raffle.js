// 从 Hardhat 中导入网络和 ethers 模块
const { network, ethers } = require("hardhat")
// 导入自定义的网络配置、开发链列表以及确认次数
const { networkConfig, developmentChains, CONFIRMATION } = require("../helper-hardhat-config")

// 导出部署脚本的主要函数
module.exports = async ({ getNamedAccounts, deployments }) => {
    // 从 deployments 中解构出 deploy 函数，用于部署合约
    const { deploy } = deployments
    // 获取命名账户中的 firstAccount，通常是部署者账户
    const { firstAccount } = await getNamedAccounts()
    // 定义为 VRF（可验证随机函数）资金提供的金额，这里设置为 1 个以太币
    const VrfFundAmount = ethers.parseEther("1")
    // 获取当前网络的链 ID
    const chainId = network.config.chainId

    // 声明一些变量，以便后续使用
    let vrfCoordinatorV2Address
    let confirmation
    let subscriptionId
    let VRFCoordinatorV2_5Mock

    // 检查当前网络是否属于开发链（如 localhost, hardhat 网络等）
    if (developmentChains.includes(network.name)) {
        // 获取已部署的 VRFCoordinatorV2_5Mock 合约的部署信息
        const VRFCoordinatorV2_5MockDeployments = await deployments.get("VRFCoordinatorV2_5Mock")
        // 获取 VRFCoordinatorV2_5Mock 合约实例
        VRFCoordinatorV2_5Mock = await ethers.getContractAt(
            "VRFCoordinatorV2_5Mock",
            VRFCoordinatorV2_5MockDeployments.address
        )
        // 调用 createSubscription 创建一个新的订阅
        const VRFCoordinatorV2_5MockTX = await VRFCoordinatorV2_5Mock.createSubscription()
        console.log(`VRFCoordinatorV2_5MockTX: ${VRFCoordinatorV2_5MockTX.hash}`)
        // 等待交易被挖矿并获取交易回执
        const VRFCoordinatorV2_5MockReceipt = await VRFCoordinatorV2_5MockTX.wait()

        // 解析交易回执中的日志，查找 SubscriptionCreated 事件,该函数在subscripionAPI合约中，最终传了一个事件，里面的参数是SubID
        const event = VRFCoordinatorV2_5MockReceipt.logs
            .map((log) => {
                try {
                    // 尝试解析日志，若成功则返回事件对象
                    return VRFCoordinatorV2_5Mock.interface.parseLog(log)
                } catch (e) {
                    // 如果日志不是来自 VRFCoordinatorV2_5Mock 合约，忽略该日志
                    return null
                }
            })
            // 过滤出名称为 "SubscriptionCreated" 的事件，并取第一个匹配的事件
            .filter((event) => event && event.name === "SubscriptionCreated")[0]

        if (event) {
            // 从事件参数中获取订阅 ID
            subscriptionId = event.args.subId
            console.log(`Subscription ID: ${subscriptionId}`)
        } else {
            // 如果未找到 SubscriptionCreated 事件，抛出错误
            throw new Error("未找到 SubscriptionCreated 事件")
        }

        // 向订阅中添加资金，以便 VRF 可以使用,因为chainlink在返回随机数的时候需要消耗link
        await VRFCoordinatorV2_5Mock.fundSubscription(subscriptionId, VrfFundAmount)
        console.log(`VRFCoordinatorV2_5Mock 已资助 ${VrfFundAmount} `)
        // 设置 VRFCoordinatorV2 的地址为 Mock 合约的地址
        vrfCoordinatorV2Address = VRFCoordinatorV2_5MockDeployments.address
        console.log(`VRFCoordinatorV2_5Mock 地址: ${vrfCoordinatorV2Address}`)
        // 在开发链上，确认次数设置为 0，加快部署速度
        confirmation = 0
    } else {
        // 对于非开发链，从网络配置中获取 VRFCoordinatorV2 的地址
        vrfCoordinatorV2Address = networkConfig[network.config.chainId].vrfCoordinator
        // 设置确认次数为预定义的 CONFIRMATION 值
        confirmation = CONFIRMATION
        // 从网络配置中获取已有的订阅 ID
        subscriptionId = networkConfig[network.config.chainId]["subscriptionId"]
        console.log(`VRFCoordinatorV2 地址: ${vrfCoordinatorV2Address}`)
        console.log(`订阅 ID: ${subscriptionId}`)
    }

    // 准备传递给 Raffle 合约的构造函数参数
    const arguments = [
        networkConfig[chainId]["enterFee"], // 参与费用
        subscriptionId, // VRF 订阅 ID
        networkConfig[chainId]["enableNativePayment"], // 是否启用原生支付
        networkConfig[chainId]["interval"], // 时间间隔
        vrfCoordinatorV2Address, // VRFCoordinatorV2 地址
        networkConfig[chainId]["keyHash"], // VRF 密钥哈希
        networkConfig[chainId]["callbackGasLimit"], // 回调函数的 Gas 限制
    ]

    // 部署 Raffle 合约
    const raffle = await deploy("Raffle", {
        from: firstAccount, // 使用第一个账户进行部署
        log: true, // 启用部署日志输出
        args: arguments, // 传递给构造函数的参数
        waitConfirmations: confirmation, // 等待的确认次数
    })
    if (developmentChains.includes(network.name)) {
        // 将 Raffle 合约地址添加为订阅的消费者，确保它可以调用 VRF 服务
        await VRFCoordinatorV2_5Mock.addConsumer(subscriptionId, raffle.address)
    } else {
        console.log(
            `network is not on local, addConsumer is skipped...,bescase subId is add on chainlink`
        )
    }

    console.log("Raffle 合约已成功部署!!!!")
    console.log("-----------------------")
    console.log("-----------------------")
    console.log("-----------------------")
    if (hre.network.config.chainId == 11155111 && process.env.ETHERSCAN_API_KEY) {
        // 等待几秒钟后再验证
        console.log(`wait etherscan 收到api调用,我们等待60s`)
        await new Promise((resolve) => setTimeout(resolve, 60000)) // 等待6秒

        // 验证合约
        await hre.run("verify:verify", {
            address: raffle.address,
            constructorArguments: arguments,
        })
    } else {
        console.log(`network is not Ethereum network, verify is skipped...`)
    }
}
// 为部署脚本添加标签，便于通过标签筛选和运行特定的部署脚本
module.exports.tags = ["Raffle", "all"]
