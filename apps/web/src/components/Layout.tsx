import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navigation } from './Navigation';
import './Layout.css';

export const Layout: React.FC = () => {
  return (
    <div className="app-layout">
      <Navigation />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
};
