import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";

// 路由懒加载兜底：部署更新后旧资源被清理，缓存中的旧 chunk 会加载失败，
// 此时刷新一次页面拉取最新的 index.html 即可自愈。
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  let retried = false;
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (!retried) {
        retried = true;
        window.location.reload();
      }
      throw error;
    }
  });
}

const Home = lazyWithRetry(() => import("@/pages/Home"));
const Chat = lazyWithRetry(() => import("@/pages/Chat"));
const Deploy = lazyWithRetry(() => import("@/pages/Deploy"));
const Docs = lazyWithRetry(() => import("@/pages/Docs"));
const Logs = lazyWithRetry(() => import("@/pages/Logs"));
const Trending = lazyWithRetry(() => import("@/pages/Trending"));
const MemeLaunch = lazyWithRetry(() => import("@/pages/MemeLaunch"));
const FlapLaunch = lazyWithRetry(() => import("@/pages/FlapLaunch"));
const IssuedTokens = lazyWithRetry(() => import("@/pages/IssuedTokens"));
const PageBuilder = lazyWithRetry(() => import("@/pages/PageBuilder"));
const TokenAudit = lazyWithRetry(() => import("@/pages/TokenAudit"));
const MintLaunch = lazyWithRetry(() => import("@/pages/MintLaunch"));
const MintLaunches = lazyWithRetry(() => import("@/pages/MintLaunches"));
const MintProjectDetail = lazyWithRetry(() => import("@/pages/MintProjectDetail"));
const NFTLaunch = lazyWithRetry(() => import("@/pages/NFTLaunch"));
const NFTLaunches = lazyWithRetry(() => import("@/pages/NFTLaunches"));
const NFTProjectDetail = lazyWithRetry(() => import("@/pages/NFTProjectDetail"));
const Swap = lazyWithRetry(() => import("@/pages/Swap"));

function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-[#9CA3AF]">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#D0FF00]" />
      页面加载中…
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/vault" element={<Chat />} />
            <Route path="/meme-launch" element={<MemeLaunch />} />
            <Route path="/deploy" element={<Deploy />} />
            <Route path="/flap-launch" element={<FlapLaunch />} />
            <Route path="/issued-tokens" element={<IssuedTokens />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/page-builder" element={<PageBuilder />} />
            <Route path="/token-audit" element={<TokenAudit />} />
            <Route path="/mint-launch" element={<MintLaunch />} />
            <Route path="/mint-launches" element={<MintLaunches />} />
            <Route path="/mint-project/:token" element={<MintProjectDetail />} />
            <Route path="/nft-launch" element={<NFTLaunch />} />
            <Route path="/nft-launches" element={<NFTLaunches />} />
            <Route path="/nft/:collection" element={<NFTProjectDetail />} />
            <Route path="/swap" element={<Swap />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}
