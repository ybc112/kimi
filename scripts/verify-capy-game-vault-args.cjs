const { parseUnits } = require("ethers");

module.exports = [
  "0x839578f40b9a79a3fe891dd96079f3083e6e7777", // token
  "0xe1F9Fb65BBb39ebd4d0C204c95513d3f6421c407", // owner (deployer)
  "0x8dcf2C585B3bD5c5E24490cFF809D67C0c04E616", // signer
  [
    parseUnits("20000", 18),
    parseUnits("20000", 18),
    parseUnits("5000", 18),
    18000,
    1000,
    2000,
  ], // economics
  parseUnits("200000", 18), // perPlayerDay
  parseUnits("5000000", 18), // globalDay
  600, // sigValidity
];
