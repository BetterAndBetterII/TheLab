import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Logout.module.css';

const Logout: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    handleLogout();
  }, []);

  const handleLogout = async () => {
    try {
      // 清除本地存储的 token
      localStorage.removeItem('token');

      // 模拟退出登录请求
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 重定向到登录页面
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.icon}>👋</div>
        <h1 className={styles.title}>正在退出...</h1>
        <p className={styles.message}>感谢您使用我们的服务</p>
      </div>
    </div>
  );
};

export default Logout;
