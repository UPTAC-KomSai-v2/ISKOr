import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { examsApi } from '@/services/api';
import { Exam, ExamStatus, Role } from '@/types';
import { Plus, Search, FileText, Calendar, Clock } from 'lucide-react';

const ExamsPage = () => {
  const { user } = useAuthStore();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await examsApi.list({ status: statusFilter || undefined });
        setExams(res.data.data.exams);
      } catch (error) {
        console.error('Failed to fetch exams:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, [statusFilter]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exams</h1>
          <p className="text-gray-600">View and manage examinations</p>
        </div>
        {(user?.role === Role.ADMIN || user?.role === Role.FACULTY) && (
          <button className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Exam
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
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
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{exam.title}</h3>
                    <p className="text-sm text-gray-500">
                      {exam.courseId?.code} • {exam.type}
                    </p>
                    {exam.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{exam.description}</p>
                    )}
                  </div>
                </div>
                <span className={`badge ${getStatusBadge(exam.status)}`}>
                  {exam.status}
                </span>
              </div>

              {exam.schedules?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-2">Schedules</p>
                  <div className="space-y-2">
                    {exam.schedules.map((schedule) => (
                      <div key={schedule._id} className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="font-medium">{schedule.section}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(schedule.startTime)}
                        </span>
                        {schedule.room && (
                          <span className="text-gray-400">Room: {schedule.room}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  Total Points: <strong>{exam.totalPoints}</strong>
                  {exam.passingScore && <> • Passing: <strong>{exam.passingScore}</strong></>}
                </span>
                <span className="text-gray-400">
                  Created by {exam.createdById?.firstName} {exam.createdById?.lastName}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExamsPage;
