import React, { useState, useEffect } from 'react';
import Navbar from '../Navbar';
import styles from '../../styles/layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isNavCollapsed, setIsNavCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem('isNavCollapsed');
    return stored !== undefined ? stored === 'true' : false;
  });

  return (
    <>
      <Navbar isCollapsed={isNavCollapsed} setIsCollapsed={setIsNavCollapsed} />
      <main className={`${styles.mainContent} ${isNavCollapsed ? styles.navCollapsed : ''}`}>
        {children}
      </main>
    </>
  );
}
