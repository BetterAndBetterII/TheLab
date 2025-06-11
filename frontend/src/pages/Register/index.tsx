import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900 p-5">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-10 w-full max-w-[420px] shadow-lg">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-4">TheLab</div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 m-0 mb-2">创建账号</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 m-0">
            {step === 'request' ? '请输入您的邮箱地址' : '请完成注册'}
          </p>
        </div>

        {step === 'request' ? (
          <form onSubmit={handleRequestVerification} className="flex flex-col gap-5">
            {errors.general && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">{errors.general}</div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                邮箱
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleEmailChange}
                className="p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm transition-colors duration-200 focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                placeholder="your@email.com"
              />
              {errors.email && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white border-none rounded-lg p-3 text-sm font-medium cursor-pointer transition-colors duration-200 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? <Loading size="small" text="" /> : '获取验证码'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyAndRegister} className="flex flex-col gap-5">
            {errors.general && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">{errors.general}</div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="code" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                验证码
              </label>
              <input
                type="text"
                id="code"
                name="code"
                value={verificationData.code}
                onChange={handleVerificationDataChange}
                className="p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm transition-colors duration-200 focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                placeholder="请输入验证码"
              />
              {errors.code && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.code}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="username" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                用户名
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={verificationData.username}
                onChange={handleVerificationDataChange}
                className="p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm transition-colors duration-200 focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                placeholder="请输入用户名"
              />
              {errors.username && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.username}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                密码
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={verificationData.password}
                onChange={handleVerificationDataChange}
                className="p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm transition-colors duration-200 focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                placeholder="请输入密码"
              />
              {errors.password && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.password}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                确认密码
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={verificationData.confirmPassword}
                onChange={handleVerificationDataChange}
                className="p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm transition-colors duration-200 focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                placeholder="请再次输入密码"
              />
              {errors.confirmPassword && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="fullName" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                姓名（选填）
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={verificationData.fullName}
                onChange={handleVerificationDataChange}
                className="p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm transition-colors duration-200 focus:outline-none focus:border-blue-600 dark:focus:border-blue-400"
                placeholder="请输入您的姓名"
              />
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white border-none rounded-lg p-3 text-sm font-medium cursor-pointer transition-colors duration-200 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? <Loading size="small" text="" /> : '注册'}
            </button>

            <button
              type="button"
              className="bg-transparent text-blue-600 dark:text-blue-400 border-none p-2 text-sm cursor-pointer transition-colors duration-200 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
              onClick={() => setStep('request')}
            >
              返回修改邮箱
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          已有账号？{' '}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 no-underline font-medium transition-colors duration-200 hover:text-blue-700 dark:hover:text-blue-300 hover:underline">
            立即登录
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
