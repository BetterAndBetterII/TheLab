import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Register.module.css';
import Loading from '../../components/Loading';
import { authApi } from '../../api';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [verificationData, setVerificationData] = useState({
    code: '',
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });
  const [errors, setErrors] = useState({
    email: '',
    code: '',
    username: '',
    password: '',
    confirmPassword: '',
    general: '',
  });
  const [loading, setLoading] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setErrors(prev => ({ ...prev, email: '', general: '' }));
  };

  const handleVerificationDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setVerificationData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '', general: '' }));
  };

  const validateEmail = () => {
    if (!email) {
      setErrors(prev => ({ ...prev, email: '请输入邮箱' }));
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrors(prev => ({ ...prev, email: '请输入有效的邮箱地址' }));
      return false;
    }
    return true;
  };

  const validateVerificationData = () => {
    const newErrors = {
      code: '',
      username: '',
      password: '',
      confirmPassword: '',
      general: '',
      email: '',
    };
    let isValid = true;

    if (!verificationData.code) {
      newErrors.code = '请输入验证码';
      isValid = false;
    }

    if (!verificationData.username) {
      newErrors.username = '请输入用户名';
      isValid = false;
    }

    if (!verificationData.password) {
      newErrors.password = '请输入密码';
      isValid = false;
    } else if (verificationData.password.length < 6) {
      newErrors.password = '密码长度至少为6位';
      isValid = false;
    }

    if (verificationData.password !== verificationData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
      isValid = false;
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return isValid;
  };

  const handleRequestVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail()) return;

    setLoading(true);
    try {
      await authApi.requestVerification(email);
      setStep('verify');
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        general: error instanceof Error ? error.message : '发送验证码失败，请重试',
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateVerificationData()) return;

    setLoading(true);
    try {
      await authApi.verifyAndRegister({
        email,
        code: verificationData.code,
        username: verificationData.username,
        password: verificationData.password,
        full_name: verificationData.fullName || undefined,
      });
      // 注册成功后跳转到登录页
      navigate('/login', { state: { message: '注册成功，请登录' } });
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        general: error instanceof Error ? error.message : '注册失败，请重试',
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>TheLab</div>
          <h2 className={styles.title}>创建账号</h2>
          <p className={styles.subtitle}>
            {step === 'request' ? '请输入您的邮箱地址' : '请完成注册'}
          </p>
        </div>

        {step === 'request' ? (
          <form onSubmit={handleRequestVerification} className={styles.form}>
            {errors.general && (
              <div className={styles.errorMessage}>{errors.general}</div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                邮箱
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleEmailChange}
                className={styles.input}
                placeholder="your@email.com"
              />
              {errors.email && <p className={styles.error}>{errors.email}</p>}
            </div>

            <button
              type="submit"
              className={styles.button}
              disabled={loading}
            >
              {loading ? <Loading size="small" text="" /> : '获取验证码'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyAndRegister} className={styles.form}>
            {errors.general && (
              <div className={styles.errorMessage}>{errors.general}</div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="code" className={styles.label}>
                验证码
              </label>
              <input
                type="text"
                id="code"
                name="code"
                value={verificationData.code}
                onChange={handleVerificationDataChange}
                className={styles.input}
                placeholder="请输入验证码"
              />
              {errors.code && <p className={styles.error}>{errors.code}</p>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="username" className={styles.label}>
                用户名
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={verificationData.username}
                onChange={handleVerificationDataChange}
                className={styles.input}
                placeholder="请输入用户名"
              />
              {errors.username && <p className={styles.error}>{errors.username}</p>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>
                密码
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={verificationData.password}
                onChange={handleVerificationDataChange}
                className={styles.input}
                placeholder="请输入密码"
              />
              {errors.password && <p className={styles.error}>{errors.password}</p>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                确认密码
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={verificationData.confirmPassword}
                onChange={handleVerificationDataChange}
                className={styles.input}
                placeholder="请再次输入密码"
              />
              {errors.confirmPassword && (
                <p className={styles.error}>{errors.confirmPassword}</p>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="fullName" className={styles.label}>
                姓名（选填）
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={verificationData.fullName}
                onChange={handleVerificationDataChange}
                className={styles.input}
                placeholder="请输入您的姓名"
              />
            </div>

            <button
              type="submit"
              className={styles.button}
              disabled={loading}
            >
              {loading ? <Loading size="small" text="" /> : '注册'}
            </button>

            <button
              type="button"
              className={styles.backButton}
              onClick={() => setStep('request')}
            >
              返回修改邮箱
            </button>
          </form>
        )}

        <div className={styles.footer}>
          已有账号？{' '}
          <Link to="/login" className={styles.link}>
            立即登录
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register; 