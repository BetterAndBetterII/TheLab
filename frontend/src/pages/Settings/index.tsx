import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Settings.module.css';
import { FiLogOut } from 'react-icons/fi';

interface UserSettings {
  email: string;
  fullName: string;
  bio: string;
  notifications: {
    email: boolean;
    push: boolean;
  };
  theme: 'light' | 'dark' | 'system';
  language: string;
  aiKeys: {
    openai: string;
    gemini: string;
    deepseek: string;
  };
}

const Settings: React.FC = () => {
  const { logout } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({
    email: '',
    fullName: '',
    bio: '',
    notifications: {
      email: true,
      push: true,
    },
    theme: 'system',
    language: 'en',
    aiKeys: {
      openai: '',
      gemini: '',
      deepseek: '',
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationChange = (key: keyof typeof settings.notifications) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: !prev.notifications[key] },
    }));
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  const renderProfileSettings = () => (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>个人信息</h2>
        <p className={styles.sectionDescription}>
          管理您的个人信息和账户设置
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>邮箱</label>
          <input
            type="email"
            className={styles.input}
            value={settings.email}
            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
            placeholder="your@email.com"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>全名</label>
          <input
            type="text"
            className={styles.input}
            value={settings.fullName}
            onChange={(e) => setSettings({ ...settings, fullName: e.target.value })}
            placeholder="您的姓名"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>个人简介</label>
          <textarea
            className={styles.input}
            value={settings.bio}
            onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
            placeholder="简单介绍一下自己..."
            rows={4}
          />
        </div>

        <button type="submit" className={styles.button} disabled={saving}>
          {saving ? '保存中...' : '保存更改'}
        </button>

        <div className={styles.dangerZone}>
          <h3>危险区域</h3>
          <button
            type="button"
            onClick={logout}
            className={`${styles.button} ${styles.dangerButton}`}
          >
            <FiLogOut size={20} />
            <span>退出登录</span>
          </button>
        </div>
      </form>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>通知设置</h2>
        <p className={styles.sectionDescription}>
          自定义您想要接收的通知类型
        </p>
      </div>

      <div className={styles.form}>
        <label className={styles.switch}>
          <input
            type="checkbox"
            className={styles.switchInput}
            checked={settings.notifications.email}
            onChange={() => handleNotificationChange('email')}
          />
          <span className={styles.switchSlider}></span>
          <span className={styles.switchLabel}>电子邮件通知</span>
        </label>

        <label className={styles.switch}>
          <input
            type="checkbox"
            className={styles.switchInput}
            checked={settings.notifications.push}
            onChange={() => handleNotificationChange('push')}
          />
          <span className={styles.switchSlider}></span>
          <span className={styles.switchLabel}>推送通知</span>
        </label>
      </div>
    </div>
  );

  const renderAISettings = () => (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>AI API 设置</h2>
        <p className={styles.sectionDescription}>
          配置各个 AI 服务的 API Key，请妥善保管您的密钥
        </p>
      </div>

      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="openai" className={styles.label}>
            OpenAI API Key
          </label>
          <input
            type="password"
            id="openai"
            value={settings.aiKeys.openai}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                aiKeys: { ...prev.aiKeys, openai: e.target.value },
              }))
            }
            className={styles.input}
            placeholder="sk-..."
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="gemini" className={styles.label}>
            Gemini API Key
          </label>
          <input
            type="password"
            id="gemini"
            value={settings.aiKeys.gemini}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                aiKeys: { ...prev.aiKeys, gemini: e.target.value },
              }))
            }
            className={styles.input}
            placeholder="Enter your Gemini API Key"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="deepseek" className={styles.label}>
            DeepSeek API Key
          </label>
          <input
            type="password"
            id="deepseek"
            value={settings.aiKeys.deepseek}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                aiKeys: { ...prev.aiKeys, deepseek: e.target.value },
              }))
            }
            className={styles.input}
            placeholder="Enter your DeepSeek API Key"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>设置</h1>
        <p className={styles.subtitle}>
          管理您的账户设置和偏好
        </p>
      </div>

      <div className={styles.grid}>
        <nav className={styles.nav}>
          <button
            className={`${styles.navItem} ${
              activeTab === 'profile' ? styles.navItemActive : ''
            }`}
            onClick={() => setActiveTab('profile')}
          >
            👤 个人资料
          </button>
          <button
            className={`${styles.navItem} ${
              activeTab === 'notifications' ? styles.navItemActive : ''
            }`}
            onClick={() => setActiveTab('notifications')}
          >
            🔔 通知设置
          </button>
          <button
            className={`${styles.navItem} ${
              activeTab === 'ai' ? styles.navItemActive : ''
            }`}
            onClick={() => setActiveTab('ai')}
          >
            🤖 AI 设置
          </button>
        </nav>

        <div className={styles.section}>
          {activeTab === 'profile' && renderProfileSettings()}
          {activeTab === 'notifications' && renderNotificationSettings()}
          {activeTab === 'ai' && renderAISettings()}
        </div>
      </div>
    </div>
  );
};

export default Settings;
