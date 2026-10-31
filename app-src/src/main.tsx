import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initDatabase } from './db/database';

function Loader() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-brand-navy text-white gap-4">
      <div className="font-display font-extrabold text-2xl tracking-tight">
        Setwel <span className="text-brand-gold">Biz Suite</span>
      </div>
      <div className="text-sm text-white/60">Loading your business data…</div>
    </div>
  );
}

// Phone/browser version: let it open without internet (the service worker lives at the site root).
if (!window.setwelDesktop && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const root = createRoot(document.getElementById('root')!);
root.render(<Loader />);

initDatabase()
  .then(() => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch((err) => {
    console.error('Failed to start database', err);
    root.render(
      <div className="h-screen w-screen flex items-center justify-center bg-white p-8">
        <div className="max-w-md text-center">
          <h1 className="font-display text-xl font-bold text-brand-navy mb-2">Couldn't start the app</h1>
          <p className="text-sm text-gray-600">Something went wrong loading your local database. Try restarting the app. If this keeps happening, your data file may be damaged.</p>
        </div>
      </div>
    );
  });
