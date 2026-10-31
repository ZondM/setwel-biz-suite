import React, { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isStaffDevice, syncStatus } from '../../core/sync';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function Layout() {
  // On phones the sidebar slides in over the page; on larger screens it is always shown.
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  React.useEffect(() => setMenuOpen(false), [location.pathname]);

  // A staff laptop may only open quotes, invoices, customers and help
  if (isStaffDevice()) {
    if (syncStatus().revoked) return <RemovedLaptop />;
    if (!/^\/(quotes|invoices|customers|help)(\/|$)/.test(location.pathname)) return <Navigate to="/invoices" replace />;
  }

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

function RemovedLaptop() {
  return (
    <div className="min-h-screen bg-brand-panel flex items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h2 className="font-display text-2xl font-bold text-brand-navy mb-2">This laptop was removed</h2>
        <p className="text-gray-600">The owner has removed this laptop from the business, so it can no longer open the books. Contact the owner if this is a mistake.</p>
      </div>
    </div>
  );
}
