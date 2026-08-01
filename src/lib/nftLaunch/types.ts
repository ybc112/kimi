export type NFTLaunchDraft = {
  name: string; symbol: string; description: string; imageURI: string; baseURI: string; metadataURI: string;
  maxSupply: string; mintPrice: string; maxMintPerWallet: string;
};
export type NFTProject = NFTLaunchDraft & {
  collection: string; creator: string; createdAt: number; totalMinted: string;
};
