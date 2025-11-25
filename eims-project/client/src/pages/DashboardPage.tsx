import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, Calendar, Bell, FileText, Users, Clock, 
  TrendingUp, AlertCircle, CheckCircle, ChevronRight 
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { examsApi, announcementsApi, schedulesApi } from '@/services/api';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import type { Exam, Announcement, ExamSchedule } from '@/types';

const DashboardPage = () => {
  const { user } = useAuthStore();
  const [exams, setExams] = useState<Exam[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<ExamSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examsRes, announcementsRes, schedulesRes] = await Promise.all([
          examsApi.list({ limit: 5 }),
          announcementsApi.list({ limit: 5 }),
          schedulesApi.list({ upcoming: true }),
        ]);

        if (examsRes.success) setExams(examsRes.data);
        if (announcementsRes.success) setAnnouncements(announcementsRes.data);
        if (schedulesRes.success) setUpcomingSchedules(schedulesRes.data.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'badge-info';
      case 'SCHEDULED': return 'badge-warning';
      case 'ONGOING': return 'badge-success';
      case 'COMPLETED': return 'badge-primary';
      case 'CANCELLED': return 'badge-danger';
      default: return 'badge-info';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'NORMAL': return 'text-blue-600 bg-blue-50';
      case 'LOW': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Stats based on role
  const stats = [
    {
      label: user?.role === 'STUDENT' ? 'Enrolled Exams' : 'Total Exams',
      value: exams.length,
      icon: BookOpen,
      color: 'bg-blue-500',
    },
    {
      label: 'Upcoming',
      value: upcomingSchedules.length,
      icon: Calendar,
      color: 'bg-amber-500',
    },
    {
      label: 'Announcements',
      value: announcements.length,
      icon: Bell,
      color: 'bg-purple-500',
    },
    {
      label: user?.role === 'STUDENT' ? 'Results' : 'Students',
      value: user?.role === 'STUDENT' ? 0 : 15,
      icon: user?.role === 'STUDENT' ? FileText : Users,
      color: 'bg-green-500',
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="skeleton h-24 w-full max-w-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="skeleton h-80" />
          <div className="skeleton h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-700 to-primary-800 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-display font-bold mb-1">
          {getGreeting()}, {user?.firstName}! 👋
        </h1>
        <p className="text-primary-100">
          {user?.role === 'STUDENT' 
            ? "Here's an overview of your exams and announcements"
            : "Manage your exams and keep students informed"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="card p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Exams */}
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary-600" />
              Recent Exams
            </h2>
            <Link to="/exams" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {exams.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p>No exams found</p>
              </div>
            ) : (
              exams.map((exam) => (
                <Link
                  key={exam.id}
                  to={`/exams/${exam.id}`}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 truncate">
                        {exam.title}
                      </span>
                      <span className={getStatusColor(exam.status)}>
                        {exam.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {exam.course?.code} • {exam.type}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Announcements */}
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary-600" />
              Recent Announcements
            </h2>
            <Link to="/announcements" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {announcements.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p>No announcements</p>
              </div>
            ) : (
              announcements.map((announcement) => (
                <Link
                  key={announcement.id}
                  to={`/announcements/${announcement.id}`}
                  className="p-4 block hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getPriorityColor(announcement.priority)}`}>
                      {announcement.priority === 'URGENT' ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : (
                        <Bell className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate mb-1">
                        {announcement.title}
                      </div>
                      <div className="text-sm text-gray-500 line-clamp-2">
                        {announcement.content}
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        {format(new Date(announcement.publishedAt), 'MMM d, yyyy h:mm a')}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Schedules */}
      {upcomingSchedules.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Upcoming Exam Schedules
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Exam
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Section
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {upcomingSchedules.map((schedule) => {
                  const startDate = new Date(schedule.startTime);
                  const isToday = isBefore(startDate, addDays(new Date(), 1)) && isAfter(startDate, new Date());
                  
                  return (
                    <tr key={schedule.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">
                          {(schedule as { exam?: { title: string } }).exam?.title || 'Unknown Exam'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {(schedule as { exam?: { course?: { code: string } } }).exam?.course?.code}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {schedule.section || 'All sections'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {isToday && (
                            <span className="badge-warning">Today</span>
                          )}
                          <div>
                            <div className="text-gray-900">
                              {format(startDate, 'MMM d, yyyy')}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(startDate, 'h:mm a')} - {format(new Date(schedule.endTime), 'h:mm a')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {schedule.room || (schedule.meetLink ? 'Online' : 'TBA')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
