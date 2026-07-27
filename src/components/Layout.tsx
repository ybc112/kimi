import { Header } from "./Header";
import { Toast } from "./Toast";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0B0D0E] text-[#E8E8E8]">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl p-4 lg:p-6">{children}</div>
      </main>
      <Toast />
    </div>
  );
}
