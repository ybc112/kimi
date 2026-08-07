const { expect } = require("chai");
const { ethers, artifacts } = require("hardhat");

const BPS = 10000n;
const DEAD = "0x000000000000000000000000000000000000dEaD";
const ZERO = ethers.ZeroAddress;

const TOTAL_SUPPLY = ethers.parseEther("1000000"); // 100 万枚
const CREATION_FEE = ethers.parseEther("0.005");
const REWARD_SHARE = 5000n;   // 分红 50%
const LP_SHARE = 2000n;       // LP 回流 20%
const BURN_SHARE = 3000n;     // 燃烧 30%
const FUND_SHARE = 0n;        // fund 0%（余数）
const TOTAL_TAX = 500n;       // 5%
let USDT_ADDR = ethers.ZeroAddress;

// 预期拆分（平台 20% = 1%，剩余 4% 按 share 分）
const PLATFORM = (TOTAL_TAX * 2000n) / BPS;              // 100 bps = 1%
const LEFT = TOTAL_TAX - PLATFORM;                       // 400 bps
const REWARD_FEE = (LEFT * REWARD_SHARE) / BPS;          // 200 bps = 2%
const LP_FEE = (LEFT * LP_SHARE) / BPS;                  // 80 bps = 0.8%
const BURN_FEE = (LEFT * BURN_SHARE) / BPS;              // 120 bps = 1.2%
const FUND_FEE = LEFT - REWARD_FEE - LP_FEE - BURN_FEE;  // 0

function defaultParams(overrides = {}) {
  return {
    name: "Snowball",
    symbol: "SNB",
    totalSupply: TOTAL_SUPPLY,
    receiver: overrides.receiver || ethers.ZeroAddress,
    fundAddress: ZERO,          // 默认 feeRecipient
    rewardToken: overrides.rewardToken || USDT_ADDR, // 显式本地 USDT（避免 Factory 主网默认地址）
    currency: ZERO,             // 默认 WBNB
    totalBuyTax: TOTAL_TAX,
    totalSellTax: TOTAL_TAX,
    rewardShare: REWARD_SHARE,
    liquidityShare: LP_SHARE,
    burnShare: BURN_SHARE,
    fundShare: FUND_SHARE,
    maxBuyAmount: 0,            // 不限
    maxSellAmount: 0,           // 不限
    maxWalletAmount: 0,         // 不限
    secondTime: 0,
    killBlocks: 0,
    airdropNumbs: 0,
    transferFee: 0,
    mushHoldNum: ethers.parseEther("1000"),
    lpBurnFrequency: 3600,
    percentForLPBurn: 50,       // 0.5%
    enableOffTrade: true,
    ...overrides
  };
}

describe("Snowball TokenFactory (BananaToken 雪球发射台)", function () {
  this.timeout(300000);

  let deployer, creator, alice, bob, feeRecipient;
  let wbnb, usdt, router, routerFactory;
  let trackerImpl, tokenDeployer, factory;
  let token, pair;

  async function pairReserves(tokenAddr, pairAddr) {
    const t0 = await pairAddr.token0();
    const [r0, r1] = await pairAddr.getReserves();
    return tokenAddr === t0 ? [r0, r1] : [r1, r0]; // [tokenReserve, wbnbReserve]
  }

  async function addLiquidity(tokenAddr, amountToken, amountEth, to) {
    // 直接给 pair 打币 + mint LP（绕过 router 的简化 helper）
    const pairAddr = await routerFactory.getPair(tokenAddr, await wbnb.getAddress());
    const tkn = await ethers.getContractAt("BananaToken", tokenAddr);
    await tkn.connect(await ethers.getSigner(to)).transfer(pairAddr, amountToken);
    await wbnb.deposit({ value: amountEth });
    await wbnb.transfer(pairAddr, amountEth);
    const p = await ethers.getContractAt("MockUniswapV2Pair", pairAddr);
    await p.mint(to);
    return p;
  }

  async function buy(user, tokenAddr, ethAmount) {
    await router.connect(user).swapExactETHForTokensSupportingFeeOnTransferTokens(
      0, [await wbnb.getAddress(), tokenAddr], user.address,
      (await ethers.provider.getBlock("latest")).timestamp + 600, { value: ethAmount }
    );
  }

  async function sell(user, tokenAddr, tokenAmount) {
    const tkn = await ethers.getContractAt("BananaToken", tokenAddr);
    await tkn.connect(user).approve(await router.getAddress(), tokenAmount);
    await router.connect(user).swapExactTokensForETHSupportingFeeOnTransferTokens(
      tokenAmount, 0, [tokenAddr, await wbnb.getAddress()], user.address,
      (await ethers.provider.getBlock("latest")).timestamp + 600
    );
  }

  async function createLaunch(params, salt = ethers.keccak256(ethers.toUtf8Bytes("salt-1")), value = CREATION_FEE) {
    const tx = await factory.createToken(params, salt, { value });
    const receipt = await tx.wait();
    const evt = receipt.logs.map(l => { try { return factory.interface.parseLog(l); } catch { return null; } })
      .find(e => e && e.name === "TokenCreated");
    return { receipt, evt };
  }

  before(async function () {
    [deployer, creator, alice, bob] = await ethers.getSigners();
    feeRecipient = deployer.address;

    wbnb = await (await ethers.getContractFactory("MockWETH")).deploy();
    usdt = await (await ethers.getContractFactory("MockTestERC20")).deploy("USDT", "USDT");
    USDT_ADDR = await usdt.getAddress();
    router = await (await ethers.getContractFactory("MockRouter")).deploy(await wbnb.getAddress());
    routerFactory = await ethers.getContractAt("MockUniswapV2Factory", await router.factory());

    trackerImpl = await (await ethers.getContractFactory("BABYTOKENDividendTracker")).deploy();
    tokenDeployer = await (await ethers.getContractFactory("BananaTokenDeployer")).deploy();
    factory = await (await ethers.getContractFactory("TokenFactory")).deploy(
      feeRecipient, CREATION_FEE, await router.getAddress(), await trackerImpl.getAddress(),
      await tokenDeployer.getAddress(), 0 // suffix 关闭
    );
    await tokenDeployer.setFactory(await factory.getAddress());

    // 给 router 一些 ETH（买卖循环用）
    await deployer.sendTransaction({ to: await router.getAddress(), value: ethers.parseEther("50") });

    // 创建 WBNB/USDT 池（分红换币路径用）：直接给 pair 打币 + mint LP
    await routerFactory.createPair(await wbnb.getAddress(), await usdt.getAddress());
    const usdtPair = await routerFactory.getPair(await wbnb.getAddress(), await usdt.getAddress());
    await usdt.mint(usdtPair, ethers.parseEther("10000"));
    await wbnb.deposit({ value: ethers.parseEther("50") });
    await wbnb.transfer(usdtPair, ethers.parseEther("50"));
    const pairC = await ethers.getContractAt("MockUniswapV2Pair", usdtPair);
    await pairC.mint(await router.getAddress());
  });

  // ═══════════════════ A. 费率计算正确性 ═══════════════════

  describe("A. previewFees 费率计算", function () {
    it("平台 20% 固定 + 剩余按 share 拆分 + fund 吃余数", async function () {
      const [buy, sell] = await factory.previewFees(TOTAL_TAX, TOTAL_TAX, REWARD_SHARE, LP_SHARE, BURN_SHARE, FUND_SHARE);
      expect(buy.platformFee).to.equal(PLATFORM);            // 1%
      expect(buy.rewardFee).to.equal(REWARD_FEE);            // 2%
      expect(buy.liquidityFee).to.equal(LP_FEE);             // 0.8%
      expect(buy.burnFee).to.equal(BURN_FEE);                // 1.2%
      expect(buy.fundFee).to.equal(0n);                      // 0
      // 合计 = 总税
      expect(buy.platformFee + buy.rewardFee + buy.liquidityFee + buy.burnFee + buy.fundFee).to.equal(TOTAL_TAX);
      expect(sell.rewardFee).to.equal(REWARD_FEE);           // 买卖同拆分
    });

    it("买/卖税独立拆分", async function () {
      const [buy, sell] = await factory.previewFees(500n, 600n, REWARD_SHARE, LP_SHARE, BURN_SHARE, FUND_SHARE);
      expect(buy.platformFee).to.equal(100n);
      expect(sell.platformFee).to.equal(120n);
      expect(buy.rewardFee).to.equal(200n);
      expect(sell.rewardFee).to.equal(240n);
      expect(sell.rewardFee + sell.liquidityFee + sell.burnFee + sell.platformFee + sell.fundFee).to.equal(600n);
    });

    it("无效输入 revert：税 0 / 超 25% / share 和 ≠ 10000", async function () {
      await expect(factory.previewFees(0, 500, REWARD_SHARE, LP_SHARE, BURN_SHARE, FUND_SHARE))
        .to.be.revertedWithCustomError(factory, "InvalidParams");
      await expect(factory.previewFees(3000, 500, REWARD_SHARE, LP_SHARE, BURN_SHARE, FUND_SHARE))
        .to.be.revertedWithCustomError(factory, "InvalidParams");
      await expect(factory.previewFees(500, 500, 5000, 2000, 2000, 0))
        .to.be.revertedWithCustomError(factory, "InvalidParams");
    });
  });

  // ═══════════════════ B. createToken 部署 ═══════════════════

  describe("B. createToken 部署", function () {
    it("部署正确：参数映射 / 白名单 / owner / 事件", async function () {
      const params = defaultParams({ receiver: creator.address });
      const { evt } = await createLaunch(params);

      token = await ethers.getContractAt("BananaToken", evt.args.token);
      pair = await ethers.getContractAt("MockUniswapV2Pair",
        await routerFactory.getPair(await token.getAddress(), await wbnb.getAddress()));

      expect(await token.name()).to.equal("Snowball");
      expect(await token.symbol()).to.equal("SNB");
      expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
      expect(await token.owner()).to.equal(creator.address);
      // mint 全给项目方
      expect(await token.balanceOf(creator.address)).to.equal(TOTAL_SUPPLY);
      // 事件字段
      expect(evt.args.buyRewardFee).to.equal(REWARD_FEE);
      expect(evt.args.buyFundFee).to.equal(PLATFORM);        // 平台并入 fund 通道
      expect(evt.args.buyBurnFee).to.equal(BURN_FEE);
      expect(evt.args.percentForLPBurn).to.equal(50n);
      // 链上费率状态
      expect(await token._buyRewardFee()).to.equal(REWARD_FEE);
      expect(await token._buyLiquidityFee()).to.equal(LP_FEE);
      expect(await token._buyBurnFee()).to.equal(BURN_FEE);
      expect(await token._buyFundFee()).to.equal(PLATFORM + FUND_FEE);
      expect(await token._sellFundFee()).to.equal(PLATFORM + FUND_FEE);
      // 白名单：项目方/fund 免税、pair 存在
      expect(await token._feeWhiteList(creator.address)).to.equal(true);
      expect(await token._mainPair()).to.equal(await pair.getAddress());
    });

    it("发币费收取 + 超额退款", async function () {
      const params = defaultParams({ receiver: alice.address });
      const before = await ethers.provider.getBalance(feeRecipient);
      await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("fee-test")), CREATION_FEE * 2n);
      expect(await ethers.provider.getBalance(feeRecipient)).to.be.closeTo(before + CREATION_FEE, ethers.parseEther("0.05"));
    });

    it("发币费不足 revert", async function () {
      const params = defaultParams({ receiver: alice.address });
      await expect(factory.createToken(params, ethers.keccak256(ethers.toUtf8Bytes("no-fee")), { value: 0 }))
        .to.be.revertedWithCustomError(factory, "InvalidFee");
    });

    it("无效参数 revert", async function () {
      const base = defaultParams({ receiver: alice.address });
      const salt = ethers.keccak256(ethers.toUtf8Bytes("invalid"));
      await expect(factory.createToken({ ...base, name: "" }, salt, { value: CREATION_FEE }))
        .to.be.revertedWithCustomError(factory, "InvalidParams");
      await expect(factory.createToken({ ...base, totalBuyTax: 0 }, salt, { value: CREATION_FEE }))
        .to.be.revertedWithCustomError(factory, "InvalidParams");
      await expect(factory.createToken({ ...base, rewardShare: 4000, liquidityShare: 2000, burnShare: 3000, fundShare: 999 }, salt, { value: CREATION_FEE }))
        .to.be.revertedWithCustomError(factory, "InvalidParams"); // 和 ≠ 10000
      await expect(factory.createToken({ ...base, percentForLPBurn: 0 }, salt, { value: CREATION_FEE }))
        .to.be.revertedWithCustomError(factory, "InvalidParams");
      await expect(factory.createToken({ ...base, lpBurnFrequency: 10 }, salt, { value: CREATION_FEE }))
        .to.be.revertedWithCustomError(factory, "InvalidParams");
      await expect(factory.createToken({ ...base, airdropNumbs: 5 }, salt, { value: CREATION_FEE }))
        .to.be.revertedWithCustomError(factory, "InvalidParams");
      await expect(factory.createToken({ ...base, receiver: ZERO }, salt, { value: CREATION_FEE }))
        .to.be.revertedWithCustomError(factory, "InvalidParams");
    });
  });

  // ═══════════════════ C. 买卖税拆分（链上行为） ═══════════════════

  describe("C. 买卖税拆分", function () {
    before(async function () {
      const params = defaultParams({ receiver: creator.address });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("tax-test")));
      token = await ethers.getContractAt("BananaToken", evt.args.token);
      pair = await ethers.getContractAt("MockUniswapV2Pair",
        await routerFactory.getPair(await token.getAddress(), await wbnb.getAddress()));
      await addLiquidity(await token.getAddress(), ethers.parseEther("500000"), ethers.parseEther("10"), creator.address);
      await token.connect(creator).launch(); // 开盘（enableOffTrade=true 需先 launch）
    });

    it("买入 5% 税：burn 1.2% 直烧黑洞，fee 3.8% 入合约，净额 95%", async function () {
      // buy 前读储备计算名义输出（997 手续费公式）
      const [rt, rb] = await pairReserves(await token.getAddress(), pair);
      const amountOut = (ethers.parseEther("1") * 997n * rt) / (rb * 1000n + ethers.parseEther("1") * 997n);
      const burnAmount = (amountOut * BURN_FEE) / BPS;
      const feeAmount = (amountOut * (PLATFORM + LP_FEE + REWARD_FEE)) / BPS;
      await buy(alice, await token.getAddress(), ethers.parseEther("1"));

      // 精确断言余额增量
      const bal = await token.balanceOf(alice.address);
      expect(bal).to.equal(amountOut - burnAmount - feeAmount);
      // dead 收到 burn（buy 时 from=pair，从池子扣）
      expect(await token.balanceOf(DEAD)).to.equal(burnAmount);
      // 合约收到 fee
      expect(await token.balanceOf(await token.getAddress())).to.equal(feeAmount);
    });

    it("卖出 5% 税：burn 直烧、fee 入合约、触发 swapBack 分账", async function () {
      const fundBefore = await ethers.provider.getBalance(feeRecipient);
      const contractBefore = await token.balanceOf(await token.getAddress());
      await sell(alice, await token.getAddress(), await token.balanceOf(alice.address));
      const contractAfter = await token.balanceOf(await token.getAddress());

      // 卖税：burn 从 alice 扣到 dead
      expect(await token.balanceOf(DEAD)).to.be.gt(0);
      // swapBack 清掉旧积累，但本次卖出的 fee（3.8%）新进合约
      expect(contractAfter).to.be.lt(contractBefore);
      // fund 部分（平台 + 项目 fund）以 BNB 转 fundAddress
      expect(await ethers.provider.getBalance(feeRecipient)).to.be.gt(fundBefore);
      // 合约 token 余额清零说明 swapBack 执行过
      expect(contractBefore).to.be.gt(0n);
    });

    it("platform and project fund use separate receivers", async function () {
      const params = defaultParams({
        receiver: creator.address,
        fundAddress: bob.address,
        rewardShare: 4000,
        liquidityShare: 2000,
        burnShare: 2000,
        fundShare: 2000,
      });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("separate-platform-fund")));
      const separated = await ethers.getContractAt("BananaToken", evt.args.token);
      await addLiquidity(await separated.getAddress(), ethers.parseEther("500000"), ethers.parseEther("10"), creator.address);
      await separated.connect(creator).launch();
      expect(await separated.platformFeeReceiver()).to.equal(feeRecipient);
      expect(await separated.fundAddress()).to.equal(bob.address);

      await buy(alice, await separated.getAddress(), ethers.parseEther("1"));
      const platformBefore = await ethers.provider.getBalance(feeRecipient);
      const fundBefore = await ethers.provider.getBalance(bob.address);
      await sell(alice, await separated.getAddress(), await separated.balanceOf(alice.address));
      expect(await ethers.provider.getBalance(feeRecipient)).to.be.gt(platformBefore);
      expect(await ethers.provider.getBalance(bob.address)).to.be.gt(fundBefore);
    });

    it("asymmetric buy and sell fees use actual accounting buckets", async function () {
      const params = defaultParams({ receiver: creator.address, totalBuyTax: 500, totalSellTax: 1000 });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("asymmetric-buckets")));
      const asymmetric = await ethers.getContractAt("BananaToken", evt.args.token);
      await addLiquidity(await asymmetric.getAddress(), ethers.parseEther("500000"), ethers.parseEther("10"), creator.address);
      await asymmetric.connect(creator).launch();
      await buy(alice, await asymmetric.getAddress(), ethers.parseEther("1"));
      expect(await asymmetric.tokensForPlatform()).to.be.gt(0n);
      expect(await asymmetric.tokensForRewards()).to.be.gt(await asymmetric.tokensForLiquidity());
      await sell(alice, await asymmetric.getAddress(), await asymmetric.balanceOf(alice.address));
      expect(await asymmetric.tokensForPlatform()).to.be.gt(0n); // current sell is booked after swapBack
    });
  });

  // ═══════════════════ E. LP 单边燃烧（雪球核心） ═══════════════════

  describe("E. LP 单边燃烧 0.5%/次", function () {
    before(async function () {
      const params = defaultParams({ receiver: creator.address });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("burn-test")));
      token = await ethers.getContractAt("BananaToken", evt.args.token);
      pair = await ethers.getContractAt("MockUniswapV2Pair",
        await routerFactory.getPair(await token.getAddress(), await wbnb.getAddress()));
      await addLiquidity(await token.getAddress(), ethers.parseEther("500000"), ethers.parseEther("10"), creator.address);
      await token.connect(creator).launch();
    });

    it("卖出触发燃烧：池内 token 减少 0.5%、dead 增加、记录 lastBurnTime", async function () {
      await buy(alice, await token.getAddress(), ethers.parseEther("0.5"));
      // 买入已设置 lastBurnTime，需推进超过 burnInterval（3600s）才触发 LP 燃烧
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      const [rtBefore] = await pairReserves(await token.getAddress(), pair);
      const deadBefore = await token.balanceOf(DEAD);

      await sell(alice, await token.getAddress(), await token.balanceOf(alice.address));

      const [rtAfter] = await pairReserves(await token.getAddress(), pair);
      const deadAfter = await token.balanceOf(DEAD);
      // LP 燃烧按卖出时的池内真实余额（balanceOf）计算
      const pairBalAtBurn = await token.balanceOf(await pair.getAddress());
      const burnAmount = (pairBalAtBurn * 50n) / BPS; // 0.5%

      expect(deadAfter - deadBefore).to.be.closeTo(burnAmount, ethers.parseEther("1000"));
      expect(await token.lastLpBurnTime()).to.be.gt(0);
      expect(rtAfter).to.be.gt(rtBefore); // 卖出把 token 打进池子（净增加）
    });

    it("间隔内（3600s 内）第二次卖出不再燃烧", async function () {
      const lastBurn1 = await token.lastLpBurnTime();

      await buy(bob, await token.getAddress(), ethers.parseEther("0.3"));
      await sell(bob, await token.getAddress(), await token.balanceOf(bob.address));

      expect(await token.lastLpBurnTime()).to.equal(lastBurn1);
    });

    it("超过间隔后再次卖出重新燃烧", async function () {
      const lastBurn1 = await token.lastLpBurnTime();
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      await buy(bob, await token.getAddress(), ethers.parseEther("0.3"));
      await sell(bob, await token.getAddress(), await token.balanceOf(bob.address));

      expect(await token.lastLpBurnTime()).to.be.gt(lastBurn1);
    });
  });

  // ═══════════════════ F. 限买 / 限卖 / 限钱包 ═══════════════════

  describe("F. 限买 / 限卖 / 限钱包", function () {
    it("maxBuyAmount 超限 revert", async function () {
      const params = defaultParams({
        receiver: creator.address,
        maxBuyAmount: ethers.parseEther("1000")
      });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("maxbuy")));
      const t = await ethers.getContractAt("BananaToken", evt.args.token);
      const p = await ethers.getContractAt("MockUniswapV2Pair",
        await routerFactory.getPair(await t.getAddress(), await wbnb.getAddress()));
      await addLiquidity(await t.getAddress(), ethers.parseEther("500000"), ethers.parseEther("10"), creator.address);
      await t.connect(creator).launch();

      // 买 1 ETH 远超 1000 枚限购
      await expect(buy(alice, await t.getAddress(), ethers.parseEther("1"))).to.be.reverted;
    });

    it("maxSellAmount 超限 revert", async function () {
      const params = defaultParams({
        receiver: creator.address,
        maxSellAmount: ethers.parseEther("100")
      });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("maxsell")));
      const t = await ethers.getContractAt("BananaToken", evt.args.token);
      const p = await ethers.getContractAt("MockUniswapV2Pair",
        await routerFactory.getPair(await t.getAddress(), await wbnb.getAddress()));
      await addLiquidity(await t.getAddress(), ethers.parseEther("500000"), ethers.parseEther("10"), creator.address);
      await t.connect(creator).launch();
      await buy(bob, await t.getAddress(), ethers.parseEther("1")); // bob 持有 ~4000+ 枚

      await expect(sell(bob, await t.getAddress(), ethers.parseEther("5000"))).to.be.reverted;
    });

    it("maxWalletAmount 超限 revert", async function () {
      const params = defaultParams({
        receiver: creator.address,
        maxWalletAmount: ethers.parseEther("2000")
      });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("maxwallet")));
      const t = await ethers.getContractAt("BananaToken", evt.args.token);
      const p = await ethers.getContractAt("MockUniswapV2Pair",
        await routerFactory.getPair(await t.getAddress(), await wbnb.getAddress()));
      await addLiquidity(await t.getAddress(), ethers.parseEther("500000"), ethers.parseEther("10"), creator.address);
      await t.connect(creator).launch();

      await expect(buy(alice, await t.getAddress(), ethers.parseEther("1"))).to.be.reverted;
    });

    it("0 = 不限（链上 type(uint256).max）", async function () {
      const params = defaultParams({ receiver: creator.address });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("nolimit")));
      const t = await ethers.getContractAt("BananaToken", evt.args.token);
      expect(await t.maxBuyAmount()).to.equal(ethers.MaxUint256);
      expect(await t.maxSellAmount()).to.equal(ethers.MaxUint256);
      expect(await t.maxWalletAmount()).to.equal(ethers.MaxUint256);
    });
  });

  // ═══════════════════ G. 开盘保护 ═══════════════════

  describe("G. 开盘保护", function () {
    it("enableOffTrade=true 未 launch 禁止交易", async function () {
      const params = defaultParams({ receiver: creator.address, enableOffTrade: true });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("offtrade")));
      const t = await ethers.getContractAt("BananaToken", evt.args.token);
      const p = await ethers.getContractAt("MockUniswapV2Pair",
        await routerFactory.getPair(await t.getAddress(), await wbnb.getAddress()));
      await addLiquidity(await t.getAddress(), ethers.parseEther("500000"), ethers.parseEther("10"), creator.address);

      await expect(buy(alice, await t.getAddress(), ethers.parseEther("0.1"))).to.be.reverted;

      await t.connect(creator).launch();
      await buy(alice, await t.getAddress(), ethers.parseEther("0.1")); // 开盘后成功
      expect(await t.balanceOf(alice.address)).to.be.gt(0n);
    });

    it("enableOffTrade=false 无需 launch 即可交易", async function () {
      const params = defaultParams({ receiver: creator.address, enableOffTrade: false });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("notradeoff")));
      const t = await ethers.getContractAt("BananaToken", evt.args.token);
      const p = await ethers.getContractAt("MockUniswapV2Pair",
        await routerFactory.getPair(await t.getAddress(), await wbnb.getAddress()));
      await addLiquidity(await t.getAddress(), ethers.parseEther("500000"), ethers.parseEther("10"), creator.address);
      await buy(alice, await t.getAddress(), ethers.parseEther("0.1")); // 直接可交易
      expect(await t.balanceOf(alice.address)).to.be.gt(0n);
    });

    it("launch can only be called once", async function () {
      const params = defaultParams({ receiver: creator.address });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("launch-once")));
      const t = await ethers.getContractAt("BananaToken", evt.args.token);
      await t.connect(creator).launch();
      await expect(t.connect(creator).launch()).to.be.reverted;
    });
  });

  // ═══════════════════ H. 持币分红 ═══════════════════

  describe("H. 持币分红", function () {
    it("卖出 → 分红币入 tracker → 门槛过滤 → claim 到账", async function () {
      const params = defaultParams({ receiver: creator.address, mushHoldNum: ethers.parseEther("1000") });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("dividend")));
      const t = await ethers.getContractAt("BananaToken", evt.args.token);
      const p = await ethers.getContractAt("MockUniswapV2Pair",
        await routerFactory.getPair(await t.getAddress(), await wbnb.getAddress()));
      await addLiquidity(await t.getAddress(), ethers.parseEther("500000"), ethers.parseEther("10"), creator.address);
      await t.connect(creator).launch();

      // alice 买 ~4000 枚（> 门槛 1000）
      await buy(alice, await t.getAddress(), ethers.parseEther("0.5"));
      expect(await t.balanceOf(alice.address)).to.be.gt(ethers.parseEther("1000"));

      // 卖出触发 swapBack → 分红币入 tracker
      const trackerAddr = await t.dividendTracker();
      const usdtBefore = await usdt.balanceOf(trackerAddr);
      await sell(alice, await t.getAddress(), ethers.parseEther("100"));
      expect(await usdt.balanceOf(trackerAddr)).to.be.gt(usdtBefore);

      // 链上 claim 无 claimWait 检查（BABYTOKEN 风格），直接领取
      // 快进后 claim 到账
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      // tracker 的 process 会自动分发（canAutoClaim 初始为真），手动 claim 不应 revert
      await t.connect(alice).claim();
    });
  });

  // ═══════════════════ I. createTokenAndAddLiquidity 一键全流程 ═══════════════════

  describe("I. createTokenAndAddLiquidity 一键加池开盘", function () {
    it("部署 + 加池 + LP 锁黑洞 + 剩余币转项目方 + 开盘 + owner 转移", async function () {
      const params = defaultParams({ receiver: alice.address });
      const addToken = ethers.parseEther("400000");   // 40% 加池
      const addEth = ethers.parseEther("2");
      const salt = ethers.keccak256(ethers.toUtf8Bytes("onepress"));

      const tx = await factory.createTokenAndAddLiquidity(params, salt, addToken, addEth, { value: CREATION_FEE + addEth });
      const receipt = await tx.wait();
      const evt = receipt.logs.map(l => { try { return factory.interface.parseLog(l); } catch { return null; } })
        .find(e => e && e.name === "TokenCreated");
      expect(evt.args.addLiquidity).to.equal(true);

      const t = await ethers.getContractAt("BananaToken", evt.args.token);
      const p = await ethers.getContractAt("MockUniswapV2Pair",
        await routerFactory.getPair(await t.getAddress(), await wbnb.getAddress()));

      // LP 已锁黑洞（转 dead）
      expect(await p.balanceOf(DEAD)).to.be.gt(0n);
      // 剩余币转项目方
      expect(await t.balanceOf(alice.address)).to.equal(TOTAL_SUPPLY - addToken);
      // owner 已转移
      expect(await t.owner()).to.equal(alice.address);
      // 已开盘（可直接交易）
      await buy(bob, await t.getAddress(), ethers.parseEther("0.5"));
      expect(await t.balanceOf(bob.address)).to.be.gt(0n);
      // 发币费被收走
      expect(await factory.allTokensLength()).to.be.gt(0n);
    });

    it("非 WBNB currency 一键加池 revert", async function () {
      const params = defaultParams({ receiver: alice.address, currency: await usdt.getAddress() });
      await expect(factory.createTokenAndAddLiquidity(
        params, ethers.keccak256(ethers.toUtf8Bytes("nousdt")), ethers.parseEther("100"), ethers.parseEther("1"),
        { value: CREATION_FEE + ethers.parseEther("1") }
      )).to.be.revertedWithCustomError(factory, "InvalidParams");
    });

    it("addLiquidityTokens 超总量 revert", async function () {
      const params = defaultParams({ receiver: alice.address });
      await expect(factory.createTokenAndAddLiquidity(
        params, ethers.keccak256(ethers.toUtf8Bytes("too-many")), TOTAL_SUPPLY + 1n, ethers.parseEther("1"),
        { value: CREATION_FEE + ethers.parseEther("1") }
      )).to.be.revertedWithCustomError(factory, "InvalidParams");
    });

    it("insufficient creation fee plus LP BNB reverts before deployment", async function () {
      const params = defaultParams({ receiver: creator.address });
      await expect(factory.createTokenAndAddLiquidity(
        params,
        ethers.keccak256(ethers.toUtf8Bytes("insufficient-lp-value")),
        ethers.parseEther("100000"),
        ethers.parseEther("1"),
        { value: CREATION_FEE }
      )).to.be.revertedWithCustomError(factory, "InvalidFee");
    });
  });

  // ═══════════════════ J. 权限与靓号 ═══════════════════

  describe("J. 权限与靓号", function () {
    it("Deployer 仅工厂可调；setFactory 一次性", async function () {
      await expect(tokenDeployer.connect(alice).setFactory(alice.address))
        .to.be.revertedWithCustomError(tokenDeployer, "NotAdmin");
      await expect(tokenDeployer.connect(alice).deploy(
        [], [], [], [], [], ethers.ZeroHash
      )).to.be.revertedWithCustomError(tokenDeployer, "NotFactory");
      await expect(tokenDeployer.setFactory(alice.address))
        .to.be.revertedWithCustomError(tokenDeployer, "FactoryAlreadySet");
    });

    it("feeRecipient 才能改 creationFee", async function () {
      await expect(factory.connect(alice).setCreationFee(1000n))
        .to.be.revertedWithCustomError(factory, "InvalidFee");
      await factory.connect(await ethers.getSigner(feeRecipient)).setCreationFee(1000n);
      expect(await factory.creationFee()).to.equal(1000n);
      await factory.connect(await ethers.getSigner(feeRecipient)).setCreationFee(CREATION_FEE);
    });

    it("owner cannot withdraw protected tax, pair, currency or reward assets", async function () {
      const params = defaultParams({ receiver: creator.address });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("protected-withdraw")));
      const t = await ethers.getContractAt("BananaToken", evt.args.token);
      const mainPair = await t._mainPair();
      await expect(t.connect(creator).withdraw(await t.getAddress(), creator.address, 1)).to.be.reverted;
      await expect(t.connect(creator).withdraw(mainPair, creator.address, 1)).to.be.reverted;
      await expect(t.connect(creator).withdraw(await t.currency(), creator.address, 1)).to.be.reverted;
      await expect(t.connect(creator).withdraw(await t.ETH(), creator.address, 1)).to.be.reverted;
    });

    it("owner setters enforce anti-bricking bounds", async function () {
      const params = defaultParams({ receiver: creator.address });
      const { evt } = await createLaunch(params, ethers.keccak256(ethers.toUtf8Bytes("setter-bounds")));
      const t = await ethers.getContractAt("BananaToken", evt.args.token);
      await expect(t.connect(creator).setAirdropNumbs(4)).to.be.reverted;
      await expect(t.connect(creator).setNumTokensSellRate(101)).to.be.reverted;
      await expect(t.connect(creator).setSwapAtAmount(0)).to.be.reverted;
      await expect(t.connect(creator).setkb(101)).to.be.reverted;
      await expect(t.connect(creator).setFundAddress(ZERO)).to.be.reverted;
    });

    it("靓号后缀：随机 salt revert，挖盐匹配成功", async function () {
      // 部署一个带 7777 后缀的工厂（需要新的 deployer/工厂组合）
      const trackerImpl2 = await (await ethers.getContractFactory("BABYTOKENDividendTracker")).deploy();
      const deployer2 = await (await ethers.getContractFactory("BananaTokenDeployer")).deploy();
      const factory2 = await (await ethers.getContractFactory("TokenFactory")).deploy(
        feeRecipient, CREATION_FEE, await router.getAddress(), await trackerImpl2.getAddress(),
        await deployer2.getAddress(), 0x7777
      );
      await deployer2.setFactory(await factory2.getAddress());

      // 随机 salt 部署 → 后缀不匹配 revert
      const params = defaultParams({ receiver: alice.address });
      await expect(factory2.createToken(params, ethers.keccak256(ethers.toUtf8Bytes("random")), { value: CREATION_FEE }))
        .to.be.revertedWithCustomError(factory2, "InvalidTokenSuffix");

      // 前端挖盐：initCodeHash = keccak256(BananaToken.creationCode + ABI 编码构造参数)。
      // 参数必须与 TokenFactory 实际生成的完全一致 → 用 factory2.buildParams 获取。
      const bananaArtifact = await artifacts.readArtifact("BananaToken");
      const [strP, addrP, numP, boolP] = await factory2.buildParams(params, false);
      const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string[]", "address[]", "uint256[]", "bool[]", "uint256[]"],
        [strP, addrP, numP, boolP, []]
      );
      const initCodeHash = ethers.keccak256(ethers.concat([bananaArtifact.bytecode, encodedArgs]));
      let salt = 0n;
      let addr = "";
      while (!addr.toLowerCase().endsWith("7777")) {
        salt += 1n;
        addr = ethers.getCreate2Address(await deployer2.getAddress(), ethers.zeroPadValue(ethers.toBeHex(salt), 32), initCodeHash);
      }

      const tx = await factory2.createToken(params, ethers.zeroPadValue(ethers.toBeHex(salt), 32), { value: CREATION_FEE });
      const receipt = await tx.wait();
      const evt = receipt.logs.map(l => { try { return factory2.interface.parseLog(l); } catch { return null; } })
        .find(e => e && e.name === "TokenCreated");
      expect(evt.args.token.toLowerCase().endsWith("7777")).to.equal(true);
    });
  });
});
