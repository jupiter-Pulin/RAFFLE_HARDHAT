/* 
写在测试前面的话：
我也不知道为什么 。。。有的测试需要用到 VRFCoordinatorV2_5Mock里面的函数，
而有的函数直接用我自己的RAFFLE合约里的代码。。。
希望以后能解决

24.12.28留言：
我发现调用VRFCoordinatorV2_5Mock里面的函数都是在测试fulfillRandomness的时候，
因为fulfillRandomness是chainlink给你返回的值，
而这个值在本地没人给你，所以你要自己模拟传，
而模拟本就是你调用了vrfCoordinator这个合约的函数
那么回到前两个函数：checkUpkeep和performUpkeep，
在代码逻辑中你只要满足了checkUokeep的逻辑条件，你就可以自己仿照chainlink调用performUpkeep
并且automation并没有mock地址合约
*/

const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers } = require("hardhat")
const helpers = require("@nomicfoundation/hardhat-network-helpers")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", function () {
          let Raffle, VRFCoordinatorV2_5Mock, firstAccount, interval, raffleState
          beforeEach(async function () {
              await deployments.fixture(["all"])
              firstAccount = (await getNamedAccounts()).firstAccount

              RaffleAddr = await deployments.get("Raffle")
              Raffle = await ethers.getContractAt("Raffle", RaffleAddr.address)
              const VRFCoordinatorV2_5MockAddr = await deployments.get("VRFCoordinatorV2_5Mock")
              VRFCoordinatorV2_5Mock = await ethers.getContractAt(
                  "VRFCoordinatorV2_5Mock",
                  VRFCoordinatorV2_5MockAddr.address
              )

              interval = await Raffle.getInterval()
          })
          describe("constructor", function () {
              it("Initial values", async function () {
                  raffleState = await Raffle.getRaffleState()
                  const enterFee = await Raffle.enterFeeToRaffle()
                  const enableNativePayment = await Raffle.getEnableNativePayment()
                  assert.equal(interval, networkConfig[network.config.chainId]["interval"])
                  assert.equal(
                      enableNativePayment,
                      networkConfig[network.config.chainId]["enableNativePayment"]
                  )
                  assert.equal(enterFee, networkConfig[network.config.chainId]["enterFee"])
                  assert.equal(raffleState, 0)
              })
          })
          describe("enterRaffle", function () {
              it("Should revert if the user does not pay the fee", async function () {
                  await expect(Raffle.enterRaffle()).to.be.revertedWith(
                      "pleace send at least one enterFee"
                  )
              })

              it("Should enter the raffle", async function () {
                  await Raffle.enterRaffle({ value: ethers.parseEther("0.1") })
                  const player = await Raffle.getPlayers(0)
                  assert.equal(player, firstAccount)
              })
              it("emit event on enterRaffle", async () => {
                  await Raffle.enterRaffle({ value: ethers.parseEther("0.1") })
                  await expect(Raffle.enterRaffle({ value: ethers.parseEther("0.1") }))
                      .to.emit(Raffle, "RaffleEnter")
                      .withArgs(firstAccount)
              })
              it("fund enterFee when state is calculating", async function () {
                  await Raffle.enterRaffle({ value: ethers.parseEther("1") })
                  await helpers.time.increase(interval)
                  await helpers.mine()

                  await Raffle.performUpkeep("0x") //使用performUpkeep的前提就是checkUpkeep返回true，而上面的代码已经确保了这一点
                  raffleState = await Raffle.getRaffleState() //现在raffleState的状态就是 calculating了

                  assert.equal(raffleState, 1)
                  await expect(
                      Raffle.enterRaffle({ value: ethers.parseEther("1") })
                  ).to.be.revertedWith("the raffle is not open")
              })
          })
          describe("checkUpKeep", async () => {
              it("if calculating ,should reverted", async () => {
                  await Raffle.enterRaffle({ value: ethers.parseEther("1") })
                  await helpers.time.increase(interval)
                  await helpers.mine()
                  await Raffle.performUpkeep("0x") //这里也是，没有显式的调用checkUpkeep，但是performUpkeep的前提就是checkUpkeep返回true
                  const { upkeepNeeded } = await Raffle.checkUpkeep("0x")
                  raffleState = await Raffle.getRaffleState() //现在raffleState的状态就是 calculating了
                  assert.equal(raffleState, 1)
                  assert.equal(upkeepNeeded, false)
              })
              it("if time not passed,should reverted", async () => {
                  await Raffle.enterRaffle({ value: ethers.parseEther("1") })
                  await helpers.time.increase(interval - 10n) //确保时间不够，因为是bigNumber，所以要加n,无法进行正常的加减乘除
                  await helpers.mine()

                  await helpers.mine()

                  const { upkeepNeeded } = await Raffle.checkUpkeep("0x")
                  assert.equal(upkeepNeeded, false)
              })
              it("if not on budget,should reverted", async () => {
                  await Raffle.enterRaffle({ value: ethers.parseEther("0.1") })

                  await helpers.time.increase(interval)
                  await helpers.mine()
                  const { upkeepNeeded } = await Raffle.checkUpkeep("0x")
                  assert.equal(upkeepNeeded, false)
              })
              it("if all thing down ,should return true", async () => {
                  await Raffle.enterRaffle({ value: ethers.parseEther("1") })
                  await helpers.time.increase(interval)
                  await helpers.mine()
                  const { upkeepNeeded } = await Raffle.checkUpkeep("0x")
                  assert.equal(upkeepNeeded, true)
              })
          })
          describe("performUpkeep", function () {
              it("reverts if checkup is false", async () => {
                  await expect(Raffle.performUpkeep("0x")).to.be.revertedWith(
                      "upkeepNeeded now is false"
                  )
              })

              it("updates the raffle state and emits a requestId", async () => {
                  await Raffle.enterRaffle({ value: ethers.parseEther("1") })
                  await helpers.time.increase(interval)
                  await helpers.mine()
                  const raffleTx = await Raffle.performUpkeep("0x")
                  const raffleReceipt = await raffleTx.wait()
                  //抓取事件
                  // 使用 VRFCoordinatorV2Mock 的接口解析日志
                  const event = raffleReceipt.logs
                      .filter((log) => log.address === VRFCoordinatorV2_5Mock.target) // 过滤来自 VRFCoordinatorV2Mock 的日志
                      .map((log) => {
                          try {
                              return VRFCoordinatorV2_5Mock.interface.parseLog(log)
                          } catch (e) {
                              return null
                          }
                      })
                      .filter((event) => event && event.name === "RandomWordsRequested")[0]

                  if (event) {
                      requestId = event.args.requestId
                      console.log(`RandomWordsRequested : ${requestId}`)
                  } else {
                      // 如果未找到 RandomWordsRequested 事件，抛出错误
                      throw new Error("未找到 RandomWordsRequested 事件")
                  }
                  raffleState = await Raffle.getRaffleState()
                  assert.equal(raffleState, 1)
                  assert(requestId > 0)
              })
          })

          describe("fulfillRandomness", async () => {
              beforeEach(async () => {
                  await Raffle.enterRaffle({ value: ethers.parseEther("1") })
                  await helpers.time.increase(interval)
                  await helpers.mine()
              })
              it("can only be called afeter preformUpkeep", async () => {
                  await expect(
                      VRFCoordinatorV2_5Mock.fulfillRandomWords(0, RaffleAddr.address)
                  ).to.be.revertedWithCustomError(VRFCoordinatorV2_5Mock, "InvalidRequest")

                  //这是一个自定义错误，需要使用revertedWithCustomError
                  //因为我是本地测试，所以我要模拟chainlink的行为，所以我要使用VRFCoordinatorV2_5Mock，而这些在主网会由chainlink代执行
                  //而fulfillRandomWords如果在Raffle里需要被调用，那么就需要在VRFCoordinatorV2_5Mock里被调用
              })
              /* 我们要等待fulfillRandomness被调用，但由于我们在hardhat本地链，
              所以不需要等待，但我们需要模拟我们确实等待event被调用了，
              为了模拟等待，我们又一次需要配置listner，如果我们配置了linstner，
              我们就不希望测试在“listner”完成监听前就结束
              所以我们有需要创建一个新的promise
              */
              it("picks a winner, resets, and sends money", async () => {
                  const additionalEntrances = 3
                  const startindex = 1 //firstaccount==0
                  const accounts = await ethers.getSigners()
                  const VrfFundAmount = ethers.parseEther("1000")
                  //模拟许多人都来这里投钱抽奖
                  for (let i = 1; i < startindex + additionalEntrances; i++) {
                      await Raffle.connect(accounts[i]).enterRaffle({
                          value: ethers.parseEther("1"),
                      })
                  }
                  await new Promise(async (resolve, reject) => {
                      Raffle.once("WinnerPicked", async () => {
                          console.log(`find winnerPicked !!!!`)
                          try {
                              const endBlockTimeStamp = await Raffle.getLatestTimeStamp()
                              raffleState = await Raffle.getRaffleState()
                              assert.equal(raffleState, 0)
                              assert(endBlockTimeStamp > blockTimeStamp)
                          } catch (e) {
                              reject(e)
                          }
                      })
                      console.log(`1111`)
                      const blockTimeStamp = await Raffle.getLatestTimeStamp()
                      const raffleTx = await Raffle.performUpkeep("0x")
                      const raffleReceipt = await raffleTx.wait()
                      //抓取事件
                      // 使用 VRFCoordinatorV2Mock 的接口解析日志
                      const event = raffleReceipt.logs
                          .filter((log) => log.address === VRFCoordinatorV2_5Mock.target) // 过滤来自 VRFCoordinatorV2Mock 的日志
                          .map((log) => {
                              try {
                                  return VRFCoordinatorV2_5Mock.interface.parseLog(log)
                              } catch (e) {
                                  return null
                              }
                          })
                          .filter((event) => event && event.name === "RandomWordsRequested")[0]
                      if (event) {
                          // 从事件参数中获取订阅 ID
                          requestId = event.args.requestId
                          console.log(`requestId : ${requestId}`)
                      } else {
                          // 如果未找到 RandomWordsRequested 事件，抛出错误
                          throw new Error("未找到 RandomWordsRequested 事件")
                      }
                      console.log(`22222`)
                      try {
                          await VRFCoordinatorV2_5Mock.fulfillRandomWords(requestId, Raffle.target)
                      } catch (e) {
                          console.error("调用 fulfillRandomWords 失败：", e) //我不知道自己错哪里了，或许以后回来可以看一下
                      }
                  })
              })

              /*这看起来好像反过来了，这是因为我们想要配置listner，
              当我们执行触发event方法时，我们的listner会开始激活并进行等待，所以我们要把我们的代码放大promise的内部 */
          })
      })
