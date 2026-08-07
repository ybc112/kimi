// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable, Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title CapyGameVault
 * @notice 卡皮巴拉闯关游戏金库。
 *
 * 规则（每 10 关一档 tier，第 1 关免费体验）：
 *   tier n 覆盖第 (2 + 10n) ~ (11 + 10n) 关
 *   进场付「门票」，100% 进奖池
 *   闯关失败可「复活」，从失败那一关继续，复活费同样 100% 进奖池
 *   连过本档 10 关后领奖，奖励 = 门票 × (基础倍率 + min(每档加成 × tier, 加成上限))
 *   道具费 40% 销毁，60% 进奖池
 *   签到 10,000 代币/周，100% 进奖池，解锁游戏内每日签到
 *   每 24 小时排行榜前三瓜分奖池：#1 5%、#2 2%、#3 1%
 *
 * 安全设计：
 *   - 奖励总倍率被硬上限 MAX_TOTAL_REWARD_BPS 约束，任何 owner 都改不动
 *   - 领奖需要后端签名 + 链上必须存在「该档位的有效进场记录」，两者缺一不可
 *   - 签名带 deadline，且每人 nonce 单调递增，无法重放
 *   - 每人每日 / 全局每日领奖额度上限，签名密钥万一泄露，损失被封顶
 *   - owner 提取奖池要走 24 小时时间锁，玩家有时间看到并撤离
 */
contract CapyGameVault is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ───────────────── 常量 ─────────────────

    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint16 public constant BPS = 10_000;
    /// @notice 每档关卡数
    uint256 public constant LEVELS_PER_TIER = 10;
    /// @notice 第 1 关免费，不属于任何档位
    uint256 public constant FREE_LEVELS = 1;
    /// @notice 奖励相对门票的硬上限：2 倍。部署后无法突破。
    uint16 public constant MAX_TOTAL_REWARD_BPS = 20_000;
    /// @notice owner 提取奖池的时间锁
    uint256 public constant WITHDRAW_DELAY = 24 hours;
    /// @notice 签到周期
    uint256 public constant CHECK_IN_COST = 10_000 ether;
    uint256 public constant CHECK_IN_DURATION = 7 days;
    /// @notice 道具收入分配
    uint16 public constant ITEM_BURN_BPS = 4_000;
    uint16 public constant ITEM_POOL_BPS = 6_000;
    /// @notice 排行榜奖励比例
    uint16 public constant LEADERBOARD_RANK1_BPS = 500;
    uint16 public constant LEADERBOARD_RANK2_BPS = 200;
    uint16 public constant LEADERBOARD_RANK3_BPS = 100;
    uint256 public constant EPOCH_DURATION = 1 days;

    IERC20 public immutable gameToken;

    // ───────────────── 经济参数 ─────────────────

    struct Economics {
        uint256 ticket; // 进场门票，进奖池
        uint256 reviveCost; // 复活费，进奖池
        uint256 itemCost; // 道具费
        uint16 baseRewardBps; // 基础奖励倍率，18_000 = 1.8 倍门票
        uint16 tierBonusBps; // 每上一档多给门票的百分比，1_000 = 10%
        uint16 tierBonusCapBps; // 加成封顶，2_000 = 20%
    }

    Economics public econ;

    // ───────────────── 风控参数 ─────────────────

    address public signer;
    uint256 public signatureValidity; // 签名有效期（秒）
    uint256 public maxRewardPerDayPerPlayer;
    uint256 public maxRewardPerDayGlobal;

    // ───────────────── 玩家状态 ─────────────────

    struct Run {
        uint32 tier; // 本次进场闯的档位
        uint32 ticketsPaid; // 首张门票 + 复活次数
        uint64 startedAt;
        bool active;
    }

    /// @notice 玩家当前进行中的一次闯关
    mapping(address player => Run) public runs;
    /// @notice 玩家下一次可进入的档位（= 已通关的最高档 + 1，从 0 开始）
    mapping(address player => uint256) public nextTier;
    /// @notice 领奖用的单调递增 nonce
    mapping(address player => uint256) public nonces;
    /// @notice 累计统计
    mapping(address player => uint256) public totalRewardOf;

    mapping(address player => mapping(uint256 day => uint256 amount)) public dailyRewardOf;
    mapping(uint256 day => uint256 amount) public dailyRewardGlobal;

    /// @notice 签到有效期（时间戳）
    mapping(address player => uint64) public checkInExpiresAt;

    /// @notice 排行榜每个名次的得主。一个 (epoch, 名次) 只能被领走一次。
    /// @dev 上一版按 (epoch, 名次, 玩家) 记账，导致同一个名次可以被无限多个地址各领一次，
    ///      每次都拿走奖池的 5%/2%/1%。这里改成记录得主地址，从合约层面锁死。
    mapping(uint256 epochId => mapping(uint8 rank => address winner)) public leaderboardWinner;

    /// @notice 一个玩家在同一个 epoch 只能领一个名次，防止一人把前三名全领了
    mapping(uint256 epochId => mapping(address player => bool)) public leaderboardClaimedBy;

    /// @notice 排行榜总开关。出问题时 owner 可以单独关掉排行榜，不影响闯关主流程。
    bool public leaderboardEnabled = true;

    uint256 public totalTicketsIn; // 门票 + 复活费累计进池
    uint256 public totalRewardsOut; // 奖励累计出池
    uint256 public totalBurned; // 道具累计销毁
    uint256 public totalItemToPool; // 道具累计进池
    uint256 public totalCheckIn; // 签到累计进池

    // 奖池提取时间锁
    uint256 public pendingWithdrawAmount;
    address public pendingWithdrawTo;
    uint256 public pendingWithdrawReadyAt;

    // ───────────────── 事件 ─────────────────

    event TierEntered(address indexed player, uint256 indexed tier, uint256 ticket, uint256 fromLevel);
    event Revived(address indexed player, uint256 indexed tier, uint256 cost, uint32 ticketsPaid);
    event ItemUsed(address indexed player, uint256 cost, uint256 burned, uint256 toPool);
    event RunAbandoned(address indexed player, uint256 indexed tier, uint32 ticketsPaid);
    event RewardClaimed(
        address indexed player, uint256 indexed tier, uint256 reward, uint32 ticketsPaid, uint256 nonce
    );
    event CheckIn(address indexed player, uint256 cost, uint64 expiresAt);
    event LeaderboardRewardClaimed(
        address indexed player, uint256 indexed epochId, uint8 indexed rank, uint256 amount, uint256 nonce
    );
    event PoolFunded(address indexed funder, uint256 amount);
    event EconomicsUpdated(Economics econ);
    event SignerUpdated(address indexed previous, address indexed current);
    event LeaderboardEnabledUpdated(bool enabled);
    event LimitsUpdated(uint256 perPlayerPerDay, uint256 globalPerDay, uint256 signatureValidity);
    event WithdrawRequested(address indexed to, uint256 amount, uint256 readyAt);
    event WithdrawCancelled(address indexed to, uint256 amount);
    event WithdrawExecuted(address indexed to, uint256 amount);

    // ───────────────── 错误 ─────────────────

    error ZeroAddress();
    error ZeroAmount();
    error RunAlreadyActive();
    error NoActiveRun();
    error TierMismatch(uint256 expected, uint256 provided);
    error RewardOverCap(uint16 totalBps, uint16 capBps);
    error ReviveTooCheap();
    error SignatureExpired();
    error BadNonce(uint256 expected, uint256 provided);
    error BadSignature();
    error InsufficientPool(uint256 need, uint256 have);
    error DailyLimitPlayer(uint256 used, uint256 cap);
    error DailyLimitGlobal(uint256 used, uint256 cap);
    error CannotRescueGameToken();
    error NothingPending();
    error TimelockNotReady(uint256 readyAt);
    error InvalidRank();
    error AlreadyClaimed(uint256 epochId, uint8 rank);
    error RankAlreadyTaken(uint256 epochId, uint8 rank, address winner);
    error LeaderboardDisabled();
    error EpochNotEnded(uint256 epochId, uint256 currentEpoch);

    // ───────────────── 构造 ─────────────────

    constructor(
        address token,
        address initialOwner,
        address initialSigner,
        Economics memory economics,
        uint256 perPlayerPerDay,
        uint256 globalPerDay,
        uint256 sigValidity
    )
        Ownable(initialOwner)
    {
        if (token == address(0) || initialSigner == address(0)) revert ZeroAddress();
        gameToken = IERC20(token);
        signer = initialSigner;
        _setEconomics(economics);
        _setLimits(perPlayerPerDay, globalPerDay, sigValidity);
        emit SignerUpdated(address(0), initialSigner);
    }

    // ───────────────── 只读 ─────────────────

    /// @notice 当前奖池余额
    function poolBalance() public view returns (uint256) {
        return gameToken.balanceOf(address(this));
    }

    /// @notice 当前 epoch 编号（从 0 开始，每 24 小时一个 epoch）
    function currentEpoch() public view returns (uint256) {
        return block.timestamp / EPOCH_DURATION;
    }

    /// @notice tier n 的通关奖励
    function rewardOf(uint256 tier) public view returns (uint256) {
        uint256 bonusBps = tier * uint256(econ.tierBonusBps);
        uint256 capBps = uint256(econ.tierBonusCapBps);
        if (bonusBps > capBps) bonusBps = capBps;
        return (econ.ticket * (uint256(econ.baseRewardBps) + bonusBps)) / BPS;
    }

    /// @notice tier n 的关卡区间（含两端）
    function levelRangeOf(uint256 tier) public pure returns (uint256 fromLevel, uint256 toLevel) {
        fromLevel = FREE_LEVELS + 1 + tier * LEVELS_PER_TIER;
        toLevel = fromLevel + LEVELS_PER_TIER - 1;
    }

    /// @notice 第 level 关属于哪个档位；免费关返回 (0, false)
    function tierOfLevel(uint256 level) public pure returns (uint256 tier, bool paid) {
        if (level <= FREE_LEVELS) return (0, false);
        return ((level - FREE_LEVELS - 1) / LEVELS_PER_TIER, true);
    }

    function today() public view returns (uint256) {
        return block.timestamp / 1 days;
    }

    /// @notice 某 epoch 排行榜第 rank 名的奖励上限（占奖池比例）
    function leaderboardRewardCap(uint8 rank) public pure returns (uint16 bps) {
        if (rank == 1) return LEADERBOARD_RANK1_BPS;
        if (rank == 2) return LEADERBOARD_RANK2_BPS;
        if (rank == 3) return LEADERBOARD_RANK3_BPS;
        return 0;
    }

    /// @notice 前端一次性拿齐玩家视图
    function playerState(address player)
        external
        view
        returns (
            uint256 tierNext,
            Run memory run,
            uint256 reward,
            uint256 nonce,
            uint256 dailyUsed,
            uint256 pool,
            uint64 checkInExpiry,
            uint256 epoch
        )
    {
        tierNext = nextTier[player];
        run = runs[player];
        reward = rewardOf(run.active ? run.tier : tierNext);
        nonce = nonces[player];
        dailyUsed = dailyRewardOf[player][today()];
        pool = poolBalance();
        checkInExpiry = checkInExpiresAt[player];
        epoch = currentEpoch();
    }

    /// @notice 后端签名时要签的摘要（前后端必须完全一致）
    function rewardDigest(address player, uint256 tier, uint256 reward, uint256 nonce, uint256 deadline)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(block.chainid, address(this), player, tier, reward, nonce, deadline));
    }

    /// @notice 排行榜奖励签名摘要
    function leaderboardDigest(
        address player,
        uint256 epochId,
        uint8 rank,
        uint256 amount,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), player, epochId, rank, amount, nonce, deadline));
    }

    // ───────────────── 玩家操作 ─────────────────

    /// @notice 任何人都可以给奖池充值
    function fundPool(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        gameToken.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(msg.sender, amount);
    }

    /// @notice 签到：支付 10,000 代币，解锁 7 天游戏内每日签到
    function checkIn() external whenNotPaused nonReentrant {
        uint256 cost = CHECK_IN_COST;
        if (cost == 0) revert ZeroAmount();

        gameToken.safeTransferFrom(msg.sender, address(this), cost);
        totalCheckIn += cost;

        uint64 current = checkInExpiresAt[msg.sender];
        uint64 base = current > uint64(block.timestamp) ? current : uint64(block.timestamp);
        uint64 expiry = base + uint64(CHECK_IN_DURATION);
        checkInExpiresAt[msg.sender] = expiry;

        emit CheckIn(msg.sender, cost, expiry);
    }

    /// @notice 进场：支付门票，开始闯当前档位的 10 关
    function enterTier() external whenNotPaused nonReentrant {
        Run storage run = runs[msg.sender];
        if (run.active) revert RunAlreadyActive();

        uint256 tier = nextTier[msg.sender];
        uint256 ticket = econ.ticket;
        if (ticket == 0) revert ZeroAmount();

        gameToken.safeTransferFrom(msg.sender, address(this), ticket);
        totalTicketsIn += ticket;

        run.tier = uint32(tier);
        run.ticketsPaid = 1;
        run.startedAt = uint64(block.timestamp);
        run.active = true;

        (uint256 fromLevel,) = levelRangeOf(tier);
        emit TierEntered(msg.sender, tier, ticket, fromLevel);
    }

    /// @notice 复活：失败后从死掉那一关继续，进度不清零
    function revive() external whenNotPaused nonReentrant {
        Run storage run = runs[msg.sender];
        if (!run.active) revert NoActiveRun();

        uint256 cost = econ.reviveCost;
        if (cost == 0) revert ZeroAmount();

        gameToken.safeTransferFrom(msg.sender, address(this), cost);
        totalTicketsIn += cost;
        run.ticketsPaid += 1;

        emit Revived(msg.sender, run.tier, cost, run.ticketsPaid);
    }

    /// @notice 使用道具：40% 销毁，60% 进奖池
    function useItem() external whenNotPaused nonReentrant {
        if (!runs[msg.sender].active) revert NoActiveRun();
        uint256 cost = econ.itemCost;
        if (cost == 0) revert ZeroAmount();

        uint256 burnAmount = (cost * uint256(ITEM_BURN_BPS)) / BPS;
        uint256 poolAmount = cost - burnAmount;

        gameToken.safeTransferFrom(msg.sender, BURN_ADDRESS, burnAmount);
        if (poolAmount > 0) {
            gameToken.safeTransferFrom(msg.sender, address(this), poolAmount);
            totalItemToPool += poolAmount;
        }
        totalBurned += burnAmount;
        emit ItemUsed(msg.sender, cost, burnAmount, poolAmount);
    }

    /// @notice 主动放弃本次闯关（已付门票留在奖池，不退）
    function abandonRun() external nonReentrant {
        Run storage run = runs[msg.sender];
        if (!run.active) revert NoActiveRun();
        uint256 tier = run.tier;
        uint32 paid = run.ticketsPaid;
        delete runs[msg.sender];
        emit RunAbandoned(msg.sender, tier, paid);
    }

    /**
     * @notice 领取本档通关奖励。
     * @dev 三重校验，缺一不可：
     *      1) 链上必须存在该档位的有效进场记录（说明门票真的付过）
     *      2) 后端签名有效、未过期、nonce 对得上
     *      3) 奖池够、没超每日限额
     */
    function claimReward(uint256 tier, uint256 nonce, uint256 deadline, bytes calldata signature)
        external
        whenNotPaused
        nonReentrant
    {
        Run storage run = runs[msg.sender];
        if (!run.active) revert NoActiveRun();
        if (run.tier != tier) revert TierMismatch(run.tier, tier);
        if (block.timestamp > deadline) revert SignatureExpired();

        uint256 expectedNonce = nonces[msg.sender];
        if (nonce != expectedNonce) revert BadNonce(expectedNonce, nonce);

        uint256 reward = rewardOf(tier);
        if (reward == 0) revert ZeroAmount();

        bytes32 digest = rewardDigest(msg.sender, tier, reward, nonce, deadline);
        address recovered = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(digest), signature);
        if (recovered != signer) revert BadSignature();

        uint256 pool = poolBalance();
        if (pool < reward) revert InsufficientPool(reward, pool);

        uint256 day = today();
        uint256 usedPlayer = dailyRewardOf[msg.sender][day] + reward;
        if (usedPlayer > maxRewardPerDayPerPlayer) {
            revert DailyLimitPlayer(usedPlayer, maxRewardPerDayPerPlayer);
        }
        uint256 usedGlobal = dailyRewardGlobal[day] + reward;
        if (usedGlobal > maxRewardPerDayGlobal) {
            revert DailyLimitGlobal(usedGlobal, maxRewardPerDayGlobal);
        }

        uint32 ticketsPaid = run.ticketsPaid;

        // 先记账再转账
        nonces[msg.sender] = expectedNonce + 1;
        dailyRewardOf[msg.sender][day] = usedPlayer;
        dailyRewardGlobal[day] = usedGlobal;
        totalRewardOf[msg.sender] += reward;
        totalRewardsOut += reward;
        nextTier[msg.sender] = tier + 1;
        delete runs[msg.sender];

        gameToken.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, tier, reward, ticketsPaid, nonce);
    }

    /**
     * @notice 领取排行榜奖励。
     * @dev 由后端根据上一 epoch 的玩家表现计算排名与奖励金额，并签名。
     */
    function claimLeaderboardReward(
        uint256 epochId,
        uint8 rank,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused nonReentrant {
        if (!leaderboardEnabled) revert LeaderboardDisabled();
        if (rank == 0 || rank > 3) revert InvalidRank();
        if (currentEpoch() <= epochId) revert EpochNotEnded(epochId, currentEpoch());
        if (block.timestamp > deadline) revert SignatureExpired();
        // 这个名次已经被别人领走了
        address taken = leaderboardWinner[epochId][rank];
        if (taken != address(0)) revert RankAlreadyTaken(epochId, rank, taken);
        // 同一个 epoch 一个玩家只能领一个名次
        if (leaderboardClaimedBy[epochId][msg.sender]) revert AlreadyClaimed(epochId, rank);

        uint256 expectedNonce = nonces[msg.sender];
        if (nonce != expectedNonce) revert BadNonce(expectedNonce, nonce);

        // 奖励金额不能超过该 rank 对应奖池比例上限
        uint256 cap = (poolBalance() * uint256(leaderboardRewardCap(rank))) / BPS;
        if (amount == 0 || amount > cap) revert InsufficientPool(amount > cap ? amount : 0, cap);

        bytes32 digest = leaderboardDigest(msg.sender, epochId, rank, amount, nonce, deadline);
        address recovered = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(digest), signature);
        if (recovered != signer) revert BadSignature();

        uint256 day = today();
        uint256 usedPlayer = dailyRewardOf[msg.sender][day] + amount;
        if (usedPlayer > maxRewardPerDayPerPlayer) {
            revert DailyLimitPlayer(usedPlayer, maxRewardPerDayPerPlayer);
        }
        uint256 usedGlobal = dailyRewardGlobal[day] + amount;
        if (usedGlobal > maxRewardPerDayGlobal) {
            revert DailyLimitGlobal(usedGlobal, maxRewardPerDayGlobal);
        }

        // 先记账再转账
        leaderboardWinner[epochId][rank] = msg.sender;
        leaderboardClaimedBy[epochId][msg.sender] = true;
        nonces[msg.sender] = expectedNonce + 1;
        dailyRewardOf[msg.sender][day] = usedPlayer;
        dailyRewardGlobal[day] = usedGlobal;
        totalRewardOf[msg.sender] += amount;
        totalRewardsOut += amount;

        gameToken.safeTransfer(msg.sender, amount);
        emit LeaderboardRewardClaimed(msg.sender, epochId, rank, amount, nonce);
    }

    // ───────────────── 管理 ─────────────────

    function setEconomics(Economics calldata economics) external onlyOwner {
        _setEconomics(economics);
    }

    function _setEconomics(Economics memory economics) private {
        uint16 totalBps = economics.baseRewardBps + economics.tierBonusCapBps;
        if (totalBps > MAX_TOTAL_REWARD_BPS) revert RewardOverCap(totalBps, MAX_TOTAL_REWARD_BPS);
        if (economics.ticket == 0) revert ZeroAmount();
        // 复活费太便宜会让「无限复活」变成正期望，直接把奖池吃空
        if (economics.reviveCost * 2 < economics.ticket) revert ReviveTooCheap();
        econ = economics;
        emit EconomicsUpdated(economics);
    }

    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        address previous = signer;
        signer = newSigner;
        emit SignerUpdated(previous, newSigner);
    }

    /// @notice 排行榜总开关。关掉后 claimLeaderboardReward 直接 revert，闯关主流程不受影响。
    function setLeaderboardEnabled(bool enabled) external onlyOwner {
        leaderboardEnabled = enabled;
        emit LeaderboardEnabledUpdated(enabled);
    }

    function setLimits(uint256 perPlayerPerDay, uint256 globalPerDay, uint256 sigValidity)
        external
        onlyOwner
    {
        _setLimits(perPlayerPerDay, globalPerDay, sigValidity);
    }

    function _setLimits(uint256 perPlayerPerDay, uint256 globalPerDay, uint256 sigValidity) private {
        if (perPlayerPerDay == 0 || globalPerDay == 0 || sigValidity == 0) revert ZeroAmount();
        maxRewardPerDayPerPlayer = perPlayerPerDay;
        maxRewardPerDayGlobal = globalPerDay;
        signatureValidity = sigValidity;
        emit LimitsUpdated(perPlayerPerDay, globalPerDay, sigValidity);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice 申请提取奖池，24 小时后才能执行，玩家看得见
    function requestWithdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        pendingWithdrawTo = to;
        pendingWithdrawAmount = amount;
        pendingWithdrawReadyAt = block.timestamp + WITHDRAW_DELAY;
        emit WithdrawRequested(to, amount, pendingWithdrawReadyAt);
    }

    function cancelWithdraw() external onlyOwner {
        if (pendingWithdrawAmount == 0) revert NothingPending();
        emit WithdrawCancelled(pendingWithdrawTo, pendingWithdrawAmount);
        pendingWithdrawAmount = 0;
        pendingWithdrawTo = address(0);
        pendingWithdrawReadyAt = 0;
    }

    function executeWithdraw() external onlyOwner nonReentrant {
        uint256 amount = pendingWithdrawAmount;
        if (amount == 0) revert NothingPending();
        if (block.timestamp < pendingWithdrawReadyAt) revert TimelockNotReady(pendingWithdrawReadyAt);
        address to = pendingWithdrawTo;

        pendingWithdrawAmount = 0;
        pendingWithdrawTo = address(0);
        pendingWithdrawReadyAt = 0;

        gameToken.safeTransfer(to, amount);
        emit WithdrawExecuted(to, amount);
    }

    /// @notice 误转进来的其它代币可以救，但游戏代币不行（必须走时间锁）
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(gameToken)) revert CannotRescueGameToken();
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }
}
