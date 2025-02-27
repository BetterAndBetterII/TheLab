import React from 'react';
import styles from './About.module.css';

const About: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>关于我们</h1>
        <p className={styles.subtitle}>
          TheLab 是一个现代化的在线协作平台，致力于为用户提供最佳的工作体验。
        </p>
      </div>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>我们的使命</h2>
          <p className={styles.text}>
            我们的使命是通过技术创新，为用户提供一个高效、安全、便捷的在线工作环境，
            帮助团队更好地协作和沟通。
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
                  安全可靠的文件存储和共享功能，支持多种文件格式。
                </p>
              </div>
            </li>
            <li className={styles.featureItem}>
              <span className={styles.featureIcon}>💬</span>
              <div>
                <h3 className={styles.featureTitle}>即时通讯</h3>
                <p className={styles.featureText}>
                  实时的团队沟通工具，支持文字、语音和视频通话。
                </p>
              </div>
            </li>
            <li className={styles.featureItem}>
              <span className={styles.featureIcon}>📝</span>
              <div>
                <h3 className={styles.featureTitle}>在线论坛</h3>
                <p className={styles.featureText}>
                  分享知识和经验的社区平台，促进团队成员之间的交流。
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>联系我们</h2>
          <p className={styles.text}>
            如果您有任何问题或建议，欢迎随时与我们联系：
          </p>
          <div className={styles.contactInfo}>
            <p>
              <strong>邮箱：</strong> support@thelab.com
            </p>
            <p>
              <strong>电话：</strong> +86 123 4567 8900
            </p>
            <p>
              <strong>地址：</strong> 中国上海市浦东新区科技园区888号
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
