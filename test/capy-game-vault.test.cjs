const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const E = (n) => ethers.parseUnits(String(n), 18);

const ECON = {
  ticket: E(20_000),
  reviveCost: E(20_000),
  itemCost: E(5_000),
  baseRewardBps: 18_000, // 1.8 倍门票 = 36,000
  tierBonusBps: 1_000, // 每档 +10% 门票 = +2,000
  tierBonusCapBps: 2_000, // 封顶 +20% → 最高 40,000
};
const PER_PLAYER_DAY = E(200_000);
const GLOBAL_DAY = E(5_000_000);
const SIG_VALIDITY = 600;
const BURN = "0x000000000000000000000000000000000000dEaD";

describe("CapyGameVault", function () {
  let token, vault, owner, signerWallet, alice, bob, carol, chainId;

  async function sign(player, tier, reward, nonce, deadline, who = signerWallet) {
    const digest = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "address", "uint256", "uint256", "uint256", "uint256"],
        [chainId, await vault.getAddress(), player, tier, reward, nonce, deadline],
      ),
    );
    return who.signMessage(ethers.getBytes(digest));
  }

  async function claimArgs(player, tier) {
    const reward = await vault.rewardOf(tier);
    const nonce = await vault.nonces(player);
    const deadline = (await time.latest()) + SIG_VALIDITY;
    const sig = await sign(player, tier, reward, nonce, deadline);
    return { reward, nonce, deadline, sig };
  }

  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();
    signerWallet = ethers.Wallet.createRandom();
    chainId = (await ethers.provider.getNetwork()).chainId;

    const Token = await ethers.getContractFactory("FixedSupplyToken");
    token = await Token.deploy("Capybara", "CAPY", 1_000_000_000n);

    const Vault = await ethers.getContractFactory("CapyGameVault");
    vault = await Vault.deploy(
      await token.getAddress(),
      owner.address,
      signerWallet.address,
      ECON,
      PER_PLAYER_DAY,
      GLOBAL_DAY,
      SIG_VALIDITY,
    );

    for (const who of [alice, bob, carol]) {
      await token.transfer(who.address, E(1_000_000));
      await token.connect(who).approve(await vault.getAddress(), ethers.MaxUint256);
    }
    await token.approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.fundPool(E(10_000_000));
  });

  describe("规则数值", function () {
    it("奖励阶梯：36000 / 38000 / 40000，之后封顶", async function () {
      expect(await vault.rewardOf(0)).to.equal(E(36_000));
      expect(await vault.rewardOf(1)).to.equal(E(38_000));
      expect(await vault.rewardOf(2)).to.equal(E(40_000));
      expect(await vault.rewardOf(3)).to.equal(E(40_000));
      expect(await vault.rewardOf(100)).to.equal(E(40_000));
    });

    it("奖励永远不超过门票的 2 倍（硬上限）", async function () {
      const cap = await vault.MAX_TOTAL_REWARD_BPS();
      expect(cap).to.equal(20_000);
      expect(await vault.rewardOf(9999)).to.be.at.most(ECON.ticket * 2n);
    });

    it("关卡区间：tier0 = 2~11，tier1 = 12~21", async function () {
      let [a, b] = await vault.levelRangeOf(0);
      expect([a, b]).to.deep.equal([2n, 11n]);
      [a, b] = await vault.levelRangeOf(1);
      expect([a, b]).to.deep.equal([12n, 21n]);
    });

    it("第 1 关免费，第 2 关起进档位", async function () {
      let [tier, paid] = await vault.tierOfLevel(1);
      expect(paid).to.equal(false);
      [tier, paid] = await vault.tierOfLevel(2);
      expect([tier, paid]).to.deep.equal([0n, true]);
      [tier, paid] = await vault.tierOfLevel(11);
      expect([tier, paid]).to.deep.equal([0n, true]);
      [tier, paid] = await vault.tierOfLevel(12);
      expect([tier, paid]).to.deep.equal([1n, true]);
    });
  });

  describe("进场 / 复活 / 道具 / 放弃", function () {
    it("进场扣门票并 100% 进奖池", async function () {
      const poolBefore = await vault.poolBalance();
      await expect(vault.connect(alice).enterTier())
        .to.emit(vault, "TierEntered")
        .withArgs(alice.address, 0, ECON.ticket, 2);
      expect(await vault.poolBalance()).to.equal(poolBefore + ECON.ticket);
      expect(await vault.totalTicketsIn()).to.equal(ECON.ticket);
      const run = await vault.runs(alice.address);
      expect(run.active).to.equal(true);
      expect(run.ticketsPaid).to.equal(1);
    });

    it("同一玩家不能重复进场", async function () {
      await vault.connect(alice).enterTier();
      await expect(vault.connect(alice).enterTier()).to.be.revertedWithCustomError(
        vault,
        "RunAlreadyActive",
      );
    });

    it("复活：加计一张门票，钱同样进奖池，进度不清零", async function () {
      await vault.connect(alice).enterTier();
      const poolBefore = await vault.poolBalance();
      await expect(vault.connect(alice).revive())
        .to.emit(vault, "Revived")
        .withArgs(alice.address, 0, ECON.reviveCost, 2);
      expect(await vault.poolBalance()).to.equal(poolBefore + ECON.reviveCost);
      expect((await vault.runs(alice.address)).ticketsPaid).to.equal(2);
      expect((await vault.runs(alice.address)).tier).to.equal(0);
    });

    it("没进场不能复活 / 用道具", async function () {
      await expect(vault.connect(alice).revive()).to.be.revertedWithCustomError(vault, "NoActiveRun");
      await expect(vault.connect(alice).useItem()).to.be.revertedWithCustomError(vault, "NoActiveRun");
    });

    it("道具费 40% 销毁，60% 进奖池", async function () {
      await vault.connect(alice).enterTier();
      const poolBefore = await vault.poolBalance();
      const burnBefore = await token.balanceOf(BURN);
      const burnAmount = (ECON.itemCost * 4_000n) / 10_000n;
      const poolAmount = ECON.itemCost - burnAmount;
      await expect(vault.connect(alice).useItem())
        .to.emit(vault, "ItemUsed")
        .withArgs(alice.address, ECON.itemCost, burnAmount, poolAmount);
      expect(await token.balanceOf(BURN)).to.equal(burnBefore + burnAmount);
      expect(await vault.poolBalance()).to.equal(poolBefore + poolAmount);
      expect(await vault.totalBurned()).to.equal(burnAmount);
      expect(await vault.totalItemToPool()).to.equal(poolAmount);
    });

    it("放弃闯关：门票留在奖池不退，可以重新进场", async function () {
      await vault.connect(alice).enterTier();
      const pool = await vault.poolBalance();
      await expect(vault.connect(alice).abandonRun())
        .to.emit(vault, "RunAbandoned")
        .withArgs(alice.address, 0, 1);
      expect(await vault.poolBalance()).to.equal(pool);
      expect((await vault.runs(alice.address)).active).to.equal(false);
      await vault.connect(alice).enterTier(); // 能再进
      expect((await vault.runs(alice.address)).tier).to.equal(0); // 还是 tier 0
    });
  });

  describe("领奖", function () {
    it("正常路径：拿到奖励、档位推进、nonce 递增、run 清空", async function () {
      await vault.connect(alice).enterTier();
      const { reward, nonce, deadline, sig } = await claimArgs(alice.address, 0);
      const balBefore = await token.balanceOf(alice.address);

      await expect(vault.connect(alice).claimReward(0, nonce, deadline, sig))
        .to.emit(vault, "RewardClaimed")
        .withArgs(alice.address, 0, reward, 1, nonce);

      expect(await token.balanceOf(alice.address)).to.equal(balBefore + reward);
      expect(await vault.nextTier(alice.address)).to.equal(1);
      expect(await vault.nonces(alice.address)).to.equal(nonce + 1n);
      expect((await vault.runs(alice.address)).active).to.equal(false);
      expect(await vault.totalRewardsOut()).to.equal(reward);
    });

    it("连过两档：第二档奖励变 38000", async function () {
      await vault.connect(alice).enterTier();
      let a = await claimArgs(alice.address, 0);
      await vault.connect(alice).claimReward(0, a.nonce, a.deadline, a.sig);

      await vault.connect(alice).enterTier();
      expect((await vault.runs(alice.address)).tier).to.equal(1);
      a = await claimArgs(alice.address, 1);
      expect(a.reward).to.equal(E(38_000));
      await vault.connect(alice).claimReward(1, a.nonce, a.deadline, a.sig);
      expect(await vault.nextTier(alice.address)).to.equal(2);
    });

    it("★ 没进场（没付门票）拿着有效签名也领不到", async function () {
      const { nonce, deadline, sig } = await claimArgs(alice.address, 0);
      await expect(
        vault.connect(alice).claimReward(0, nonce, deadline, sig),
      ).to.be.revertedWithCustomError(vault, "NoActiveRun");
    });

    it("★ 档位对不上领不到（拿 tier1 的签名去领 tier0 的场）", async function () {
      await vault.connect(alice).enterTier(); // tier 0
      const reward = await vault.rewardOf(1);
      const nonce = await vault.nonces(alice.address);
      const deadline = (await time.latest()) + SIG_VALIDITY;
      const sig = await sign(alice.address, 1, reward, nonce, deadline);
      await expect(vault.connect(alice).claimReward(1, nonce, deadline, sig))
        .to.be.revertedWithCustomError(vault, "TierMismatch")
        .withArgs(0, 1);
    });

    it("★ 伪造签名领不到（别的私钥签的）", async function () {
      await vault.connect(alice).enterTier();
      const reward = await vault.rewardOf(0);
      const nonce = await vault.nonces(alice.address);
      const deadline = (await time.latest()) + SIG_VALIDITY;
      const fake = ethers.Wallet.createRandom();
      const sig = await sign(alice.address, 0, reward, nonce, deadline, fake);
      await expect(
        vault.connect(alice).claimReward(0, nonce, deadline, sig),
      ).to.be.revertedWithCustomError(vault, "BadSignature");
    });

    it("★ 别人的签名自己不能用", async function () {
      await vault.connect(alice).enterTier();
      await vault.connect(bob).enterTier();
      const reward = await vault.rewardOf(0);
      const nonce = await vault.nonces(bob.address);
      const deadline = (await time.latest()) + SIG_VALIDITY;
      const sigForBob = await sign(bob.address, 0, reward, nonce, deadline);
      await expect(
        vault.connect(alice).claimReward(0, nonce, deadline, sigForBob),
      ).to.be.revertedWithCustomError(vault, "BadSignature");
    });

    it("★ 签名过期领不到", async function () {
      await vault.connect(alice).enterTier();
      const reward = await vault.rewardOf(0);
      const nonce = await vault.nonces(alice.address);
      const deadline = (await time.latest()) + 60;
      const sig = await sign(alice.address, 0, reward, nonce, deadline);
      await time.increase(120);
      await expect(
        vault.connect(alice).claimReward(0, nonce, deadline, sig),
      ).to.be.revertedWithCustomError(vault, "SignatureExpired");
    });

    it("★ 同一个签名不能重放（nonce 已经推进）", async function () {
      await vault.connect(alice).enterTier();
      const a = await claimArgs(alice.address, 0);
      await vault.connect(alice).claimReward(0, a.nonce, a.deadline, a.sig);
      await vault.connect(alice).enterTier();
      await expect(vault.connect(alice).claimReward(0, a.nonce, a.deadline, a.sig))
        .to.be.revertedWithCustomError(vault, "TierMismatch")
        .withArgs(1, 0);
    });
  });

  describe("风控上限（签名密钥泄露时的止损）", function () {
    it("每人每日额度封顶", async function () {
      await vault.setLimits(E(38_000), GLOBAL_DAY, SIG_VALIDITY); // 一天只够领一次
      await vault.connect(alice).enterTier();
      let a = await claimArgs(alice.address, 0);
      await vault.connect(alice).claimReward(0, a.nonce, a.deadline, a.sig); // 36000，通过

      await vault.connect(alice).enterTier();
      a = await claimArgs(alice.address, 1);
      expect(a.reward).to.equal(E(38_000)); // 36000 + 38000 > 38000 上限
      await expect(
        vault.connect(alice).claimReward(1, a.nonce, a.deadline, a.sig),
      ).to.be.revertedWithCustomError(vault, "DailyLimitPlayer");

      await time.increase(24 * 3600); // 第二天额度重置
      a = await claimArgs(alice.address, 1);
      await expect(vault.connect(alice).claimReward(1, a.nonce, a.deadline, a.sig)).to.emit(
        vault,
        "RewardClaimed",
      );
    });

    it("全局每日额度封顶", async function () {
      await vault.setLimits(PER_PLAYER_DAY, E(36_000), SIG_VALIDITY);
      await vault.connect(alice).enterTier();
      const a = await claimArgs(alice.address, 0);
      await vault.connect(alice).claimReward(0, a.nonce, a.deadline, a.sig);

      await vault.connect(bob).enterTier();
      const b = await claimArgs(bob.address, 0);
      await expect(
        vault.connect(bob).claimReward(0, b.nonce, b.deadline, b.sig),
      ).to.be.revertedWithCustomError(vault, "DailyLimitGlobal");
    });

    it("奖池不够时明确报 InsufficientPool，而不是莫名 revert", async function () {
      // 把奖池抽干（走时间锁）
      await vault.requestWithdraw(owner.address, await vault.poolBalance());
      await time.increase(24 * 3600 + 1);
      await vault.executeWithdraw();
      expect(await vault.poolBalance()).to.equal(0);

      await vault.connect(alice).enterTier(); // 门票又进来一点，但不够 36000
      const a = await claimArgs(alice.address, 0);
      await expect(
        vault.connect(alice).claimReward(0, a.nonce, a.deadline, a.sig),
      ).to.be.revertedWithCustomError(vault, "InsufficientPool");
    });
  });

  describe("参数护栏", function () {
    it("奖励总倍率不能超过 2 倍门票", async function () {
      await expect(
        vault.setEconomics({ ...ECON, baseRewardBps: 19_000, tierBonusCapBps: 2_000 }),
      ).to.be.revertedWithCustomError(vault, "RewardOverCap");
      // 刚好 2.0 倍可以
      await vault.setEconomics({ ...ECON, baseRewardBps: 18_000, tierBonusCapBps: 2_000 });
    });

    it("复活费不能低于门票的一半", async function () {
      await expect(
        vault.setEconomics({ ...ECON, reviveCost: E(9_999) }),
      ).to.be.revertedWithCustomError(vault, "ReviveTooCheap");
      await vault.setEconomics({ ...ECON, reviveCost: E(10_000) }); // 刚好一半可以
    });

    it("只有 owner 能改参数", async function () {
      await expect(vault.connect(alice).setEconomics(ECON)).to.be.revertedWithCustomError(
        vault,
        "OwnableUnauthorizedAccount",
      );
      await expect(vault.connect(alice).setSigner(alice.address)).to.be.revertedWithCustomError(
        vault,
        "OwnableUnauthorizedAccount",
      );
    });

    it("换 signer 后旧签名立刻失效", async function () {
      await vault.connect(alice).enterTier();
      const a = await claimArgs(alice.address, 0);
      await vault.setSigner(bob.address);
      await expect(
        vault.connect(alice).claimReward(0, a.nonce, a.deadline, a.sig),
      ).to.be.revertedWithCustomError(vault, "BadSignature");
    });
  });

  describe("暂停", function () {
    it("暂停后不能进场/复活/领奖，但能放弃退出", async function () {
      await vault.connect(alice).enterTier();
      await vault.pause();
      await expect(vault.connect(bob).enterTier()).to.be.revertedWithCustomError(vault, "EnforcedPause");
      await expect(vault.connect(alice).revive()).to.be.revertedWithCustomError(vault, "EnforcedPause");
      await vault.connect(alice).abandonRun(); // 放弃不受暂停限制
      await vault.unpause();
      await vault.connect(bob).enterTier();
    });
  });

  describe("奖池提取时间锁", function () {
    it("申请后 24 小时内不能执行", async function () {
      await vault.requestWithdraw(owner.address, E(1_000));
      await expect(vault.executeWithdraw()).to.be.revertedWithCustomError(vault, "TimelockNotReady");
      await time.increase(24 * 3600 + 1);
      const before = await token.balanceOf(owner.address);
      await expect(vault.executeWithdraw()).to.emit(vault, "WithdrawExecuted");
      expect(await token.balanceOf(owner.address)).to.equal(before + E(1_000));
    });

    it("可以取消，取消后不能执行", async function () {
      await vault.requestWithdraw(owner.address, E(1_000));
      await vault.cancelWithdraw();
      await time.increase(24 * 3600 + 1);
      await expect(vault.executeWithdraw()).to.be.revertedWithCustomError(vault, "NothingPending");
    });

    it("游戏代币不能走 rescueERC20 绕过时间锁", async function () {
      await expect(
        vault.rescueERC20(await token.getAddress(), owner.address, E(1)),
      ).to.be.revertedWithCustomError(vault, "CannotRescueGameToken");
    });
  });

  describe("端到端：一个玩家打三档", function () {
    it("账目对得上（门票全进池、道具 40% 销毁 60% 进池、奖励从池出）", async function () {
      const poolStart = await vault.poolBalance();
      const burnStart = await token.balanceOf(BURN);
      let ticketsIn = 0n;
      let rewardsOut = 0n;
      let burned = 0n;
      let itemToPool = 0n;

      for (let tier = 0; tier < 3; tier++) {
        await vault.connect(alice).enterTier();
        ticketsIn += ECON.ticket;
        await vault.connect(alice).revive(); // 死一次
        ticketsIn += ECON.reviveCost;
        await vault.connect(alice).useItem(); // 用一个道具
        burned += (ECON.itemCost * 4_000n) / 10_000n;
        itemToPool += ECON.itemCost - (ECON.itemCost * 4_000n) / 10_000n;

        const a = await claimArgs(alice.address, tier);
        await vault.connect(alice).claimReward(tier, a.nonce, a.deadline, a.sig);
        rewardsOut += a.reward;
      }

      expect(await vault.totalTicketsIn()).to.equal(ticketsIn);
      expect(await vault.totalRewardsOut()).to.equal(rewardsOut);
      expect(await vault.totalBurned()).to.equal(burned);
      expect(await vault.totalItemToPool()).to.equal(itemToPool);
      expect(await token.balanceOf(BURN)).to.equal(burnStart + burned);
      expect(await vault.poolBalance()).to.equal(poolStart + ticketsIn + itemToPool - rewardsOut);
      expect(await vault.nextTier(alice.address)).to.equal(3);

      // 玩家总付出 135000；销毁 9000；门票 120000 + 道具进池 9000 = 129000 进池；奖励出池 114000
      expect(ticketsIn + burned + itemToPool).to.equal(E(135_000));
      expect(rewardsOut).to.equal(E(114_000));
      expect(ticketsIn + itemToPool - rewardsOut).to.equal(E(15_000));
    });
  });

  describe("签到与排行榜", function () {
    async function signLeaderboard(player, epochId, rank, amount, nonce, deadline, who = signerWallet) {
      const digest = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256", "address", "address", "uint256", "uint8", "uint256", "uint256", "uint256"],
          [chainId, await vault.getAddress(), player, epochId, rank, amount, nonce, deadline],
        ),
      );
      return who.signMessage(ethers.getBytes(digest));
    }

    it("签到支付 10000 代币，解锁 7 天有效期", async function () {
      const poolBefore = await vault.poolBalance();
      const cost = await vault.CHECK_IN_COST();
      const now = BigInt(await time.latest());
      await expect(vault.connect(alice).checkIn()).to.emit(vault, "CheckIn");
      expect(await vault.poolBalance()).to.equal(poolBefore + cost);
      expect(await vault.totalCheckIn()).to.equal(cost);
      const expiry = await vault.checkInExpiresAt(alice.address);
      expect(expiry).to.be.gt(now);
      expect(expiry).to.be.closeTo(now + 7n * 24n * 3600n, 60);
    });

    it("排行榜奖励：#1 5%、#2 2%、#3 1%，epoch 结束后可领", async function () {
      const epoch = await vault.currentEpoch();

      // 先让当前 epoch 结束，并提高日限额以便测试大额排行榜奖励
      await time.increase(24 * 3600 + 1);
      await vault.setLimits(E(10_000_000), E(10_000_000), SIG_VALIDITY);

      let totalOut = 0n;
      // 三个名次必须是三个不同的地址（同一 epoch 一人只能领一个名次）
      for (const [who, rank] of [[alice, 1], [bob, 2], [carol, 3]]) {
        const pool = await vault.poolBalance();
        const amount = (pool * BigInt(await vault.leaderboardRewardCap(rank))) / 10_000n;
        const nonce = await vault.nonces(who.address);
        const deadline = (await time.latest()) + SIG_VALIDITY;
        const sig = await signLeaderboard(who.address, Number(epoch), rank, amount, nonce, deadline);
        await vault.connect(who).claimLeaderboardReward(epoch, rank, amount, nonce, deadline, sig);
        expect(await vault.leaderboardWinner(epoch, rank)).to.equal(who.address);
        totalOut += amount;
      }

      expect(await vault.totalRewardsOut()).to.equal(totalOut);
    });

    it("★ 同一个名次只能被领走一次（修掉的漏洞）", async function () {
      const epoch = await vault.currentEpoch();
      await time.increase(24 * 3600 + 1);
      await vault.setLimits(E(10_000_000), E(10_000_000), SIG_VALIDITY);

      const pool = await vault.poolBalance();
      const amount = (pool * 500n) / 10_000n; // 第 1 名 5%

      // alice 先领第 1 名
      let nonce = await vault.nonces(alice.address);
      let deadline = (await time.latest()) + SIG_VALIDITY;
      let sig = await signLeaderboard(alice.address, Number(epoch), 1, amount, nonce, deadline);
      await vault.connect(alice).claimLeaderboardReward(epoch, 1, amount, nonce, deadline, sig);

      // bob 拿着同样有效的签名也来领第 1 名 → 必须被拒
      nonce = await vault.nonces(bob.address);
      deadline = (await time.latest()) + SIG_VALIDITY;
      const amount2 = ((await vault.poolBalance()) * 500n) / 10_000n;
      sig = await signLeaderboard(bob.address, Number(epoch), 1, amount2, nonce, deadline);
      await expect(vault.connect(bob).claimLeaderboardReward(epoch, 1, amount2, nonce, deadline, sig))
        .to.be.revertedWithCustomError(vault, "RankAlreadyTaken")
        .withArgs(epoch, 1, alice.address);
    });

    it("★ 同一个 epoch 一个玩家只能领一个名次", async function () {
      const epoch = await vault.currentEpoch();
      await time.increase(24 * 3600 + 1);
      await vault.setLimits(E(10_000_000), E(10_000_000), SIG_VALIDITY);

      let pool = await vault.poolBalance();
      let nonce = await vault.nonces(alice.address);
      let deadline = (await time.latest()) + SIG_VALIDITY;
      let amount = (pool * 500n) / 10_000n;
      let sig = await signLeaderboard(alice.address, Number(epoch), 1, amount, nonce, deadline);
      await vault.connect(alice).claimLeaderboardReward(epoch, 1, amount, nonce, deadline, sig);

      // alice 再去领第 2 名 → 必须被拒
      pool = await vault.poolBalance();
      nonce = await vault.nonces(alice.address);
      deadline = (await time.latest()) + SIG_VALIDITY;
      amount = (pool * 200n) / 10_000n;
      sig = await signLeaderboard(alice.address, Number(epoch), 2, amount, nonce, deadline);
      await expect(
        vault.connect(alice).claimLeaderboardReward(epoch, 2, amount, nonce, deadline, sig),
      ).to.be.revertedWithCustomError(vault, "AlreadyClaimed");
    });

    it("★ owner 可以单独关掉排行榜，闯关主流程不受影响", async function () {
      const epoch = await vault.currentEpoch();
      await time.increase(24 * 3600 + 1);
      await vault.setLeaderboardEnabled(false);
      expect(await vault.leaderboardEnabled()).to.equal(false);

      const amount = E(1);
      const nonce = await vault.nonces(alice.address);
      const deadline = (await time.latest()) + SIG_VALIDITY;
      const sig = await signLeaderboard(alice.address, Number(epoch), 1, amount, nonce, deadline);
      await expect(
        vault.connect(alice).claimLeaderboardReward(epoch, 1, amount, nonce, deadline, sig),
      ).to.be.revertedWithCustomError(vault, "LeaderboardDisabled");

      // 闯关照常
      await vault.connect(alice).enterTier();
      const a = await claimArgs(alice.address, 0);
      await expect(vault.connect(alice).claimReward(0, a.nonce, a.deadline, a.sig)).to.emit(
        vault,
        "RewardClaimed",
      );
    });

    it("当前 epoch 未结束不能领排行榜奖励", async function () {
      const epoch = await vault.currentEpoch();
      const nonce = await vault.nonces(alice.address);
      const deadline = (await time.latest()) + SIG_VALIDITY;
      const amount = E(1);
      const sig = await signLeaderboard(alice.address, Number(epoch), 1, amount, nonce, deadline);
      await expect(
        vault.connect(alice).claimLeaderboardReward(epoch, 1, amount, nonce, deadline, sig),
      ).to.be.revertedWithCustomError(vault, "EpochNotEnded");
    });

    it("排行榜奖励不能超过该 rank 的比例上限", async function () {
      await time.increase(24 * 3600 + 1);
      const epoch = Number(await vault.currentEpoch()) - 1;
      const pool = await vault.poolBalance();
      const tooMuch = (pool * 600n) / 10_000n; // > 5%
      const nonce = await vault.nonces(alice.address);
      const deadline = (await time.latest()) + SIG_VALIDITY;
      const sig = await signLeaderboard(alice.address, epoch, 1, tooMuch, nonce, deadline);
      await expect(
        vault.connect(alice).claimLeaderboardReward(epoch, 1, tooMuch, nonce, deadline, sig),
      ).to.be.revertedWithCustomError(vault, "InsufficientPool");
    });

    it("同一 epoch 同一 rank 不能重复领取", async function () {
      await time.increase(24 * 3600 + 1);
      const epoch = Number(await vault.currentEpoch()) - 1;
      const amount = E(1); // 小额即可，只验证重复领取
      const nonce = await vault.nonces(alice.address);
      const deadline = (await time.latest()) + SIG_VALIDITY;
      const sig = await signLeaderboard(alice.address, epoch, 1, amount, nonce, deadline);
      await vault.connect(alice).claimLeaderboardReward(epoch, 1, amount, nonce, deadline, sig);
      // 名次已被占（RankAlreadyTaken 先命中；换个地址来领同一名次也是这个错）
      await expect(vault.connect(alice).claimLeaderboardReward(epoch, 1, amount, nonce, deadline, sig))
        .to.be.revertedWithCustomError(vault, "RankAlreadyTaken")
        .withArgs(epoch, 1, alice.address);
    });
  });

  describe("后端签名服务对接（server/game-session.mjs）", function () {
    let svc;

    beforeEach(async function () {
      const { createGameSessionService } = await import("../server/game-session.mjs");
      svc = createGameSessionService({
        vault,
        vaultAddress: await vault.getAddress(),
        signerWallet,
        chainId,
        minSecondsPerLevel: 0,
        minRunSeconds: 0,
        suspicionMinSamples: 1e9, // 本组用例不测行为检测 // 测试里不等
      });
    });

    it("★ JS 算出的摘要和合约 rewardDigest() 完全一致", async function () {
      const { AbiCoder, keccak256 } = require("ethers");
      const deadline = (await time.latest()) + 600;
      const js = keccak256(
        AbiCoder.defaultAbiCoder().encode(
          ["uint256", "address", "address", "uint256", "uint256", "uint256", "uint256"],
          [chainId, await vault.getAddress(), alice.address, 0, E(36_000), 0, deadline],
        ),
      );
      const sol = await vault.rewardDigest(alice.address, 0, E(36_000), 0, deadline);
      expect(js).to.equal(sol);
    });

    it("★ 端到端：进场 → 逐关上报 → 后端签名 → 链上领奖成功", async function () {
      await vault.connect(alice).enterTier();
      const started = await svc.startSession(alice.address);
      expect(started.tier).to.equal(0);
      expect(started.fromLevel).to.equal(2);
      expect(started.toLevel).to.equal(11);

      for (let i = 0; i < 10; i++) {
        const r = await svc.reportLevel(started.sessionId, 2 + i);
        expect(r.cleared).to.equal(i + 1);
      }
      const signed = await svc.signReward(started.sessionId);
      expect(signed.reward).to.equal(E(36_000).toString());

      const before = await token.balanceOf(alice.address);
      await vault
        .connect(alice)
        .claimReward(signed.tier, signed.nonce, signed.deadline, signed.signature);
      expect(await token.balanceOf(alice.address)).to.equal(before + E(36_000));
    });

    it("★ 没链上进场就开局 → 直接拒绝", async function () {
      await expect(svc.startSession(alice.address)).to.be.rejectedWith("请先支付门票进场");
    });

    it("★ 关卡不连续 / 跳关 → 拒绝", async function () {
      await vault.connect(alice).enterTier();
      const s = await svc.startSession(alice.address);
      await expect(svc.reportLevel(s.sessionId, 5)).to.be.rejectedWith("关卡顺序不对");
      await svc.reportLevel(s.sessionId, 2);
      await expect(svc.reportLevel(s.sessionId, 4)).to.be.rejectedWith("关卡顺序不对");
    });

    it("★ 没通关就要签名 → 拒绝", async function () {
      await vault.connect(alice).enterTier();
      const s = await svc.startSession(alice.address);
      for (let i = 0; i < 9; i++) await svc.reportLevel(s.sessionId, 2 + i);
      await expect(svc.signReward(s.sessionId)).to.be.rejectedWith("还没通关");
    });

    it("★ 一个会话只能换一次签名", async function () {
      await vault.connect(alice).enterTier();
      const s = await svc.startSession(alice.address);
      for (let i = 0; i < 10; i++) await svc.reportLevel(s.sessionId, 2 + i);
      await svc.signReward(s.sessionId);
      await expect(svc.signReward(s.sessionId)).to.be.rejectedWith("会话不存在");
    });

    it("★ 通关速度过快 → 拒绝（默认每关最少 3 秒）", async function () {
      const { createGameSessionService } = await import("../server/game-session.mjs");
      const strict = createGameSessionService({
        vault,
        vaultAddress: await vault.getAddress(),
        signerWallet,
        chainId,
      });
      await vault.connect(alice).enterTier();
      const s = await strict.startSession(alice.address);
      await expect(strict.reportLevel(s.sessionId, 2)).to.be.rejectedWith("通关速度异常");
    });
  });

  describe("反作弊：行为异常检测", function () {
    async function svcWith(overrides) {
      const { createGameSessionService } = await import("../server/game-session.mjs");
      return createGameSessionService({
        vault,
        vaultAddress: await vault.getAddress(),
        signerWallet,
        chainId,
        minSecondsPerLevel: 0,
        minRunSeconds: 0,
        ...overrides,
      });
    }

    // 模拟一个脚本：每关间隔完全一致、从不失败
    async function botRun(svc, who, gapMs = 0) {
      await vault.connect(who).enterTier();
      const s = await svc.startSession(who.address);
      // 用后端返回的起始关号，档位推进后区间会变（tier1 是 12~21）
      for (let i = 0; i < 10; i++) {
        if (gapMs) await new Promise((r) => setTimeout(r, gapMs));
        await svc.reportLevel(s.sessionId, s.fromLevel + i);
      }
      return s;
    }

    it("★ 整档用时低于下限 → 拒签（防止拆到多个会话绕过单关限制）", async function () {
      const svc = await svcWith({ minRunSeconds: 120 });
      await vault.connect(alice).enterTier();
      const s = await svc.startSession(alice.address);
      for (let i = 0; i < 10; i++) await svc.reportLevel(s.sessionId, 2 + i);
      await expect(svc.signReward(s.sessionId)).to.be.rejectedWith("低于下限 120 秒");
    });

    it("★ 「从不失败 + 耗时机器般均匀 + 贴着下限」的地址会被标记并停发", async function () {
      // 阈值放宽到 3 局即可判定，方便测试
      const svc = await svcWith({ suspicionMinSamples: 3, minSecondsPerLevel: 0.01 });

      // 连打 3 局，每局都满通、间隔几乎为 0 → 典型脚本特征
      for (let i = 0; i < 3; i++) {
        const s = await botRun(svc, alice, 12);
        const signed = await svc.signReward(s.sessionId).catch((e) => ({ err: e.message }));
        if (signed.err) {
          expect(signed.err).to.include("已被标记为异常");
          const flagged = svc.stats().flagged;
          expect(flagged.map((f) => f.player)).to.include(alice.address);
          return; // 被抓到了，用例通过
        }
        await vault
          .connect(alice)
          .claimReward(signed.tier, signed.nonce, signed.deadline, signed.signature);
      }
      // 三局都没被抓也算失败——说明检测没生效
      expect(svc.stats().flagged.length, "应该已经标记为异常").to.be.greaterThan(0);
    });

    it("★ 被标记后连开局都开不了", async function () {
      const svc = await svcWith({ suspicionMinSamples: 3, minSecondsPerLevel: 0.01 });
      for (let i = 0; i < 4; i++) {
        const s = await botRun(svc, bob, 12).catch(() => null);
        if (!s) break;
        const r = await svc.signReward(s.sessionId).catch((e) => ({ err: e.message }));
        if (r.err) break;
        await vault.connect(bob).claimReward(r.tier, r.nonce, r.deadline, r.signature);
      }
      expect(svc.stats().flagged.length).to.be.greaterThan(0);
      await expect(svc.startSession(bob.address)).to.be.rejectedWith("已被标记为异常");
    });

    it("★ stats 里能看到反作弊参数和被标记名单", async function () {
      const svc = await svcWith({});
      const st = svc.stats();
      expect(st.antiCheat).to.include.keys("minSecondsPerLevel", "minRunSeconds", "maxSessionsPerPlayerPerDay");
      expect(st.flagged).to.be.an("array");
    });
  });

  describe("排行榜索引器（server/leaderboard-index.mjs）", function () {
    let index;

    beforeEach(async function () {
      const { createLeaderboardIndex } = await import("../server/leaderboard-index.mjs");
      index = createLeaderboardIndex({
        provider: ethers.provider,
        vaultAddress: await vault.getAddress(),
        startBlock: await ethers.provider.getBlockNumber(),
        confirmations: 0,
        storePath: "", // 测试不落盘
      });
    });

    it("★ 积分只来自链上 RewardClaimed，客户端上报加不了分", async function () {
      const { createGameSessionService } = await import("../server/game-session.mjs");
      const svc = createGameSessionService({
        vault,
        vaultAddress: await vault.getAddress(),
        signerWallet,
        chainId,
        minSecondsPerLevel: 0,
        minRunSeconds: 0,
        suspicionMinSamples: 1e9, // 本组用例不测行为检测
        leaderboard: index,
      });

      // 只上报关卡、不领奖 → 链上没有 RewardClaimed → 排行榜应该还是空的
      await vault.connect(alice).enterTier();
      const s = await svc.startSession(alice.address);
      for (let i = 0; i < 10; i++) await svc.reportLevel(s.sessionId, 2 + i);
      await index.scanOnce();
      const epochNow = Number(await vault.currentEpoch());
      expect(index.getTop(epochNow)).to.deep.equal([]); // 刷不出分

      // 真的领了奖（链上发出 RewardClaimed）→ 才计 1 分
      const signed = await svc.signReward(s.sessionId);
      await vault
        .connect(alice)
        .claimReward(signed.tier, signed.nonce, signed.deadline, signed.signature);
      await index.scanOnce();
      const top = index.getTop(epochNow);
      expect(top).to.have.length(1);
      expect(top[0].player).to.equal(alice.address.toLowerCase());
      expect(top[0].score).to.equal(1);
    });

    it("★ 通关多档的人排在前面，名次可确定复现", async function () {
      // alice 打两档，bob 打一档
      for (let i = 0; i < 2; i++) {
        await vault.connect(alice).enterTier();
        const a = await claimArgs(alice.address, i);
        await vault.connect(alice).claimReward(i, a.nonce, a.deadline, a.sig);
      }
      await vault.connect(bob).enterTier();
      const b = await claimArgs(bob.address, 0);
      await vault.connect(bob).claimReward(0, b.nonce, b.deadline, b.sig);

      await index.scanOnce();
      const epochNow = Number(await vault.currentEpoch());
      const top = index.getTop(epochNow);
      expect(top[0].player).to.equal(alice.address.toLowerCase());
      expect(top[0].score).to.equal(2);
      expect(top[1].player).to.equal(bob.address.toLowerCase());
      expect(top[1].score).to.equal(1);
      // 第 1 名查询与排序结果一致
      expect(index.getRankHolder(epochNow, 1).player).to.equal(alice.address.toLowerCase());
      expect(index.getRankHolder(epochNow, 2).player).to.equal(bob.address.toLowerCase());
      expect(index.getRankHolder(epochNow, 3)).to.equal(null);
    });
  });
});
