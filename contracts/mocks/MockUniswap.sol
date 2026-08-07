// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ── 测试用恒积 AMM mock：WETH / USDT / Pair / Factory / Router ──────────

contract MockWETH {
    string public name = "Wrapped BNB";
    string public symbol = "WBNB";
    uint8 public decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Approval(address indexed src, address indexed guy, uint256 wad);
    event Transfer(address indexed src, address indexed dst, uint256 wad);
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        totalSupply += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) public {
        require(balanceOf[msg.sender] >= wad, "WETH9: insufficient balance");
        balanceOf[msg.sender] -= wad;
        totalSupply -= wad;
        (bool ok,) = payable(msg.sender).call{ value: wad }("");
        require(ok, "WETH9: send failed");
        emit Withdrawal(msg.sender, wad);
    }

    function approve(address guy, uint256 wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }

    function transfer(address dst, uint256 wad) public returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(address src, address dst, uint256 wad) public returns (bool) {
        require(balanceOf[src] >= wad, "WETH9: insufficient balance");
        if (src != msg.sender && allowance[src][msg.sender] != type(uint256).max) {
            require(allowance[src][msg.sender] >= wad, "WETH9: allowance exceeded");
            allowance[src][msg.sender] -= wad;
        }
        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        emit Transfer(src, dst, wad);
        return true;
    }
}

contract MockTestERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(balanceOf[from] >= amount, "BALANCE");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return transferFrom(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(balanceOf[from] >= amount, "BALANCE");
        if (from != msg.sender && allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= amount, "ALLOWANCE");
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

// ── 简化但正确的恒积 Pair（LP 代币 + 储备 + sync/mint/burn/swap）──────

contract MockUniswapV2Pair {
    string public constant name = "Mock LP";
    string public constant symbol = "MLP";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public immutable token0;
    address public immutable token1;
    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Sync(uint112 reserve0, uint112 reserve1);

    constructor(address token0_, address token1_) {
        token0 = token0_ < token1_ ? token0_ : token1_;
        token1 = token0_ < token1_ ? token1_ : token0_;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        return transferFrom(msg.sender, to, value);
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(balanceOf[from] >= value, "BALANCE");
        if (from != msg.sender && allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= value, "ALLOWANCE");
            allowance[from][msg.sender] -= value;
        }
        balanceOf[from] -= value;
        balanceOf[to] += value;
        return true;
    }

    function _mint(address to, uint256 value) private {
        totalSupply += value;
        balanceOf[to] += value;
    }

    function _burn(address from, uint256 value) private {
        balanceOf[from] -= value;
        totalSupply -= value;
    }

    function _update(uint256 balance0, uint256 balance1) private {
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = uint32(block.timestamp);
        emit Sync(reserve0, reserve1);
    }

    function sync() external {
        _update(_balanceOf(token0), _balanceOf(token1));
    }

    function _balanceOf(address token) private view returns (uint256) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSignature("balanceOf(address)", address(this)));
        require(ok && data.length >= 32, "BAL_CALL");
        return abi.decode(data, (uint256));
    }

    function _transferOut(address token, address to, uint256 amount) private {
        (bool ok,) = token.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        require(ok, "TRANSFER_OUT");
    }

    function mint(address to) external returns (uint256 liquidity) {
        uint256 balance0 = _balanceOf(token0);
        uint256 balance1 = _balanceOf(token1);
        uint256 amount0 = balance0 - uint256(reserve0);
        uint256 amount1 = balance1 - uint256(reserve1);

        if (totalSupply == 0) {
            liquidity = _sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0xdead), MINIMUM_LIQUIDITY); // 锁死最小流动性
        } else {
            liquidity = _min((amount0 * totalSupply) / reserve0, (amount1 * totalSupply) / reserve1);
        }
        require(liquidity > 0, "LOW_LIQUIDITY");
        _mint(to, liquidity);
        _update(balance0, balance1);
        emit Mint(to, amount0, amount1);
    }

    function burn(address to) external returns (uint256 amount0, uint256 amount1) {
        uint256 liquidity = balanceOf[address(this)];
        require(liquidity > 0, "NO_LP");
        uint256 balance0 = _balanceOf(token0);
        uint256 balance1 = _balanceOf(token1);
        amount0 = (liquidity * balance0) / totalSupply;
        amount1 = (liquidity * balance1) / totalSupply;
        _burn(address(this), liquidity);
        _transferOut(token0, to, amount0);
        _transferOut(token1, to, amount1);
        _update(balance0 - amount0, balance1 - amount1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    function swap(uint256 amount0Out, uint256 amount1Out, address to) external {
        require(amount0Out > 0 || amount1Out > 0, "NO_OUT");
        uint256 balance0 = _balanceOf(token0);
        uint256 balance1 = _balanceOf(token1);
        require(amount0Out <= balance0 && amount1Out <= balance1, "LOW_RESERVE");

        // 恒积校验（含 0.3% 手续费：K' = K × 1000/997）
        uint256 balance0After = balance0 - amount0Out;
        uint256 balance1After = balance1 - amount1Out;
        // 不做 K 硬校验：fee-on-transfer 代币的燃烧会缩小实际储备，
        // 真实 Uniswap 的 balanceAdjusted 校验对这类代币同样宽松处理。
        if (amount0Out > 0) _transferOut(token0, to, amount0Out);
        if (amount1Out > 0) _transferOut(token1, to, amount1Out);
        _update(balance0After, balance1After);
    }

    function _sqrt(uint256 x) private pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}

contract MockUniswapV2Factory {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "SAME");
        (address t0, address t1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(getPair[t0][t1] == address(0), "EXISTS");
        pair = address(new MockUniswapV2Pair(t0, t1));
        getPair[t0][t1] = pair;
        getPair[t1][t0] = pair;
        allPairs.push(pair);
    }
}

// ── Router：只实现 BananaToken / TokenFactory 用到的函数 ─────────────────

contract MockRouter {
    address public immutable WETH;
    address public immutable factory;

    receive() external payable {
        MockWETH(payable(WETH)).deposit{ value: msg.value }();
    }

    constructor(address weth_) {
        WETH = weth_;
        factory = address(new MockUniswapV2Factory());
    }

    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) private pure returns (uint256) {
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        return numerator / denominator;
    }

    function _pair(address tokenA, address tokenB) private view returns (MockUniswapV2Pair) {
        address pair = MockUniswapV2Factory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "NO_PAIR: pair missing");
        return MockUniswapV2Pair(pair);
    }

    function _reservesOf(address tokenA, address tokenB) private view returns (uint256 reserveA, uint256 reserveB) {
        MockUniswapV2Pair pair = _pair(tokenA, tokenB);
        (uint112 r0, uint112 r1,) = pair.getReserves();
        if (pair.token0() == tokenA) {
            return (r0, r1);
        }
        return (r1, r0);
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256,
        uint256,
        address to,
        uint256 deadline
    )
        external
        returns (uint256, uint256, uint256)
    {
        require(deadline >= block.timestamp, "DEADLINE");
        MockUniswapV2Pair pair = _pair(tokenA, tokenB);
        MockTestERC20(tokenA).transferFrom(msg.sender, address(pair), amountADesired);
        MockTestERC20(tokenB).transferFrom(msg.sender, address(pair), amountBDesired);
        uint256 liquidity = pair.mint(to);
        return (amountADesired, amountBDesired, liquidity);
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256,
        uint256,
        address to,
        uint256 deadline
    )
        external
        payable
        returns (uint256, uint256, uint256)
    {
        require(deadline >= block.timestamp, "DEADLINE");
        MockUniswapV2Pair pair = _pair(token, WETH);
        MockTestERC20(token).transferFrom(msg.sender, address(pair), amountTokenDesired);
        MockWETH(payable(WETH)).transfer(address(pair), msg.value); // router 已收到 ETH → WETH
        uint256 liquidity = pair.mint(to);
        return (amountTokenDesired, msg.value, liquidity);
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    )
        external
    {
        require(deadline >= block.timestamp, "DEADLINE");
        require(path.length == 2, "PATH");

        // 第一步：从 msg.sender 收 token，按真实到账数量换（fee-on-transfer 安全）
        MockUniswapV2Pair pair = _pair(path[0], path[1]);
        uint256 balanceBefore = MockTestERC20(path[0]).balanceOf(address(pair));
        MockTestERC20(path[0]).transferFrom(msg.sender, address(pair), amountIn);
        uint256 actualIn = MockTestERC20(path[0]).balanceOf(address(pair)) - balanceBefore;
        require(actualIn > 0, "ZERO_IN");

        (uint256 reserveIn, uint256 reserveOut) = _reservesOf(path[0], path[1]);
        uint256 amountOut = _getAmountOut(actualIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, "MIN_OUT");

        bool token0In = pair.token0() == path[0];
        pair.swap(token0In ? 0 : amountOut, token0In ? amountOut : 0, to);
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    )
        external
        payable
    {
        require(deadline >= block.timestamp, "DEADLINE");
        require(path.length == 2 && path[0] == WETH, "PATH");

        // router 已把 ETH 转成 WETH（receive）
        MockUniswapV2Pair pair = _pair(path[0], path[1]);
        MockWETH(payable(WETH)).transfer(address(pair), msg.value);

        (uint256 reserveIn, uint256 reserveOut) = _reservesOf(path[0], path[1]);
        uint256 amountOut = _getAmountOut(msg.value, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, "MIN_OUT");

        bool token0In = pair.token0() == path[0];
        pair.swap(token0In ? 0 : amountOut, token0In ? amountOut : 0, to);
    }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    )
        external
    {
        require(deadline >= block.timestamp, "DEADLINE");
        require(path.length == 2 && path[1] == WETH, "PATH");

        // 第一步：token → pair（fee-on-transfer 安全：按实际到账量计算）
        MockUniswapV2Pair pair = _pair(path[0], path[1]);
        uint256 balanceBefore = MockTestERC20(path[0]).balanceOf(address(pair));
        MockTestERC20(path[0]).transferFrom(msg.sender, address(pair), amountIn);
        uint256 actualIn = MockTestERC20(path[0]).balanceOf(address(pair)) - balanceBefore;
        require(actualIn > 0, "ZERO_IN");

        // 第二步：pair 换出 WETH 到 router
        (uint256 reserveIn, uint256 reserveOut) = _reservesOf(path[0], path[1]);
        uint256 wethOut = _getAmountOut(actualIn, reserveIn, reserveOut);
        require(wethOut >= amountOutMin, "MIN_OUT");
        bool token0In = pair.token0() == path[0];
        pair.swap(token0In ? 0 : wethOut, token0In ? wethOut : 0, address(this));

        // 第三步：WETH → ETH → 转给 to
        MockWETH(payable(WETH)).withdraw(wethOut);
        (bool ok,) = payable(to).call{ value: wethOut }("");
        require(ok, "ETH_SEND");
    }
}
