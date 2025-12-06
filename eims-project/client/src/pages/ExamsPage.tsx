import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { examsApi, coursesApi } from '@/services/api';
import { Exam, ExamStatus, ExamType, Course, Role } from '@/types';
import Modal from '@/components/Modal';
import { Plus, Search, FileText, Calendar, Edit, Trash2, Clock, MapPin } from 'lucide-react';

const ExamsPage = () => {
  const { user } = useAuthStore();
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    courseId: '',
    type: 'QUIZ' as ExamType,
    totalPoints: 100,
    passingScore: 60,
    guidelines: '',
  });
  const [scheduleData, setScheduleData] = useState({
    section: '',
    room: '',
    meetingLink: '',
    startTime: '',
    endTime: '',
    instructions: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await examsApi.list({ status: statusFilter || undefined });
      setExams(res.data);
    } catch (error) {
      console.error('Failed to fetch exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await coursesApi.list();
      setCourses(res.data.data?.courses || res.data);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    }
  };

  useEffect(() => {
    fetchExams();
    fetchCourses();
  }, [statusFilter]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      courseId: '',
      type: 'QUIZ' as ExamType,
      totalPoints: 100,
      passingScore: 60,
      guidelines: '',
    });
    setFormError('');
  };

  const resetScheduleForm = () => {
    setScheduleData({
      section: '',
      room: '',
      meetingLink: '',
      startTime: '',
      endTime: '',
      instructions: '',
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      await examsApi.create(formData);
      setShowCreateModal(false);
      resetForm();
      fetchExams();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to create exam');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;
    setFormLoading(true);
    setFormError('');

    try {
      await examsApi.update(selectedExam._id, formData);
      setShowEditModal(false);
      resetForm();
      fetchExams();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to update exam');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedExam) return;
    setFormLoading(true);

    try {
      await examsApi.delete(selectedExam._id);
      setShowDeleteModal(false);
      setSelectedExam(null);
      fetchExams();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to delete exam');
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;
    setFormLoading(true);
    setFormError('');

    try {
      await examsApi.addSchedule(selectedExam._id, scheduleData);
      setShowScheduleModal(false);
      resetScheduleForm();
      fetchExams();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to add schedule');
    } finally {
      setFormLoading(false);
    }
  };

  const handleStatusChange = async (exam: Exam, newStatus: ExamStatus) => {
    try {
      await examsApi.update(exam._id, { status: newStatus });
      fetchExams();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const openEditModal = (exam: Exam) => {
    setSelectedExam(exam);
    setFormData({
      title: exam.title,
      description: exam.description || '',
      courseId: typeof exam.courseId === 'string' ? exam.courseId : exam.courseId._id,
      type: exam.type,
      totalPoints: exam.totalPoints,
      passingScore: exam.passingScore || 60,
      guidelines: exam.guidelines || '',
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (exam: Exam) => {
    setSelectedExam(exam);
    setShowDeleteModal(true);
  };

  const openScheduleModal = (exam: Exam) => {
    setSelectedExam(exam);
    resetScheduleForm();
    setShowScheduleModal(true);
  };

  const openViewModal = (exam: Exam) => {
    setSelectedExam(exam);
    setShowViewModal(true);
  };

  const getStatusBadge = (status: ExamStatus) => {
    const styles: Record<string, string> = {
      DRAFT: 'badge-gray',
      SCHEDULED: 'badge-primary',
      ONGOING: 'badge-warning',
      COMPLETED: 'badge-success',
      CANCELLED: 'badge-danger',
    };
    return styles[status] || 'badge-gray';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTimeLocal = (date: string) => {
    const d = new Date(date);
    return d.toISOString().slice(0, 16);
  };

  const canManage = user?.role === Role.ADMIN || user?.role === Role.FACULTY;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exams</h1>
          <p className="text-gray-600">View and manage examinations</p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Exam
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'DRAFT', 'SCHEDULED', 'ONGOING', 'COMPLETED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              statusFilter === status
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      {/* Exams list */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : exams.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No exams found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => (
            <div key={exam._id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{exam.title}</h3>
                      <span className={`badge ${getStatusBadge(exam.status)}`}>
                        {exam.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {exam.courseId?.code} • {exam.type}
                    </p>
                    {exam.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{exam.description}</p>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => openViewModal(exam)}
                      className="btn btn-secondary text-sm py-1.5"
                    >
                      View
                    </button>
                    <button
                      onClick={() => openScheduleModal(exam)}
                      className="btn btn-secondary text-sm py-1.5"
                    >
                      + Schedule
                    </button>
                    <button
                      onClick={() => openEditModal(exam)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(exam)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {exam.schedules?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-2">Schedules</p>
                  <div className="space-y-2">
                    {exam.schedules.slice(0, 3).map((schedule) => (
                      <div key={schedule._id} className="flex items-center gap-4 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <span className="font-medium min-w-[80px]">{schedule.section}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(schedule.startTime)}
                        </span>
                        {schedule.room && (
                          <span className="flex items-center gap-1 text-gray-400">
                            <MapPin className="w-4 h-4" />
                            {schedule.room}
                          </span>
                        )}
                      </div>
                    ))}
                    {exam.schedules.length > 3 && (
                      <p className="text-sm text-gray-400">+{exam.schedules.length - 3} more</p>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  Total: <strong>{exam.totalPoints} pts</strong>
                  {exam.passingScore && <> • Passing: <strong>{exam.passingScore} pts</strong></>}
                </span>
                {canManage && exam.status === 'DRAFT' && (
                  <button
                    onClick={() => handleStatusChange(exam, ExamStatus.SCHEDULED)}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Publish Exam →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Exam"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input"
                placeholder="Midterm Examination"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select
                value={formData.courseId}
                onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                className="input"
                required
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>
                    {course.code} - {course.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ExamType })}
                className="input"
              >
                <option value="QUIZ">Quiz</option>
                <option value="MIDTERM">Midterm</option>
                <option value="FINAL">Final</option>
                <option value="PRACTICAL">Practical</option>
                <option value="ORAL">Oral</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Points</label>
              <input
                type="number"
                value={formData.totalPoints}
                onChange={(e) => setFormData({ ...formData, totalPoints: parseInt(e.target.value) })}
                className="input"
                min={1}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score</label>
              <input
                type="number"
                value={formData.passingScore}
                onChange={(e) => setFormData({ ...formData, passingScore: parseInt(e.target.value) })}
                className="input"
                min={0}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows={2}
                placeholder="Exam description..."
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Guidelines</label>
              <textarea
                value={formData.guidelines}
                onChange={(e) => setFormData({ ...formData, guidelines: e.target.value })}
                className="input"
                rows={3}
                placeholder="1. Closed book exam&#10;2. No electronic devices&#10;3. Show all work"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={formLoading} className="btn btn-primary">
              {formLoading ? 'Creating...' : 'Create Exam'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Exam"
        size="lg"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ExamType })}
                className="input"
              >
                <option value="QUIZ">Quiz</option>
                <option value="MIDTERM">Midterm</option>
                <option value="FINAL">Final</option>
                <option value="PRACTICAL">Practical</option>
                <option value="ORAL">Oral</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={selectedExam?.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value } as any)}
                className="input"
              >
                <option value="DRAFT">Draft</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="ONGOING">Ongoing</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Points</label>
              <input
                type="number"
                value={formData.totalPoints}
                onChange={(e) => setFormData({ ...formData, totalPoints: parseInt(e.target.value) })}
                className="input"
                min={1}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score</label>
              <input
                type="number"
                value={formData.passingScore}
                onChange={(e) => setFormData({ ...formData, passingScore: parseInt(e.target.value) })}
                className="input"
                min={0}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Guidelines</label>
              <textarea
                value={formData.guidelines}
                onChange={(e) => setFormData({ ...formData, guidelines: e.target.value })}
                className="input"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={formLoading} className="btn btn-primary">
              {formLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Exam"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedExam?.title}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={formLoading} className="btn btn-danger">
              {formLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Schedule Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title={`Add Schedule to ${selectedExam?.title}`}
        size="lg"
      >
        <form onSubmit={handleAddSchedule} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <input
                type="text"
                value={scheduleData.section}
                onChange={(e) => setScheduleData({ ...scheduleData, section: e.target.value })}
                className="input"
                placeholder="Section A"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
              <input
                type="text"
                value={scheduleData.room}
                onChange={(e) => setScheduleData({ ...scheduleData, room: e.target.value })}
                className="input"
                placeholder="Room 301"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={scheduleData.startTime}
                onChange={(e) => setScheduleData({ ...scheduleData, startTime: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="datetime-local"
                value={scheduleData.endTime}
                onChange={(e) => setScheduleData({ ...scheduleData, endTime: e.target.value })}
                className="input"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link (optional)</label>
              <input
                type="url"
                value={scheduleData.meetingLink}
                onChange={(e) => setScheduleData({ ...scheduleData, meetingLink: e.target.value })}
                className="input"
                placeholder="https://zoom.us/j/..."
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
              <textarea
                value={scheduleData.instructions}
                onChange={(e) => setScheduleData({ ...scheduleData, instructions: e.target.value })}
                className="input"
                rows={2}
                placeholder="Please arrive 15 minutes early..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowScheduleModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={formLoading} className="btn btn-primary">
              {formLoading ? 'Adding...' : 'Add Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Exam Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={selectedExam?.title || 'Exam Details'}
        size="lg"
      >
        {selectedExam && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Course</p>
                <p className="font-medium">{selectedExam.courseId?.code} - {selectedExam.courseId?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-medium">{selectedExam.type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Points</p>
                <p className="font-medium">{selectedExam.totalPoints}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Passing Score</p>
                <p className="font-medium">{selectedExam.passingScore || 'N/A'}</p>
              </div>
            </div>
            {selectedExam.description && (
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="text-gray-700">{selectedExam.description}</p>
              </div>
            )}
            {selectedExam.guidelines && (
              <div>
                <p className="text-sm text-gray-500">Guidelines</p>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedExam.guidelines}</p>
              </div>
            )}
            {selectedExam.schedules?.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Schedules</p>
                <div className="space-y-2">
                  {selectedExam.schedules.map((schedule) => (
                    <div key={schedule._id} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{schedule.section}</span>
                        {schedule.room && <span className="text-gray-500">{schedule.room}</span>}
                      </div>
                      <p className="text-sm text-gray-600">
                        {formatDate(schedule.startTime)} - {formatDate(schedule.endTime)}
                      </p>
                      {schedule.instructions && (
                        <p className="text-sm text-gray-500 mt-1">{schedule.instructions}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-4">
              <button onClick={() => setShowViewModal(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExamsPage;