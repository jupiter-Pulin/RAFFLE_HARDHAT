const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers } = require("hardhat")

const { developmentChains, networkConfig } = require("../../../helper-hardhat-config")
developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", function () {
          let Raffle, firstAccount, secoundAccount, balance
          beforeEach(async function () {
              firstAccount = (await getNamedAccounts()).firstAccount
              secoundAccount = (await getNamedAccounts()).secoundAccount

              RaffleAddr = await deployments.get("Raffle")
              Raffle = await ethers.getContractAt("Raffle", RaffleAddr.address)
          })
          describe("STAGING TEST", function () {
              it("final test for picked the winner", async () => {
                  await new Promise(async (resolve, reject) => {
                      Raffle.once("WinnerPicked", async () => {
                          try {
                              const raffleState = await Raffle.getRaffleState()
                              const playerNumber = await Raffle.getNumberofPlayers()
                              const lastTimestamp = await Raffle.getLatestTimeStamp()
                              const interval = await Raffle.getInterval()
                              balance = await Raffle.getContractBalance()

                              assert.equal(raffleState, 0)
                              assert.equal(balance, 0)
                              assert.equal(playerNumber, 0)
                              assert(lastTimestamp > startTimeStamp + interval)
                          } catch (e) {
                              reject(e)
                          }
                      })
                      const startTimeStamp = await Raffle.getLatestTimeStamp()
                      await Raffle.enterRaffle({ value: ethers.parseEther("0.51") })

                      Raffle.connect(await ethers.getSigner(secoundAccount)).enterRaffle({
                          value: ethers.parseEther("0.09"),
                      })
                  })
              })
          })
      })
