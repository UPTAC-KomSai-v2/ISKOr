import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { dashboardApi, examsApi, announcementsApi } from '@/services/api';
import { Role, Exam, Announcement } from '@/types';
import {
  BookOpen, FileText, Users, ClipboardList, Calendar,
  TrendingUp, Megaphone, ArrowRight,
} from 'lucide-react';

const DashboardPage = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>({});
  const [upcomingExams, setUpcomingExams] = useState<Exam[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, examsRes, announcementsRes] = await Promise.all([
          dashboardApi.getStats(),
          examsApi.getUpcoming(5),
          announcementsApi.getRecent(5),
        ]);
        setStats(statsRes.data.data.stats);
        setUpcomingExams(examsRes.data.data.exams);
        setAnnouncements(announcementsRes.data.data.announcements);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getStatCards = () => {
    if (user?.role === Role.ADMIN) {
      return [
        { label: 'Total Users', value: stats.totalUsers || 0, icon: Users, color: 'bg-blue-500' },
        { label: 'Total Courses', value: stats.totalCourses || 0, icon: BookOpen, color: 'bg-green-500' },
        { label: 'Total Exams', value: stats.totalExams || 0, icon: FileText, color: 'bg-purple-500' },
        { label: 'Active Exams', value: stats.activeExams || 0, icon: Calendar, color: 'bg-orange-500' },
      ];
    }
    if (user?.role === Role.FACULTY) {
      return [
        { label: 'My Courses', value: stats.myCourses || 0, icon: BookOpen, color: 'bg-blue-500' },
        { label: 'My Exams', value: stats.myExams || 0, icon: FileText, color: 'bg-purple-500' },
        { label: 'Pending Results', value: stats.pendingResults || 0, icon: ClipboardList, color: 'bg-orange-500' },
        { label: 'Total Students', value: stats.totalStudents || 0, icon: Users, color: 'bg-green-500' },
      ];
    }
    return [
      { label: 'Enrolled Courses', value: stats.enrolledCourses || 0, icon: BookOpen, color: 'bg-blue-500' },
      { label: 'Upcoming Exams', value: stats.upcomingExams || 0, icon: Calendar, color: 'bg-purple-500' },
      { label: 'My Results', value: stats.myResults || 0, icon: ClipboardList, color: 'bg-green-500' },
      { label: 'Average Score', value: stats.averageScore || 0, icon: TrendingUp, color: 'bg-orange-500' },
    ];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-gray-600">Here's what's happening today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {getStatCards().map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Exams */}
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Upcoming Exams</h2>
            <Link to="/exams" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {upcomingExams.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No upcoming exams
              </div>
            ) : (
              upcomingExams.map((exam) => (
                <div key={exam._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{exam.title}</p>
                      <p className="text-sm text-gray-500">{exam.courseId?.code}</p>
                    </div>
                    <span className={`badge ${exam.status === 'SCHEDULED' ? 'badge-primary' : 'badge-warning'}`}>
                      {exam.status}
                    </span>
                  </div>
                  {exam.schedules?.[0] && (
                    <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(exam.schedules[0].startTime)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Announcements */}
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Announcements</h2>
            <Link to="/announcements" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {announcements.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No announcements
              </div>
            ) : (
              announcements.map((announcement) => (
                <div key={announcement._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      announcement.priority === 'URGENT' ? 'bg-red-100' :
                      announcement.priority === 'HIGH' ? 'bg-orange-100' : 'bg-blue-100'
                    }`}>
                      <Megaphone className={`w-4 h-4 ${
                        announcement.priority === 'URGENT' ? 'text-red-600' :
                        announcement.priority === 'HIGH' ? 'text-orange-600' : 'text-blue-600'
                      }`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{announcement.title}</p>
                      <p className="text-sm text-gray-500 line-clamp-2">{announcement.content}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(announcement.publishedAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
