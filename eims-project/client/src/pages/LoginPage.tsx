import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/services/api';
import { Eye, EyeOff, GraduationCap } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.login(email, password);
      const { user, tokens } = response.data.data;
      setAuth(user, tokens);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (email: string) => {
    setEmail(email);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 text-white p-12 flex-col justify-center">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-7 h-7" />
            </div>
            <h1 className="text-3xl font-bold">ExamFlow</h1>
          </div>
          <p className="text-xl mb-6">Exam Information Management System for UP Tacloban</p>
          <ul className="space-y-4 text-white/80">
            <li className="flex items-center gap-3">
              <span className="w-2 h-2 bg-white/60 rounded-full" />
              Create and manage examinations
            </li>
            <li className="flex items-center gap-3">
              <span className="w-2 h-2 bg-white/60 rounded-full" />
              Real-time announcements & notifications
            </li>
            <li className="flex items-center gap-3">
              <span className="w-2 h-2 bg-white/60 rounded-full" />
              Results publishing & regrade workflows
            </li>
          </ul>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">ExamFlow</h1>
          </div>

          <div className="card p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-600 mb-6">Sign in to your account</p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@up.edu.ph"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            {/* Demo credentials */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 text-center mb-3">Demo Credentials</p>
              <div className="flex gap-2">
                {[
                  { label: 'Admin', email: 'admin@up.edu.ph' },
                  { label: 'Faculty', email: 'faculty@up.edu.ph' },
                  { label: 'Student', email: 'student@up.edu.ph' },
                ].map((cred) => (
                  <button
                    key={cred.email}
                    type="button"
                    onClick={() => fillCredentials(cred.email)}
                    className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {cred.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            CMSC 135 • Data Communication and Networking
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
