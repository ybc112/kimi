// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {KimiNFTCollection} from "./KimiNFTCollection.sol";

contract KimiNFTLaunchFactory is Ownable {
    uint256 public constant creationFee = 0.01 ether;
    uint16 public immutable requiredCollectionSuffix;
    address payable public feeRecipient;
    address[] public allCollections;
    struct Project { address creator; address collection; string description; string imageURI; string metadataURI; uint64 createdAt; }
    mapping(address => Project) public projects;
    error InvalidParams(); error InvalidFee(); error InvalidSuffix(address collection, uint16 requiredSuffix); error ZeroAddress();
    event NFTLaunchCreated(address indexed creator, address indexed collection, string name, string symbol, uint256 maxSupply, uint256 mintPrice, string metadataURI);

    constructor(address payable feeRecipient_, uint16 requiredSuffix_) Ownable(msg.sender) {
        if (feeRecipient_ == address(0)) revert ZeroAddress();
        feeRecipient = feeRecipient_; requiredCollectionSuffix = requiredSuffix_;
    }

    function createNFTLaunch(
        string calldata name_, string calldata symbol_, string calldata description_, string calldata imageURI_,
        string calldata baseURI_, string calldata metadataURI_, uint256 maxSupply_, uint256 mintPrice_,
        uint256 maxMintPerWallet_, bytes32 salt_
    ) external payable returns (address collection) {
        if (msg.value != creationFee) revert InvalidFee();
        if (bytes(name_).length == 0 || bytes(symbol_).length == 0 || bytes(baseURI_).length == 0) revert InvalidParams();
        collection = address(new KimiNFTCollection{salt: salt_}(name_, symbol_, description_, imageURI_, baseURI_, maxSupply_, mintPrice_, maxMintPerWallet_, msg.sender));
        if (requiredCollectionSuffix != 0 && uint160(collection) % 65536 != requiredCollectionSuffix) revert InvalidSuffix(collection, requiredCollectionSuffix);
        allCollections.push(collection);
        projects[collection] = Project(msg.sender, collection, description_, imageURI_, metadataURI_, uint64(block.timestamp));
        (bool ok,) = feeRecipient.call{value: msg.value}(""); if (!ok) revert InvalidFee();
        emit NFTLaunchCreated(msg.sender, collection, name_, symbol_, maxSupply_, mintPrice_, metadataURI_);
    }
    function allCollectionsLength() external view returns (uint256) { return allCollections.length; }
    function setFeeRecipient(address payable value) external onlyOwner { if (value == address(0)) revert ZeroAddress(); feeRecipient = value; }
}
