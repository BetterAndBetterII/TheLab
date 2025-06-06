import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Login.module.css';
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
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>TheLab</div>
          <h2 className={styles.title}>欢迎回来</h2>
          <p className={styles.subtitle}>请登录您的账号</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {errors.general && (
            <div className={styles.errorMessage}>
              {errors.general}
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              邮箱
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={styles.input}
              placeholder="your@email.com"
            />
            {errors.email && <p className={styles.error}>{errors.email}</p>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              密码
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={styles.input}
              placeholder="••••••••"
            />
            {errors.password && <p className={styles.error}>{errors.password}</p>}
          </div>

          <button
            type="submit"
            className={styles.button}
            disabled={loading}
          >
            {loading ? <Loading size="small" text="" /> : '登录'}
          </button>
        </form>

        <div className={styles.divider}>
          <span>或</span>
        </div>

        <div className={styles.socialButtons}>
          {providers.map(provider => (
            <button
              key={provider.name}
              className={styles.socialButton}
              onClick={() => window.location.href = provider.url}
            >
              <span>{ICON_MAP[provider.name as keyof typeof ICON_MAP]} {provider.name} 登录</span>
            </button>
          ))}
        </div>

        <div className={styles.footer}>
          还没有账号？{' '}
          <Link to="/register" className={styles.link}>
            立即注册
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;

