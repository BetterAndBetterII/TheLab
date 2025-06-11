import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Github } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-4">
          关于🧪
          <span className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-500 hover:to-blue-300">TheLab</span>
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          TheLab是一个将AI与交互放在首位的平台，致力于为用户提供最佳的学习体验。TheLab承诺长期免费，只要Google Gemini API免费层还在，TheLab就会一直免费。
        </p>
      </div>
      
      <div className="flex justify-center gap-4 mb-8">
        <a
          href="https://github.com/BetterAndBetterII/TheLab"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold text-gray-800 dark:text-gray-200 shadow-sm transition-all duration-200 hover:bg-gray-900 dark:hover:bg-gray-700 hover:border-gray-900 dark:hover:border-gray-600 hover:text-white dark:hover:text-white hover:shadow-md hover:-translate-y-0.5"
        >
          <Github size={20} className="transition-colors duration-200" /> 访问 GitHub 仓库
        </a>
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-0.5 hover:shadow-md">
          <Home size={20} className="text-indigo-600 dark:text-indigo-400 transition-transform duration-200 group-hover:-translate-x-1" />
          <span>返回首页</span>
        </Link>
      </div>

      <div className="flex flex-col gap-12">
        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">我的初衷</h2>
          <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
            TheLab目标是以最低的成本保持运营，理想成本（包括电费）控制在1元/天。若遇到上传文件过慢或失败，请耐心重试，或电邮hi@gitfetch.dev协助排查。
            我会在第一时间响应，并尽可能在24小时内尽力解决问题。
            我做的软件都是为了自己的兴趣还有自己的需求，既希望有多点同学可以体验到免费的有意思的AI工具，但又不希望太多人使用。（Gemini 免费API不太多）
            希望大家可以多多支持，多多反馈，多多交流。
          </p>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">核心功能</h2>
          <ul className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
            <li className="flex gap-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
              <span className="text-2xl w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">📄</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">文件管理</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  安全可靠的文件存储和共享功能，支持多种文件格式。（PPT，PDF，Word，Excel）
                </p>
              </div>
            </li>
            <li className="flex gap-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
              <span className="text-2xl w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">💬</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">AI交互式学习</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  被动式翻译+主动式Quiz。心流与思维导图，全方面理解文本；自动笔记+AI解答，细致理解每一个细节...（太推销的文本自己都看不下去哈哈哈哈）
                </p>
              </div>
            </li>
            <li className="flex gap-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
              <span className="text-2xl w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">📝</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">共享文件</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  所有人都可以上传文件，并分享给其他用户。
                </p>
              </div>
            </li>
            <li className="flex gap-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
              <span className="text-2xl w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">🔓</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">开源计划</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  TheLab已开源！点击上方Github仓库链接，点个Star吧~ 欢迎大家来贡献代码。
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">联系我</h2>
          <p className="text-base text-gray-600 dark:text-gray-400">
            如果您有任何问题或建议，欢迎随时与我们联系：
          </p>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong className="text-gray-800 dark:text-gray-200 font-medium mr-2">邮箱：</strong> hi@gitfetch.dev
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;

