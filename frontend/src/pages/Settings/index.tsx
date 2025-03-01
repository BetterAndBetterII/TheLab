import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Settings.module.css';
import { FiLogOut, FiAlertCircle } from 'react-icons/fi';
import { settingsApi } from '../../api';

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
  aiConfig: {
    apiKey: string;
    baseUrl: string;
    standardModel: string;
    advancedModel: string;
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
    aiConfig: {
      apiKey: '',
      baseUrl: '',
      standardModel: 'gemini-1.5-flash',
      advancedModel: 'deepseek-r1',
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestPassed, setAiTestPassed] = useState(false);
  const [tempAiSettings, setTempAiSettings] = useState({
    apiKey: '',
    baseUrl: '',
    standardModel: 'gemini-1.5-flash',
    advancedModel: 'deepseek-r1',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const fetchedSettings = await settingsApi.getSettings();
      setSettings({
        ...fetchedSettings,
        aiConfig: fetchedSettings.aiConfig || {
          apiKey: '',
          baseUrl: '',
          standardModel: 'gemini-1.5-flash',
          advancedModel: 'deepseek-r1',
        },
      });
      
      // 初始化临时AI设置
      setTempAiSettings({
        apiKey: fetchedSettings.aiConfig?.apiKey || '',
        baseUrl: fetchedSettings.aiConfig?.baseUrl || '',
        standardModel: fetchedSettings.aiConfig?.standardModel || 'gemini-1.5-flash',
        advancedModel: fetchedSettings.aiConfig?.advancedModel || 'deepseek-r1',
      });
    } catch (error) {
      console.error('获取设置失败:', error);
      setMessage({ 
        type: 'error', 
        text: '获取设置失败: ' + (error instanceof Error ? error.message : '未知错误') 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestAI = async () => {
    setAiTesting(true);
    setMessage(null);
    setAiTestPassed(false);
    
    try {
      await settingsApi.testAISettings({
        apiKey: tempAiSettings.apiKey,
        baseUrl: tempAiSettings.baseUrl,
        standardModel: tempAiSettings.standardModel,
        advancedModel: tempAiSettings.advancedModel,
      });
      
      setAiTestPassed(true);
      setMessage({ type: 'success', text: 'AI 设置测试成功！' });
    } catch (error: any) {
      setAiTestPassed(false);
      const errorMessage = error.response?.data?.detail || error.message || '未知错误';
      setMessage({ type: 'error', text: `测试失败: ${errorMessage}` });
    } finally {
      setAiTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await settingsApi.updateSettings({
        email: settings.email,
        fullName: settings.fullName,
        bio: settings.bio,
        notifications: settings.notifications,
        theme: settings.theme,
        language: settings.language,
      });

      setMessage({ type: 'success', text: '设置保存成功！' });
      
      // 更新成功后刷新设置
      await fetchSettings();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: '保存设置失败: ' + (error instanceof Error ? error.message : '未知错误') 
      });
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
        <h2 className={styles.sectionTitle}>AI 设置</h2>
        <p className={styles.sectionDescription}>
          配置 AI 服务的基本设置，请妥善保管您的密钥
        </p>
      </div>

      <div className={styles.form}>
        {message && message.type === 'error' && (
          <div className={styles.errorMessage}>
            <FiAlertCircle className={styles.errorIcon} size={16} />
            {message.text}
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="apiKey" className={styles.label}>
            API Key
          </label>
          <input
            type="password"
            id="apiKey"
            value={tempAiSettings.apiKey}
            onChange={(e) =>
              setTempAiSettings(prev => ({
                ...prev,
                apiKey: e.target.value,
              }))
            }
            className={styles.input}
            placeholder="输入您的 API Key"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="baseUrl" className={styles.label}>
            Base URL
          </label>
          <input
            type="text"
            id="baseUrl"
            value={tempAiSettings.baseUrl}
            onChange={(e) =>
              setTempAiSettings(prev => ({
                ...prev,
                baseUrl: e.target.value,
              }))
            }
            className={styles.input}
            placeholder="输入 API 的基础 URL"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="standardModel" className={styles.label}>
            标准模型
          </label>
          <input
            type="text"
            id="standardModel"
            value={tempAiSettings.standardModel}
            onChange={(e) =>
              setTempAiSettings(prev => ({
                ...prev,
                standardModel: e.target.value,
              }))
            }
            className={styles.input}
            placeholder="输入标准模型名称"
          />
          <p className={styles.hint}>默认: gemini-1.5-flash</p>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="advancedModel" className={styles.label}>
            高级模型
          </label>
          <input
            type="text"
            id="advancedModel"
            value={tempAiSettings.advancedModel}
            onChange={(e) =>
              setTempAiSettings(prev => ({
                ...prev,
                advancedModel: e.target.value,
              }))
            }
            className={styles.input}
            placeholder="输入高级模型名称"
          />
          <p className={styles.hint}>默认: deepseek-r1</p>
        </div>

        <div className={styles.buttonGroup}>
          <button
            type="button"
            onClick={handleTestAI}
            className={`${styles.button} ${styles.testButton}`}
            disabled={aiTesting || saving}
          >
            {aiTesting ? '测试中...' : '测试连接'}
          </button>
          
          {aiTestPassed && (
            <span className={styles.successBadge}>
              ✓ 测试通过
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      {message && (
        <div className={`${styles.message} ${styles[message.type]}`}>
          {message.type === 'success' ? '✓' : '⚠'} {message.text}
        </div>
      )}
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
