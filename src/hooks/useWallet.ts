import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { BSC_RPC_URL } from "@/lib/contracts/snowball";

export const BSC_CHAIN_ID = 56;

const NETWORK_PARAMS: Record<number, {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}> = {
  56: {
    chainId: "0x38",
    chainName: "BNB Smart Chain Mainnet",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: [BSC_RPC_URL],
    blockExplorerUrls: ["https://bscscan.com"],
  },
  1: {
    chainId: "0x1",
    chainName: "Ethereum Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://ethereum-rpc.publicnode.com"],
    blockExplorerUrls: ["https://etherscan.io"],
  },
  42161: {
    chainId: "0xa4b1",
    chainName: "Arbitrum One",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://arbitrum-one.publicnode.com"],
    blockExplorerUrls: ["https://arbiscan.io"],
  },
  8453: {
    chainId: "0x2105",
    chainName: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://base.publicnode.com"],
    blockExplorerUrls: ["https://basescan.org"],
  },
};

export interface WalletState {
  account: string | null;
  chainId: number | null;
  signer: ethers.JsonRpcSigner | null;
  provider: ethers.BrowserProvider | null;
  isConnected: boolean;
  isBSC: boolean;
  balance: string;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    account: null,
    chainId: null,
    signer: null,
    provider: null,
    isConnected: false,
    isBSC: false,
    balance: "0",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const hasMetaMask = typeof window !== "undefined" && Boolean(window.ethereum);

  const updateStateFromProvider = useCallback(async (provider: ethers.BrowserProvider) => {
    try {
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      const accounts = (await provider.listAccounts()) as ethers.JsonRpcSigner[];
      const account = accounts[0]?.address ?? null;
      const signer = account ? await provider.getSigner() : null;
      let balance = "0";
      if (account) {
        const raw = await provider.getBalance(account);
        balance = ethers.formatEther(raw);
      }

      if (!mounted.current) return;
      setState({
        account,
        chainId,
        signer,
        provider,
        isConnected: Boolean(account),
        isBSC: chainId === BSC_CHAIN_ID,
        balance,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setError(detail);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!hasMetaMask) {
      setError("请安装 MetaMask 钱包");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ethereum = window.ethereum!;
      await ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(ethereum);
      await updateStateFromProvider(provider);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, [hasMetaMask, updateStateFromProvider]);

  const disconnectWallet = useCallback(() => {
    setState({
      account: null,
      chainId: null,
      signer: null,
      provider: null,
      isConnected: false,
      isBSC: false,
      balance: "0",
    });
    setError(null);
  }, []);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (!hasMetaMask) {
      setError("请安装 MetaMask 钱包");
      return;
    }
    const networkParams = NETWORK_PARAMS[targetChainId];
    if (!networkParams) {
      setError(`暂不支持自动切换到 Chain ${targetChainId}`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ethereum = window.ethereum!;
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: networkParams.chainId }],
      });
      const provider = new ethers.BrowserProvider(ethereum);
      await updateStateFromProvider(provider);
    } catch (switchError: unknown) {
      const errCode = (switchError as { code?: number }).code;
      if (errCode === 4902) {
        try {
          const ethereum = window.ethereum!;
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [networkParams],
          });
          const provider = new ethers.BrowserProvider(ethereum);
          await updateStateFromProvider(provider);
        } catch (addError) {
          const detail = addError instanceof Error ? addError.message : String(addError);
          setError(detail);
        }
      } else {
        const detail = switchError instanceof Error ? switchError.message : String(switchError);
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  }, [hasMetaMask, updateStateFromProvider]);

  const switchToBSC = useCallback(() => switchNetwork(BSC_CHAIN_ID), [switchNetwork]);

  useEffect(() => {
    mounted.current = true;
    if (!hasMetaMask) return;

    const ethereum = window.ethereum!;
    const provider = new ethers.BrowserProvider(ethereum);
    updateStateFromProvider(provider);

    const handleAccountsChanged = async () => {
      await updateStateFromProvider(new ethers.BrowserProvider(window.ethereum!));
    };
    const handleChainChanged = async () => {
      await updateStateFromProvider(new ethers.BrowserProvider(window.ethereum!));
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      mounted.current = false;
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [hasMetaMask, updateStateFromProvider]);

  return {
    ...state,
    loading,
    error,
    hasMetaMask,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    switchToBSC,
  };
}
