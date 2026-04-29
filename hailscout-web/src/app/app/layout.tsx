import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";

/**
 * Authenticated app shell.
 *
 * Important: <main> uses overflow-hidden, not overflow-auto.
 * Routes that need scrolling (Reports, Addresses) wrap their own
 * content in an overflow-y-auto container. The Map page is full-bleed
 * and *needs* its child h-full to actually be the constrained
 * remaining viewport — overflow-auto would let it grow unbounded
 * and the map would render with 0 effective height.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
