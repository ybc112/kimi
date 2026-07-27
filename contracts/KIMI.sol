// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title KIMI
/// @notice Platform utility token for the Kimi AI deployer.
///         Users burn KIMI to pay for contract deployment fees.
contract KIMI is ERC20, ERC20Burnable, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        require(bytes(name).length != 0, "KIMI_NAME_EMPTY");
        require(bytes(symbol).length != 0, "KIMI_SYMBOL_EMPTY");
        require(initialSupply != 0, "KIMI_SUPPLY_ZERO");
        _mint(msg.sender, initialSupply);
    }

    /// @notice Allows the owner to mint additional KIMI.
    /// @dev Use with caution; intended for liquidity bootstrapping only.
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "KIMI_TO_ZERO");
        require(amount != 0, "KIMI_AMOUNT_ZERO");
        _mint(to, amount);
    }
}
