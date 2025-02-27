import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Login.module.css';
import Loading from '../../components/Loading';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

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
    }));
  };

  const validateForm = () => {
    const newErrors = {
      email: '',
      password: '',
    };
    let isValid = true;

    // 开发模式：跳过邮箱验证
    if (!formData.email && process.env.NODE_ENV !== 'development') {
      newErrors.email = '请输入邮箱';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email) && process.env.NODE_ENV !== 'development') {
      newErrors.email = '请输入有效的邮箱地址';
      isValid = false;
    }

    // 开发模式：跳过密码验证
    if (!formData.password && process.env.NODE_ENV !== 'development') {
      newErrors.password = '请输入密码';
      isValid = false;
    } else if (formData.password.length < 6 && process.env.NODE_ENV !== 'development') {
      newErrors.password = '密码长度至少为6位';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid || process.env.NODE_ENV === 'development';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 开发模式：直接通过验证
    if (process.env.NODE_ENV === 'development' || validateForm()) {
      setLoading(true);
      try {
        // 开发模式：设置模拟token
        localStorage.setItem('token', 'dev-token');
        navigate('/');
      } catch (error) {
        console.error('Login failed:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>TheLab</div>
          <h2 className={styles.title}>欢迎回来</h2>
          <p className={styles.subtitle}>
            {process.env.NODE_ENV === 'development' ? '开发模式：输入任意内容即可登录' : '请登录您的账号'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
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
          <button className={styles.socialButton}>
            <span>谷歌登录</span>
          </button>
          <button className={styles.socialButton}>
            <span>GitHub 登录</span>
          </button>
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
