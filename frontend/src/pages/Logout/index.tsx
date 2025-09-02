import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg animate-fadeIn">
        <div className="text-5xl mb-4 animate-wave">👋</div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">正在退出...</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">感谢您使用我们的服务</p>
      </div>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes wave {
          0% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-10deg);
          }
          75% {
            transform: rotate(10deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
        .animate-wave {
          animation: wave 1s infinite;
        }
      `}</style>
    </div>
  );
};

export default Logout;
