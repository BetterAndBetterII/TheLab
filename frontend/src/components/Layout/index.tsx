import React, { useState, useEffect } from 'react';
import Navbar from '../Navbar';
import styles from '../../styles/layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  useEffect(() => {
    const handleNavToggle = (e: CustomEvent<{ isCollapsed: boolean }>) => {
      setIsNavCollapsed(e.detail.isCollapsed);
    };

    window.addEventListener('navbarToggle', handleNavToggle as EventListener);
    return () => {
      window.removeEventListener('navbarToggle', handleNavToggle as EventListener);
    };
  }, []);

  return (
    <>
      <Navbar />
      <main className={`${styles.mainContent} ${isNavCollapsed ? styles.navCollapsed : ''}`}>
        {children}
      </main>
    </>
  );
}
