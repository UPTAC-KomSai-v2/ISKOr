import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { announcementsApi } from '@/services/api';
import { Announcement, Role } from '@/types';
import { Plus, Megaphone, AlertCircle } from 'lucide-react';

const AnnouncementsPage = () => {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await announcementsApi.list();
        setAnnouncements(res.data.data.announcements);
      } catch (error) {
        console.error('Failed to fetch announcements:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'URGENT': return { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' };
      case 'HIGH': return { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' };
      case 'NORMAL': return { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-600">Stay updated with the latest news</p>
        </div>
        {(user?.role === Role.ADMIN || user?.role === Role.FACULTY) && (
          <button className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Announcement
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="card p-12 text-center">
          <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No announcements</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => {
            const style = getPriorityStyle(announcement.priority);
            return (
              <div
                key={announcement._id}
                className={`card p-5 border-l-4 ${style.border}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 ${style.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    {announcement.priority === 'URGENT' ? (
                      <AlertCircle className={`w-5 h-5 ${style.text}`} />
                    ) : (
                      <Megaphone className={`w-5 h-5 ${style.text}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
                        <p className="text-sm text-gray-500">
                          {announcement.courseId?.code && `${announcement.courseId.code} • `}
                          {announcement.type}
                        </p>
                      </div>
                      <span className={`badge ${style.bg} ${style.text}`}>
                        {announcement.priority}
                      </span>
                    </div>
                    <p className="mt-3 text-gray-600 whitespace-pre-wrap">{announcement.content}</p>
                    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                      <span>
                        Posted by {announcement.createdById?.firstName} {announcement.createdById?.lastName}
                      </span>
                      <span>{formatDate(announcement.publishedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPage;
