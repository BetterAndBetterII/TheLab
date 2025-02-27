import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';
import { FiHome, FiMail, FiMessageSquare, FiSettings, FiMenu, FiChevronLeft, FiChevronRight, FiUsers } from 'react-icons/fi';

export default function Navbar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isLoginPage = location.pathname === '/login';
  if (isLoginPage) return null;

  const menuItems = [
    { path: '/', icon: <FiHome size={20} />, label: '主页' },
    { path: '/chat', icon: <FiMessageSquare size={20} />, label: '聊天' },
    { path: '/forum', icon: <FiUsers size={20} />, label: '论坛' },
    { path: '/email', icon: <FiMail size={20} />, label: '邮件' },
    { path: '/settings', icon: <FiSettings size={20} />, label: '设置' },
  ];

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    // 触发一个自定义事件，通知其他组件导航栏状态改变
    window.dispatchEvent(new CustomEvent('navbarToggle', { detail: { isCollapsed: !isCollapsed } }));
  };

  return (
    <>
      <button
        className={styles.mobileMenuButton}
        onClick={() => setIsOpen(!isOpen)}
      >
        <FiMenu size={24} />
      </button>

      <nav className={`${styles.navbar} ${isOpen ? styles.open : ''} ${isCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.container}>
          <div className={styles.header}>
            <Link to="/" className={styles.brand}>
              <span className={styles.logoIcon}>🧪</span>
              <span className={styles.logoText}>TheLab</span>
            </Link>

            <button
              className={styles.collapseButton}
              onClick={toggleCollapse}
              title={isCollapsed ? '展开导航栏' : '收起导航栏'}
            >
              {isCollapsed ? <FiChevronRight size={20} /> : <FiChevronLeft size={20} />}
            </button>

            <div className={styles.desktopMenu}>
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`${styles.menuItem} ${
                    location.pathname === item.path ? styles.activeMenuItem : ''
                  }`}
                  title={isCollapsed ? item.label : ''}
                >
                  {item.icon}
                  <span className={styles.menuLabel}>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
