import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { 
  Home, 
  MessageSquare, 
  Settings, 
  Menu, 
  ChevronLeft, 
  ChevronRight, 
  Search,
  Bookmark,
} from 'lucide-react';
import { SiGithub } from '@icons-pack/react-simple-icons';

export default function Navbar(
  {
    isCollapsed,
    setIsCollapsed,
  }: {
    isCollapsed: boolean;
    setIsCollapsed: (isCollapsed: boolean) => void;
  }
) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsCollapsed(false);
        localStorage.setItem('isNavCollapsed', 'false');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location.pathname, isMobile]);

  const isLoginPage = location.pathname === '/login';
  if (isLoginPage) return null;

  const menuItems = [
    { path: '/', icon: <Home size={20} />, label: '主页' },
    { path: '/chat', icon: <MessageSquare size={20} />, label: '聊天' },
    { path: '/search', icon: <Search size={20} />, label: '搜索' },
    { path: '/settings', icon: <Settings size={20} />, label: '设置' },
  ];

  const toggleCollapse = () => {
    if (!isMobile) {
      setIsCollapsed(!isCollapsed);
      localStorage.setItem('isNavCollapsed', !isCollapsed ? 'true' : 'false');
      // 触发一个自定义事件，通知其他组件导航栏状态改变
      window.dispatchEvent(new CustomEvent('navbarToggle', { detail: { isCollapsed: !isCollapsed } }));
    }
  };

  const handleMenuItemClick = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {document.location.pathname === '/' && <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <Link 
          to="https://github.com/BetterAndBetterII/TheLab"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm font-medium no-underline transition-all duration-200 shadow-sm hover:bg-gray-800 hover:dark:bg-gray-700 hover:border-gray-800 hover:dark:border-gray-700 hover:text-white hover:shadow-md hover:-translate-y-0.5 min-w-[80px] touch-manipulation"
        >
          <SiGithub size={16} className="sm:w-[18px] sm:h-[18px]" />
          <span>GitHub</span>
        </Link>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Menu size={24} />
        </Button>
      </div>}

      <nav className={cn(
        "fixed top-0 left-0 h-full bg-background border-r border-border transition-all duration-300 z-40",
        isCollapsed ? "w-[85px]" : "w-[240px]",
        isMobile && !isOpen ? "-translate-x-full" : "translate-x-0"
      )}>
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="flex items-center gap-3" onClick={handleMenuItemClick}>
              <span className="text-2xl">🧪</span>
              {!isCollapsed && (
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                  TheLab
                </span>
              )}
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex"
              onClick={toggleCollapse}
              title={isCollapsed ? '展开导航栏' : '收起导航栏'}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </Button>
          </div>

          <div className="flex flex-col space-y-1 flex-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleMenuItemClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                  location.pathname === item.path 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                title={isCollapsed ? item.label : ''}
              >
                <div className="flex-shrink-0">{item.icon}</div>
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </div>

          {/* 关于我们链接 */}
          <div className="mt-auto pt-4 border-t border-border">
            <Link
              to="/about"
              onClick={handleMenuItemClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                location.pathname === '/about'
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              title={isCollapsed ? '关于我们' : ''}
            >
              <div className="flex-shrink-0">
                <Bookmark size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              {!isCollapsed && <span>关于我们</span>}
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}

