import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import Deploy from "@/pages/Deploy";
import Docs from "@/pages/Docs";
import Logs from "@/pages/Logs";
import Trending from "@/pages/Trending";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/deploy" element={<Deploy />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/trending" element={<Trending />} />
        </Routes>
      </Layout>
    </Router>
  );
}
