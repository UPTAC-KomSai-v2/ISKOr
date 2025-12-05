import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { announcementsApi, coursesApi } from '@/services/api';
import { Announcement, Course, Role } from '@/types';
import Modal from '@/components/Modal';
import { Plus, Megaphone, AlertCircle, Edit, Trash2 } from 'lucide-react';

const AnnouncementsPage = () => {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'GENERAL',
    priority: 'NORMAL',
    courseId: '',
    targetRoles: [] as string[],
    expiresAt: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await announcementsApi.list();
      setAnnouncements(res.data.data.announcements);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await coursesApi.list();
      setCourses(res.data.data.courses);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchCourses();
  }, []);

  const resetForm = () => {
    setFormData({ title: '', content: '', type: 'GENERAL', priority: 'NORMAL', courseId: '', targetRoles: [], expiresAt: '' });
    setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await announcementsApi.create({
        ...formData,
        courseId: formData.courseId || undefined,
        expiresAt: formData.expiresAt || undefined,
      });
      setShowCreateModal(false);
      resetForm();
      fetchAnnouncements();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to create announcement');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnnouncement) return;
    setFormLoading(true);
    setFormError('');
    try {
      await announcementsApi.update(selectedAnnouncement._id, formData);
      setShowEditModal(false);
      resetForm();
      fetchAnnouncements();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to update announcement');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAnnouncement) return;
    setFormLoading(true);
    try {
      await announcementsApi.delete(selectedAnnouncement._id);
      setShowDeleteModal(false);
      setSelectedAnnouncement(null);
      fetchAnnouncements();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to delete');
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      priority: announcement.priority,
      courseId: announcement.courseId?._id || '',
      targetRoles: [],
      expiresAt: '',
    });
    setShowEditModal(true);
  };

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
      month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const canManage = user?.role === Role.ADMIN || user?.role === Role.FACULTY;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-600">Stay updated with the latest news</p>
        </div>
        {canManage && (
          <button onClick={() => { resetForm(); setShowCreateModal(true); }} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Announcement
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
              <div key={announcement._id} className={`card p-5 border-l-4 ${style.border}`}>
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
                      <div className="flex items-center gap-2">
                        <span className={`badge ${style.bg} ${style.text}`}>{announcement.priority}</span>
                        {canManage && (
                          <>
                            <button onClick={() => openEditModal(announcement)} className="p-1 text-gray-400 hover:text-blue-600">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setSelectedAnnouncement(announcement); setShowDeleteModal(true); }} className="p-1 text-gray-400 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-gray-600 whitespace-pre-wrap">{announcement.content}</p>
                    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                      <span>Posted by {announcement.createdById?.firstName} {announcement.createdById?.lastName}</span>
                      <span>{formatDate(announcement.publishedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Announcement" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{formError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input" required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="input">
                <option value="GENERAL">General</option>
                <option value="EXAM">Exam</option>
                <option value="SCHEDULE">Schedule</option>
                <option value="RESULT">Result</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="input">
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course (optional)</label>
              <select value={formData.courseId} onChange={(e) => setFormData({ ...formData, courseId: e.target.value })} className="input">
                <option value="">All courses</option>
                {courses.map((course) => <option key={course._id} value={course._id}>{course.code}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} className="input" rows={5} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expires At (optional)</label>
            <input type="datetime-local" value={formData.expiresAt} onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })} className="input" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={formLoading} className="btn btn-primary">{formLoading ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Announcement" size="lg">
        <form onSubmit={handleEdit} className="space-y-4">
          {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{formError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="input">
                <option value="GENERAL">General</option>
                <option value="EXAM">Exam</option>
                <option value="SCHEDULE">Schedule</option>
                <option value="RESULT">Result</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="input">
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} className="input" rows={5} required />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={formLoading} className="btn btn-primary">{formLoading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Announcement" size="sm">
        <div className="space-y-4">
          <p className="text-gray-600">Are you sure you want to delete this announcement?</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary">Cancel</button>
            <button onClick={handleDelete} disabled={formLoading} className="btn btn-danger">{formLoading ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AnnouncementsPage;
