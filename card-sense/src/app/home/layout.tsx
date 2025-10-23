import Link from 'next/link';
// Added CreditCard to the import list
import { Home, Bot, Info, LogOut, CreditCard } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Added font-mono here to apply the credit card style font
    <div className="flex h-screen w-full bg-[#561530] text-white font-mono">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-[#811844] bg-[#561530]/80 p-4">
        <div className="mb-8 flex items-center gap-2">
          {/* Now CreditCard icon can be used */}
          <CreditCard className="h-8 w-8 text-[#F5AD18]" />
          <span className="text-2xl font-bold tracking-tight">CardSense</span>
        </div>
        <nav className="flex flex-col gap-2">
          <Link
            href="/home"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-300 transition-all hover:bg-[#811844] hover:text-white",
              // Add active state logic if needed based on pathname
            )}
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </Link>
          {/* Link to AI assistant page is removed as it's integrated */}
          <Link
            href="/home/info" // Link to the new Info page
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-300 transition-all hover:bg-[#811844] hover:text-white",
              // Add active state logic if needed based on pathname
            )}
          >
            <Info className="h-5 w-5" />
            <span>Info</span>
          </Link>
        </nav>
        <div className="mt-auto">
          <Link
            href="/" // Link back to the landing page
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-300 transition-all hover:bg-[#811844] hover:text-white",
            )}
          >
            <LogOut className="h-5 w-5" />
            <span>Exit</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-[#561530] p-6">
        {children}
      </div>
    </div>
  );
}

