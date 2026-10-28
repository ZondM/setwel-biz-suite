import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function Layout() {
  // On phones the sidebar slides in over the page; on larger screens it is always shown.
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  React.useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-brand-panel">
      <Sidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
