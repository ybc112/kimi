// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract KimiNFTCollection is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    uint256 public immutable maxSupply;
    uint256 public immutable mintPrice;
    uint256 public immutable maxMintPerWallet;
    uint256 public totalMinted;
    string public baseTokenURI;
    string public description;
    string public imageURI;
    mapping(address => uint256) public mintedByWallet;

    error InvalidConfig();
    error SoldOut();
    error MintLimitExceeded();
    error IncorrectPayment();
    error WithdrawFailed();

    constructor(
        string memory name_, string memory symbol_, string memory description_,
        string memory imageURI_, string memory baseURI_, uint256 maxSupply_,
        uint256 mintPrice_, uint256 maxMintPerWallet_, address creator_
    ) ERC721(name_, symbol_) Ownable(creator_) {
        if (maxSupply_ == 0 || maxSupply_ > 1000000 || creator_ == address(0)) revert InvalidConfig();
        if (maxMintPerWallet_ == 0 || maxMintPerWallet_ > maxSupply_) revert InvalidConfig();
        maxSupply = maxSupply_;
        mintPrice = mintPrice_;
        maxMintPerWallet = maxMintPerWallet_;
        description = description_;
        imageURI = imageURI_;
        baseTokenURI = baseURI_;
    }

    function mint(uint256 quantity) external payable nonReentrant {
        if (quantity == 0 || quantity > maxMintPerWallet - mintedByWallet[msg.sender]) revert MintLimitExceeded();
        if (totalMinted + quantity > maxSupply) revert SoldOut();
        if (msg.value != mintPrice * quantity) revert IncorrectPayment();
        mintedByWallet[msg.sender] += quantity;
        for (uint256 i; i < quantity; ++i) {
            ++totalMinted;
            _safeMint(msg.sender, totalMinted);
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(baseTokenURI, tokenId.toString(), ".json");
    }

    function setBaseTokenURI(string calldata value) external onlyOwner { baseTokenURI = value; }
    function withdraw(address payable to) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidConfig();
        (bool ok,) = to.call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
    }
}
