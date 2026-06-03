import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaWhatsapp } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, token } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (token) return <Navigate to="/dashboard" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(form.email, form.password);
      if (!res.success) setError(res.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      {/* Decorative elements */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />
      <div className="auth-ring auth-ring-1" />
      <div className="auth-ring auth-ring-2" />
      <div className="auth-ring auth-ring-3" />
      <div className="auth-ring auth-ring-4" />
      <div className="auth-diamond auth-diamond-1" />
      <div className="auth-diamond auth-diamond-2" />
      <div className="auth-diamond auth-diamond-3" />
      <div className="auth-rect auth-rect-1" />
      <div className="auth-rect auth-rect-2" />
      <div className="auth-rect auth-rect-3" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 overflow-hidden mx-auto ring-2 ring-purple-500/30">
            <img src="/logo.jpeg" alt="RSendix.pro" className="w-full h-full object-cover" />
          </div>
          <h1 className="auth-logo-text text-2xl sm:text-3xl font-bold">RSendix.pro</h1>
          <p className="auth-logo-sub mt-1 text-xs sm:text-sm font-medium tracking-wider">SMART BULK MESSAGING PLATFORM</p>
          <p className="auth-logo-desc mt-2">Sign in to your account</p>
        </div>

        <div className="auth-card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Email Address</label>
              <input
                type="email"
                className="input-field"
                placeholder="Enter your email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 rounded-xl text-white font-semibold disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            Contact admin for account access
          </p>
        </div>

        <p className="text-center text-sm auth-logo-desc mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-link font-medium">Register</Link>
        </p>

        <p className="text-center text-xs auth-logo-desc mt-2 opacity-70">
          Admin: admin@digitalsms.biz / Admin@123
        </p>
      </motion.div>
    </div>
  );
}
