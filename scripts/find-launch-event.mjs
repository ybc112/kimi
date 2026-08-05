import { ethers } from "ethers";

const factory = "0xf4eCf0bd65461DBdB1C9653c8712589Da5C46D11";
const eventSig = "LaunchCreated(address,address,address,bytes32,string,string,uint256,uint256,uint256,address,bool,string)";
const topic0 = ethers.id(eventSig);

const rpcs = [
  "https://aged-bitter-borough.bsc.quiknode.pro/54b8018087f29ffeb7ac53126a9e3053d1e06bc0/",
];

async function tryRpc(url) {
  try {
    const provider = new ethers.JsonRpcProvider(url);
    provider.polling = false;
    const latest = await provider.getBlockNumber();
    console.log("latest:", latest);
    const logs = await provider.getLogs({
      address: factory,
      topics: [topic0],
      fromBlock: latest - 5000,
      toBlock: latest,
    });
    console.log("logs:", logs.length);
    for (const log of logs.slice(-5)) {
      console.log("txHash:", log.transactionHash, "block:", log.blockNumber, "topics:", log.topics);
    }
  } catch (e) {
    console.log("Failed", url, e.shortMessage || e.message || e.error?.message);
  }
}

async function main() {
  for (const url of rpcs) await tryRpc(url);
}

main().catch(console.error);
