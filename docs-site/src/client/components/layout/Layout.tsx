import type { ReactNode } from 'react';
import { TopBar } from './TopBar.js';
import { Sidebar } from './Sidebar.js';
import { MainContent } from './MainContent.js';

// ---------------------------------------------------------------------------
// Layout — main 3-panel layout (TopBar + Sidebar + MainContent)
// ---------------------------------------------------------------------------

export function Layout({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-primary">
      {/* Top Bar */}
      <TopBar />

      {/* Main area: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
