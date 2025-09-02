import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, AlertCircle } from 'lucide-react';
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
  globalLLM: string;
  globalMODE: string;
  isAdmin: boolean;
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
    globalLLM: 'public',
    globalMODE: 'chat',
    isAdmin: false,
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
        globalLLM: fetchedSettings.globalLLM || 'public',
        globalMODE: fetchedSettings.globalMODE || 'chat',
        isAdmin: fetchedSettings.isAdmin || false,
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

  if (loading) {
    return (
      <div className="w-full h-[calc(100vh-80px)] p-8 overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-600 dark:text-gray-400">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-80px)] p-4 md:p-8 overflow-hidden">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          设置
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-base">
          管理您的账户设置和偏好
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(240px,25%)_1fr] gap-4 md:gap-8 h-[calc(100%-6rem)] overflow-hidden">
        {/* 左侧导航 */}
        <nav className="flex flex-col gap-2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm h-full overflow-y-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'profile'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            个人资料
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'notifications'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            通知
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'ai'
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            AI 设置
          </button>
          {settings.isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === 'admin'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                系统设置
              </button>
            </>
          )}
          <div className="mt-auto">
            <button
              onClick={logout}
              className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 w-full"
            >
              <LogOut size={16} />
              退出登录
            </button>
          </div>
        </nav>

        {/* 右侧内容 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 h-full overflow-y-auto">
          {message && (
            <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}>
              <AlertCircle size={20} />
              {message.text}
            </div>
          )}

          {activeTab === 'profile' && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  个人资料
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  更新您的个人信息
                </p>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    邮箱
                  </label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    全名
                  </label>
                  <input
                    type="text"
                    value={settings.fullName}
                    onChange={(e) => setSettings({ ...settings, fullName: e.target.value })}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    简介
                  </label>
                  <textarea
                    value={settings.bio}
                    onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 min-h-[100px]"
                    rows={4}
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {saving ? '保存中...' : '保存更改'}
                </button>
              </form>
            </>
          )}

          {activeTab === 'notifications' && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  通知设置
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  管理您的通知偏好
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">邮件通知</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.email}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, email: e.target.checked }
                    })}
                    className="w-5 h-5 text-blue-600 bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </label>
                <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">推送通知</span>
                  <input
                    type="checkbox"
                    checked={settings.notifications.push}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, push: e.target.checked }
                    })}
                    className="w-5 h-5 text-blue-600 bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </label>
              </div>
            </>
          )}

          {activeTab === 'ai' && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  AI 设置
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  配置您的私有 AI 服务
                </p>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={tempAiSettings.apiKey}
                    onChange={(e) => setTempAiSettings({ ...tempAiSettings, apiKey: e.target.value })}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder="sk-..."
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    API Base URL
                  </label>
                  <input
                    type="url"
                    value={tempAiSettings.baseUrl}
                    onChange={(e) => setTempAiSettings({ ...tempAiSettings, baseUrl: e.target.value })}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleTestAI}
                    disabled={aiTesting || !tempAiSettings.apiKey || !tempAiSettings.baseUrl}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {aiTesting ? '测试中...' : '测试连接'}
                  </button>
                  {aiTestPassed && (
                    <span className="text-green-600 dark:text-green-400 flex items-center">
                      ✓ 测试通过
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'admin' && settings.isAdmin && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  系统设置
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  管理系统全局配置
                </p>
              </div>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    全局 LLM 提供商
                  </label>
                  <select
                    value={settings.globalLLM}
                    onChange={(e) => setSettings({ ...settings, globalLLM: e.target.value })}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="public">公共 AI</option>
                    <option value="private">私有 AI</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    全局模式
                  </label>
                  <select
                    value={settings.globalMODE}
                    onChange={(e) => setSettings({ ...settings, globalMODE: e.target.value })}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="chat">聊天模式</option>
                    <option value="assistant">助手模式</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;