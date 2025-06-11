import React, { useState, useEffect } from 'react';
import Loading from '../../components/Loading';
import FileList from '../../components/FileList';
import { Github } from 'lucide-react';
import confetti from 'canvas-confetti';

const Home: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [confettiShown, setConfettiShown] = useState(false);

  useEffect(() => {
    // 设置加载状态
    setLoading(false);

    // 彩带显示逻辑
    const checkConfettiDisplay = () => {
      // 检查是否已经在本地存储中记录过显示
      const hasShownConfetti = localStorage.getItem('confettiShown');

      // 检查当前日期是否在截止日期之前
      const currentDate = new Date();
      const endDate = new Date('2025-03-27');

      // 如果没有显示过，并且当前日期在截止日期之前，显示彩带
      if (!hasShownConfetti && currentDate < endDate) {
        setTimeout(() => {
          // 多彩的彩带效果
          const duration = 1000;
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

          function randomInRange(min: number, max: number): number {
            return Math.random() * (max - min) + min;
          }

          const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 70 * (timeLeft / duration);

            // 从左侧发射
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
            });

            // 从右侧发射
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
            });
          }, 250);

          // 标记为已显示
          localStorage.setItem('confettiShown', 'true');
          setConfettiShown(true);
        }, 1000); // 页面加载1秒后显示
      } else {
        // 查看本地存储中是否已标记为显示过
        if (localStorage.getItem('confettiShown') === 'true') {
          setConfettiShown(true);
        }
      }
    };

    checkConfettiDisplay();
  }, []);

  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 h-screen flex flex-col">
        <Loading size="large" text="加载中..." />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 h-screen flex flex-col overflow-hidden">
      {/* 头部区域 */}
      <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-gray-100 dark:border-gray-800">
        {/* 标题区域 */}
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100">
            欢迎回来
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
            这里是您的工作空间，可以方便地管理文件和查看最近的活动。
          </p>
        </div>
        
        {/* 通知区域 */}
        {confettiShown && (
          <div className="w-full">
            <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-900/10 dark:to-sky-900/10 border-l-4 border-blue-500 dark:border-blue-400 rounded-lg text-blue-600 dark:text-blue-400 font-medium home-notice-animation">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 text-sm sm:text-base">
                  🎉 重要通知：我们已正式开源！
                </div>
                <a
                  href="https://github.com/BetterAndBetterII/TheLab"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm font-medium no-underline transition-all duration-200 shadow-sm hover:bg-gray-800 hover:dark:bg-gray-700 hover:border-gray-800 hover:dark:border-gray-700 hover:text-white hover:shadow-md hover:-translate-y-0.5 min-w-[80px] touch-manipulation"
                >
                  <Github size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <span>Star</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* 文件管理器 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-sm sm:shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden h-full flex flex-col">
          <FileList
            className="flex-1 min-h-0 overflow-auto h-full"
          />
        </div>
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
        
        .home-notice-animation {
          animation: fadeIn 0.5s ease-in-out;
        }

        /* 移动端优化 */
        @media (max-width: 640px) {
          .touch-manipulation {
            touch-action: manipulation;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            -khtml-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
          }
          
          /* 确保移动端按钮有足够的点击区域 */
          .touch-manipulation {
            min-height: 44px;
          }
          
          /* 优化移动端滚动 */
          .overflow-auto {
            -webkit-overflow-scrolling: touch;
          }
          
          /* 防止双击缩放 */
          * {
            touch-action: manipulation;
          }
          
          /* 优化移动端字体渲染 */
          body {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          /* 移动端聚焦时防止页面缩放 */
          input, textarea, select {
            font-size: 16px;
          }
        }
        
        /* 通用移动端优化 */
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        /* 触摸友好的交互反馈 */
        @media (hover: none) and (pointer: coarse) {
          .hover\:bg-gray-50:hover {
            background-color: transparent;
          }
          
          .hover\:bg-gray-200:hover {
            background-color: transparent;
          }
          
          /* 激活状态反馈 */
          button:active {
            transform: scale(0.98);
            transition: transform 0.1s ease;
          }
        }
      `}</style>
    </div>
  );
};

export default Home;