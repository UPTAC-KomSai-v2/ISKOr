import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Calendar, Bell, FileText,
  Users, Settings, LogOut, Menu, X, ChevronDown,
  Wifi, WifiOff, User
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { authApi, notificationsApi } from '@/services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, refreshToken } = useAuthStore();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // WebSocket connection
  const { status: wsStatus, subscribe } = useWebSocket({
    onConnect: () => {
      subscribe('announcements');
      subscribe(`user:${user?.id}`);
    },
    onMessage: (message) => {
      if (message.event === 'notification' || message.event === 'announcement:new') {
        setUnreadCount((prev) => prev + 1);
        toast(
          (t) => (
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">
                  {(message.data as { title?: string })?.title || 'New notification'}
                </div>
                <div className="text-sm text-gray-500">
                  {(message.data as { message?: string })?.message?.substring(0, 50)}...
                </div>
              </div>
            </div>
          ),
          { duration: 5000 }
        );
      }
    },
  });

  // Fetch unread count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await notificationsApi.getUnreadCount();
        if (response.success) {
          setUnreadCount(response.data.count);
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();
  }, []);

  // Navigation items based on role
  const getNavItems = () => {
    const baseItems = [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Exams', href: '/exams', icon: BookOpen },
      { name: 'Schedules', href: '/schedules', icon: Calendar },
      { name: 'Announcements', href: '/announcements', icon: Bell },
    ];

    if (user?.role === 'STUDENT') {
      return [
        ...baseItems,
        { name: 'My Results', href: '/results', icon: FileText },
      ];
    }

    if (user?.role === 'FACULTY') {
      return [
        ...baseItems,
        { name: 'Results', href: '/results', icon: FileText },
        { name: 'Students', href: '/students', icon: Users },
      ];
    }

    // Admin
    return [
      ...baseItems,
      { name: 'Results', href: '/results', icon: FileText },
      { name: 'Students', href: '/students', icon: Users },
      { name: 'Settings', href: '/settings', icon: Settings },
    ];
  };

  const navItems = getNavItems();

  const handleLogout = async () => {
    try {
      await authApi.logout(refreshToken || undefined);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
      navigate('/login');
      toast.success('Logged out successfully');
    }
  };

  const getRoleBadgeColor = () => {
    switch (user?.role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-700';
      case 'FACULTY': return 'bg-blue-100 text-blue-700';
      case 'STUDENT': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-700 rounded-xl flex items-center justify-center">
              <span className="text-xl">🎓</span>
            </div>
            <span className="font-display font-bold text-gray-900">ExamFlow</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
                {item.name === 'Announcements' && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Connection status */}
        <div className="absolute bottom-20 left-4 right-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-xs">
            {wsStatus === 'connected' ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-green-700">Real-time connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">
                  {wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* User section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 lg:flex-none" />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-3 hover:bg-gray-100 rounded-lg p-2 transition-colors"
            >
              <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-primary-700" />
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className={clsx('text-xs px-1.5 py-0.5 rounded inline-block', getRoleBadgeColor())}>
                  {user?.role}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-500 hidden sm:block" />
            </button>

            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-900">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-xs text-gray-500">{user?.email}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
