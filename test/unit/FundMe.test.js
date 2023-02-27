const { assert, expect } = require("chai");
const { deployments, getNamedAccounts, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", () => {
          let fundMe;
          let mockV3Aggregator;
          let deployer;
          const msgValue = ethers.utils.parseEther("1");
          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              fundMe = await ethers.getContract("FundMe", deployer);
              mockV3Aggregator = await ethers.getContract("MockV3Aggregator", deployer);
          });

          describe("constructor", () => {
              it("sets the aggregator addresses correctly", async () => {
                  const response = await fundMe.getPriceFeed();
                  assert.equal(response, mockV3Aggregator.address);
              });
          });

          describe("fund", () => {
              it("Fails if you don't sent enough ETH", async () => {
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "You need to spend more ETH!"
                  );
              });
              it("Checking if mapping works correctly", async () => {
                  await fundMe.fund({ value: msgValue });
                  const response = await fundMe.getAddressToamountFunded(deployer);
                  assert.equal(response.toString(), msgValue.toString());
              });
              it("Is funders array updating?", async () => {
                  await fundMe.fund({ value: msgValue });
                  const response = await fundMe.getFunder(0);
                  assert.equal(response, deployer);
              });
          });
          describe("withdraw", () => {
              beforeEach(async () => {
                  await fundMe.fund({ value: msgValue });
              });
              it("withdraw eth", async () => {
                  const startingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  );
                  const startingDeployerBalance = await fundMe.provider.getBalance(deployer);

                  const transaction = await fundMe.withdraw();
                  const transactionReceipt = await transaction.wait(1);
                  const { gasUsed, effectiveGasPrice } = transactionReceipt;
                  const gasCost = gasUsed.mul(effectiveGasPrice);

                  const endingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
                  const endingDeployerBalance = await fundMe.provider.getBalance(deployer);

                  assert.equal(endingFundMeBalance, 0);
                  assert.equal(
                      startingDeployerBalance.add(startingFundMeBalance).toString(),
                      endingDeployerBalance.add(gasCost).toString()
                  );
              });
              it("Withdraw after multiple funders fund", async () => {
                  const accounts = await ethers.getSigners();
                  for (let i = 2; i < 7; i++) {
                      const fundMeConnectedAccounts = await fundMe.connect(accounts[i]);
                      await fundMeConnectedAccounts.fund({ value: msgValue });
                  }
                  await fundMe.withdraw();
                  const endingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
                  assert.equal(endingFundMeBalance, 0);

                  await expect(fundMe.getFunder(2)).to.be.reverted;

                  for (i = 2; i < 7; i++) {
                      assert.equal(
                          await fundMe.getAddressToamountFunded(accounts[i].address),
                          0
                      );
                  }
              });
              it("modifier", async () => {
                  const accounts = await ethers.getSigners();
                  const fakeUser = accounts[2];
                  const fundMeConnectedFakeUser = await fundMe.connect(fakeUser);
                  await expect(fundMeConnectedFakeUser.withdraw()).to.be.revertedWith(
                      "FundMe__NotOwner"
                  );
              });
          });
      });
