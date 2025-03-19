import React from 'react';
import styles from './About.module.css';
import { Link } from 'react-router-dom';
import { RiHome5Line } from 'react-icons/ri';
import { FaGithub } from 'react-icons/fa';

const About: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          关于🧪
          <span className={styles.logoText}>TheLab</span>
        </h1>
        <p className={styles.subtitle}>
          TheLab是一个将AI与交互放在首位的平台，致力于为用户提供最佳的学习体验。TheLab承诺长期免费，只要Google Gemini API免费层还在，TheLab就会一直免费。
        </p>
      </div>
      <div className={styles.headerButtons}>
        <a
          href="https://github.com/BetterAndBetterII/TheLab"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubLink}
        >
          <FaGithub /> 访问 GitHub 仓库
        </a>
        <Link to="/" className={styles.homeLink}>
          <RiHome5Line />
          <span>返回首页</span>
        </Link>
      </div>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>我的初衷</h2>
          <p className={styles.text}>
            TheLab目标是以最低的成本保持运营，理想成本（包括电费）控制在1元/天。若遇到上传文件过慢或失败，请耐心重试，或电邮hi@gitfetch.dev协助排查。
            我会在第一时间响应，并尽可能在24小时内尽力解决问题。
            我做的软件都是为了自己的兴趣还有自己的需求，既希望有多点同学可以体验到免费的有意思的AI工具，但又不希望太多人使用。（Gemini 免费API不太多）
            希望大家可以多多支持，多多反馈，多多交流。
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>核心功能</h2>
          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <span className={styles.featureIcon}>📄</span>
              <div>
                <h3 className={styles.featureTitle}>文件管理</h3>
                <p className={styles.featureText}>
                  安全可靠的文件存储和共享功能，支持多种文件格式。（PPT，PDF，Word，Excel）
                </p>
              </div>
            </li>
            <li className={styles.featureItem}>
              <span className={styles.featureIcon}>💬</span>
              <div>
                <h3 className={styles.featureTitle}>AI交互式学习</h3>
                <p className={styles.featureText}>
                  被动式翻译+主动式Quiz。心流与思维导图，全方面理解文本；自动笔记+AI解答，细致理解每一个细节...（太推销的文本自己都看不下去哈哈哈哈）
                </p>
              </div>
            </li>
            <li className={styles.featureItem}>
              <span className={styles.featureIcon}>📝</span>
              <div>
                <h3 className={styles.featureTitle}>共享文件</h3>
                <p className={styles.featureText}>
                  所有人都可以上传文件，并分享给其他用户。
                </p>
              </div>
            </li>
            <li className={styles.featureItem}>
              <span className={styles.featureIcon}>🔓</span>
              <div>
                <h3 className={styles.featureTitle}>开源计划</h3>
                <p className={styles.featureText}>
                  TheLab已开源！点击上方Github仓库链接，点个Star吧~ 欢迎大家来贡献代码。
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>联系我</h2>
          <p className={styles.text}>
            如果您有任何问题或建议，欢迎随时与我们联系：
          </p>
          <div className={styles.contactInfo}>
            <p>
              <strong>邮箱：</strong> hi@gitfetch.dev
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
