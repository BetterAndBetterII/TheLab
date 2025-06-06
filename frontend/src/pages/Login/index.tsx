import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Loading from '../../components/Loading';
import { authApi } from '../../api';
import { Github, Mail } from 'lucide-react';

interface Provider {
  name: string;
  url: string;
  client_id: string;
}

const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    general: '',
  });
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);

  const ICON_MAP = {
    github: <Github size={18} />,
    google: <Mail size={18} />,
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // 清除错误提示
    setErrors((prev) => ({
      ...prev,
      [name]: '',
      general: '',
    }));
  };

  const validateForm = () => {
    const newErrors = {
      email: '',
      password: '',
      general: '',
    };
    let isValid = true;

    if (!formData.email) {
      newErrors.email = '请输入邮箱';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = '请输入密码';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      setLoading(true);
      try {
        const user = await authApi.login(formData);
        if (user) {
          // 登录成功后跳转到首页
          window.location.href = "/";
        } else {
          setErrors(prev => ({
            ...prev,
            general: '登录失败，请重试',
          }));
        }
      } catch (error) {
        console.error('Login failed:', error);
        setErrors(prev => ({
          ...prev,
          general: error instanceof Error ? error.message : '登录失败，请重试',
        }));
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    authApi.getProviders().then(res => {
      setProviders(res);
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 fixed inset-0">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-10">
        <div className="text-center mb-10">
          <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent mb-5">TheLab</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">欢迎回来</h2>
          <p className="text-gray-500">请登录您的账号</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {errors.general && (
            <div className="text-red-600 text-sm">
              {errors.general}
            </div>
          )}

          <div className="flex flex-col gap-2 text-left">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              邮箱
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full py-3 px-4 border border-gray-300 rounded-lg text-base text-gray-800 transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              placeholder="your@email.com"
            />
            {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
          </div>

          <div className="flex flex-col gap-2 text-left">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              密码
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full py-3 px-4 border border-gray-300 rounded-lg text-base text-gray-800 transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-blue-500 text-white font-medium text-base rounded-lg transition-colors hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? <Loading size="small" text="" /> : '登录'}
          </button>
        </form>

        <div className="flex items-center my-6 text-gray-500 text-sm">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="px-4">或</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        <div className="flex gap-4">
          {providers.map(provider => (
            <button
              key={provider.name}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-100 hover:border-gray-400 transition-all"
              onClick={() => window.location.href = provider.url}
            >
              <span className="flex items-center gap-2">{ICON_MAP[provider.name as keyof typeof ICON_MAP]} {provider.name} 登录</span>
            </button>
          ))}
        </div>

        <div className="text-center mt-6 text-sm text-gray-500">
          还没有账号？{' '}
          <Link to="/register" className="text-blue-500 font-medium hover:text-blue-600 hover:underline">
            立即注册
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;

