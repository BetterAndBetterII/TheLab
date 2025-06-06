import React, { useState } from 'react';
import Navbar from '../Navbar';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isNavCollapsed, setIsNavCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem('isNavCollapsed');
    return stored !== undefined ? stored === 'true' : false;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar isCollapsed={isNavCollapsed} setIsCollapsed={setIsNavCollapsed} />
      <main className={cn(
        "min-h-screen transition-all duration-300",
        isNavCollapsed ? "ml-[85px]" : "ml-[240px]",
      )}>
        {children}
      </main>
    </div>
  );
}
