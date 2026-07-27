// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title FixedSupplyToken
/// @notice A standard 18-decimal ERC20 with a fixed initial supply and holder burns.
contract FixedSupplyToken is ERC20, ERC20Burnable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        require(bytes(name).length != 0, "TOKEN_NAME_EMPTY");
        require(bytes(symbol).length != 0, "TOKEN_SYMBOL_EMPTY");
        require(initialSupply != 0, "TOKEN_SUPPLY_ZERO");
        require(initialSupply <= type(uint256).max / (10 ** uint256(decimals())), "TOKEN_SUPPLY_TOO_LARGE");
        _mint(msg.sender, initialSupply * (10 ** uint256(decimals())));
    }
}
