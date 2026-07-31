import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";

const Home = lazy(() => import("@/pages/Home"));
const Chat = lazy(() => import("@/pages/Chat"));
const Deploy = lazy(() => import("@/pages/Deploy"));
const Docs = lazy(() => import("@/pages/Docs"));
const Logs = lazy(() => import("@/pages/Logs"));
const Trending = lazy(() => import("@/pages/Trending"));
const MemeLaunch = lazy(() => import("@/pages/MemeLaunch"));
const FlapLaunch = lazy(() => import("@/pages/FlapLaunch"));
const IssuedTokens = lazy(() => import("@/pages/IssuedTokens"));
const PageBuilder = lazy(() => import("@/pages/PageBuilder"));
const TokenAudit = lazy(() => import("@/pages/TokenAudit"));
const MintLaunch = lazy(() => import("@/pages/MintLaunch"));
const MintLaunches = lazy(() => import("@/pages/MintLaunches"));
const MintProjectDetail = lazy(() => import("@/pages/MintProjectDetail"));
const NFTLaunch = lazy(() => import("@/pages/NFTLaunch"));
const NFTLaunches = lazy(() => import("@/pages/NFTLaunches"));
const Swap = lazy(() => import("@/pages/Swap"));

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
            <Route path="/swap" element={<Swap />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}
