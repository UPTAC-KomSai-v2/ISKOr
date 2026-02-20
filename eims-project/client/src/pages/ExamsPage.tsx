import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { examsApi, coursesApi } from '@/services/api';
import api from '@/services/api';
import { Exam, ExamStatus, ExamType, Course, Role } from '@/types';
import Modal from '@/components/Modal';
import ExamScheduler, { ExamScheduleSettings } from '@/components/ExamScheduler';
import { Plus, Search, FileText, Calendar, Edit, Trash2, Clock, MapPin, Eye, Play, Pause, Users, Loader2, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ExamsPage = () => {
  const { user } = useAuthStore();
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const navigate = useNavigate();

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
  
  // Schedule settings state
  const [scheduleSettings, setScheduleSettings] = useState<ExamScheduleSettings>({
    startDate: null,
    endDate: null,
    timeLimitMinutes: null,
    autoSubmitOnTimeExpire: true,
    showTimerWarning: true,
    warningThresholdMinutes: 5,
    lateSubmissionAllowed: false,
    lateSubmissionPenalty: 0,
    maxAttempts: 1,
  });

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    setScheduleSettings({
      startDate: null,
      endDate: null,
      timeLimitMinutes: null,
      autoSubmitOnTimeExpire: true,
      showTimerWarning: true,
      warningThresholdMinutes: 5,
      lateSubmissionAllowed: false,
      lateSubmissionPenalty: 0,
      maxAttempts: 1,
    });
    setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      // Combine form data with schedule settings
      const examData = {
        ...formData,
        startDate: scheduleSettings.startDate ? new Date(scheduleSettings.startDate).toISOString() : undefined,
        endDate: scheduleSettings.endDate ? new Date(scheduleSettings.endDate).toISOString() : undefined,
        settings: {
          timeLimitMinutes: scheduleSettings.timeLimitMinutes,
          autoSubmitOnTimeExpire: scheduleSettings.autoSubmitOnTimeExpire,
          showTimerWarning: scheduleSettings.showTimerWarning,
          warningThresholdMinutes: scheduleSettings.warningThresholdMinutes,
          lateSubmissionAllowed: scheduleSettings.lateSubmissionAllowed,
          lateSubmissionPenalty: scheduleSettings.lateSubmissionPenalty,
          maxAttempts: scheduleSettings.maxAttempts,
          passingPercentage: formData.passingScore,
        },
      };

      await examsApi.create(examData);
      setShowCreateModal(false);
      resetForm();
      fetchExams();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || error.response?.data?.error || 'Failed to create exam');
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
      // Combine form data with schedule settings
      const examData = {
        ...formData,
        startDate: scheduleSettings.startDate ? new Date(scheduleSettings.startDate).toISOString() : undefined,
        endDate: scheduleSettings.endDate ? new Date(scheduleSettings.endDate).toISOString() : undefined,
        settings: {
          timeLimitMinutes: scheduleSettings.timeLimitMinutes,
          autoSubmitOnTimeExpire: scheduleSettings.autoSubmitOnTimeExpire,
          showTimerWarning: scheduleSettings.showTimerWarning,
          warningThresholdMinutes: scheduleSettings.warningThresholdMinutes,
          lateSubmissionAllowed: scheduleSettings.lateSubmissionAllowed,
          lateSubmissionPenalty: scheduleSettings.lateSubmissionPenalty,
          maxAttempts: scheduleSettings.maxAttempts,
          passingPercentage: formData.passingScore,
        },
      };

      await examsApi.update(selectedExam._id, examData);
      setShowEditModal(false);
      resetForm();
      fetchExams();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || error.response?.data?.error || 'Failed to update exam');
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
      setFormError(error.response?.data?.error?.message || error.response?.data?.error || 'Failed to delete exam');
    } finally {
      setFormLoading(false);
    }
  };

  const handlePublish = async (examId: string) => {
    setActionLoading(examId);
    try {
      await api.post(`/exams/${examId}/publish`);
      fetchExams();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to publish exam');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (examId: string) => {
    setActionLoading(examId);
    try {
      await api.post(`/exams/${examId}/activate`);
      fetchExams();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to activate exam');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async (examId: string) => {
    setActionLoading(examId);
    try {
      await api.post(`/exams/${examId}/close`);
      fetchExams();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to close exam');
    } finally {
      setActionLoading(null);
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
      passingScore: exam.settings?.passingPercentage || 60,
      guidelines: '',
    });
    // Set schedule settings from exam
    setScheduleSettings({
      startDate: exam.startDate ? formatDateTimeLocal(exam.startDate) : null,
      endDate: exam.endDate ? formatDateTimeLocal(exam.endDate) : null,
      timeLimitMinutes: exam.settings?.timeLimitMinutes || null,
      autoSubmitOnTimeExpire: exam.settings?.autoSubmitOnTimeExpire ?? true,
      showTimerWarning: exam.settings?.showTimerWarning ?? true,
      warningThresholdMinutes: exam.settings?.warningThresholdMinutes || 5,
      lateSubmissionAllowed: exam.settings?.lateSubmissionAllowed ?? false,
      lateSubmissionPenalty: exam.settings?.lateSubmissionPenalty || 0,
      maxAttempts: exam.settings?.maxAttempts || 1,
    });
    setShowEditModal(true);
  };

  // Helper to format date for datetime-local input
  function formatDateTimeLocal(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - offset * 60 * 1000);
    return localDate.toISOString().slice(0, 16);
  }

  const openDeleteModal = (exam: Exam) => {
    setSelectedExam(exam);
    setShowDeleteModal(true);
  };

  const openViewModal = (exam: Exam) => {
    setSelectedExam(exam);
    setShowViewModal(true);
  };

  const getStatusBadge = (status: ExamStatus | string) => {
    const styles: Record<string, string> = {
      DRAFT: 'badge-gray',
      PUBLISHED: 'badge-primary',
      ACTIVE: 'badge-success',
      CLOSED: 'badge-warning',
      GRADING: 'badge-info',
      COMPLETED: 'badge-success',
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

  const canManage = user?.role === Role.ADMIN || user?.role === Role.FACULTY;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exams</h1>
          <p className="text-gray-600">Manage examinations and assessments</p>
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
        {['', 'DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'COMPLETED'].map((status) => (
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
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
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
                      {exam.courseId?.code} • {exam.type} • {exam.totalPoints} pts
                    </p>
                    {exam.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{exam.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                      {exam.questionCount !== undefined && (
                        <span>{exam.questionCount} question{exam.questionCount !== 1 ? 's' : ''}</span>
                      )}
                      {exam.settings?.timeLimitMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {exam.settings.timeLimitMinutes} min
                        </span>
                      )}
                      {exam.settings?.maxAttempts && exam.settings.maxAttempts > 1 && (
                        <span>{exam.settings.maxAttempts} attempts</span>
                      )}
                      {exam.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(exam.startDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-2 ml-4 flex-wrap">
                    {/* View Button */}
                    <button
                      onClick={() => openViewModal(exam)}
                      className="btn btn-secondary text-sm py-1.5"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Build/Edit Questions Button */}
                    <button
                      onClick={() => navigate(`/exams/${exam._id}/builder`)}
                      className="btn btn-secondary text-sm py-1.5"
                      title="Build Questions"
                    >
                      Build
                    </button>

                    {/* Status Actions */}
                    {exam.status === 'DRAFT' && (
                      <button
                        onClick={() => handlePublish(exam._id)}
                        disabled={actionLoading === exam._id}
                        className="btn btn-primary text-sm py-1.5 flex items-center gap-1"
                        title="Publish Exam"
                      >
                        {actionLoading === exam._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                        Publish
                      </button>
                    )}

                    {exam.status === 'PUBLISHED' && (
                      <button
                        onClick={() => handleActivate(exam._id)}
                        disabled={actionLoading === exam._id}
                        className="btn btn-success text-sm py-1.5 flex items-center gap-1"
                        title="Activate Exam"
                      >
                        {actionLoading === exam._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Activate
                      </button>
                    )}

                    {exam.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleClose(exam._id)}
                        disabled={actionLoading === exam._id}
                        className="btn btn-warning text-sm py-1.5 flex items-center gap-1"
                        title="Close Exam"
                      >
                        {actionLoading === exam._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Pause className="w-4 h-4" />
                        )}
                        Close
                      </button>
                    )}

                    {/* View Submissions - for published, active, or closed exams */}
                    {['PUBLISHED', 'ACTIVE', 'CLOSED', 'GRADING', 'COMPLETED'].includes(exam.status) && (
                      <button
                        onClick={() => navigate(`/exams/${exam._id}/submissions`)}
                        className="btn btn-secondary text-sm py-1.5 flex items-center gap-1"
                        title="View Submissions"
                      >
                        <Users className="w-4 h-4" />
                        Submissions
                      </button>
                    )}

                    {/* View Insights - for exams with submissions */}
                    {['ACTIVE', 'CLOSED', 'GRADING', 'COMPLETED'].includes(exam.status) && (
                      <button
                        onClick={() => navigate(`/exams/${exam._id}/insights`)}
                        className="btn btn-secondary text-sm py-1.5 flex items-center gap-1"
                        title="View Insights"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Insights
                      </button>
                    )}

                    {/* Edit Button - only for drafts */}
                    {exam.status === 'DRAFT' && (
                      <button
                        onClick={() => openEditModal(exam)}
                        className="btn btn-secondary text-sm py-1.5"
                        title="Edit Exam"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}

                    {/* Delete Button - only for drafts */}
                    {exam.status === 'DRAFT' && (
                      <button
                        onClick={() => openDeleteModal(exam)}
                        className="btn btn-danger text-sm py-1.5"
                        title="Delete Exam"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Exam" size="lg">
        <form onSubmit={handleCreate} className="space-y-6">
          {formError && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{formError}</div>
          )}
          
          {/* Basic Info Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Basic Information</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input"
                placeholder="e.g., Midterm Exam - Chapter 1-5"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select
                  value={formData.courseId}
                  onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select a course</option>
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
                  <option value="ASSIGNMENT">Assignment</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows={2}
                placeholder="Brief description of the exam..."
              />
            </div>
          </div>

          {/* Schedule & Timer Section */}
          <ExamScheduler
            initialValues={scheduleSettings}
            onChange={setScheduleSettings}
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
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
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Exam" size="lg">
        <form onSubmit={handleEdit} className="space-y-6">
          {formError && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{formError}</div>
          )}
          
          {/* Basic Info Section */}  
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Basic Information</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select
                  value={formData.courseId}
                  onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select a course</option>
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
                  <option value="ASSIGNMENT">Assignment</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows={2}
              />
            </div>
          </div>

          {/* Schedule & Timer Section */}
          <ExamScheduler
            initialValues={scheduleSettings}
            onChange={setScheduleSettings}
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
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
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Exam">
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete "{selectedExam?.title}"? This action cannot be undone.
          </p>
          {formError && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{formError}</div>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={formLoading} className="btn btn-danger">
              {formLoading ? 'Deleting...' : 'Delete Exam'}
            </button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="Exam Details" size="lg">
        {selectedExam && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Title</p>
                <p className="font-medium">{selectedExam.title}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`badge ${getStatusBadge(selectedExam.status)}`}>{selectedExam.status}</span>
              </div>
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
                <p className="text-sm text-gray-500">Questions</p>
                <p className="font-medium">{selectedExam.questionCount || 0}</p>
              </div>
              {selectedExam.settings?.timeLimitMinutes && (
                <div>
                  <p className="text-sm text-gray-500">Time Limit</p>
                  <p className="font-medium">{selectedExam.settings.timeLimitMinutes} minutes</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Passing Score</p>
                <p className="font-medium">{selectedExam.settings?.passingPercentage || 60}%</p>
              </div>
              {selectedExam.settings?.maxAttempts && (
                <div>
                  <p className="text-sm text-gray-500">Max Attempts</p>
                  <p className="font-medium">{selectedExam.settings.maxAttempts}</p>
                </div>
              )}
              {selectedExam.startDate && (
                <div>
                  <p className="text-sm text-gray-500">Start Date</p>
                  <p className="font-medium">{formatDate(selectedExam.startDate)}</p>
                </div>
              )}
              {selectedExam.endDate && (
                <div>
                  <p className="text-sm text-gray-500">End Date</p>
                  <p className="font-medium">{formatDate(selectedExam.endDate)}</p>
                </div>
              )}
            </div>
            {selectedExam.description && (
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="text-gray-700">{selectedExam.description}</p>
              </div>
            )}
            {selectedExam.instructions && (
              <div>
                <p className="text-sm text-gray-500">Instructions</p>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedExam.instructions}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExamsPage;