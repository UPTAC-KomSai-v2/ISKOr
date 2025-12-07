import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
import { FileText, Clock, Calendar, Play, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Exam {
  _id: string;
  title: string;
  description?: string;
  instructions?: string;
  type: string;
  status: string;
  totalPoints: number;
  courseId: { _id: string; code: string; name: string };
  startDate?: string;
  endDate?: string;
  settings: {
    timeLimitMinutes?: number;
    maxAttempts: number;
  };
  attemptCount: number;
  canAttempt: boolean;
  hasInProgress: boolean;
  inProgressId?: string;
}

interface Submission {
  _id: string;
  examId: { _id: string; title: string; type: string; courseId: { code: string } };
  status: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  isPassing: boolean;
  submittedAt: string;
}

const StudentExamsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [examsRes, submissionsRes] = await Promise.all([
        api.get('/exams/available'),
        api.get('/submissions/student/my-submissions'),
      ]);
      setAvailableExams(examsRes.data);
      setSubmissions(submissionsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = (exam: Exam) => {
    if (exam.hasInProgress && exam.inProgressId) {
      navigate(`/exams/${exam._id}/take`);
    } else if (exam.canAttempt) {
      navigate(`/exams/${exam._id}/take`);
    }
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

  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate).getTime();
    const now = Date.now();
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} left`;
    }

    return `${hours}h ${minutes}m left`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Exams</h1>
        <p className="text-gray-600">View available exams and your exam history</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('available')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'available'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Available Exams ({availableExams.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          My Submissions ({submissions.length})
        </button>
      </div>

      {/* Available Exams Tab */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          {availableExams.length === 0 ? (
            <div className="card p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No exams available right now</p>
              <p className="text-sm text-gray-400 mt-1">Check back later for new exams</p>
            </div>
          ) : (
            availableExams.map((exam) => (
              <div key={exam._id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{exam.title}</h3>
                        <span className="badge badge-primary">{exam.type}</span>
                        {exam.hasInProgress && (
                          <span className="badge badge-warning">In Progress</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {exam.courseId.code} - {exam.courseId.name}
                      </p>
                      {exam.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{exam.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {exam.totalPoints} points
                        </span>
                        {exam.settings.timeLimitMinutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {exam.settings.timeLimitMinutes} minutes
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          Attempts: {exam.attemptCount}/{exam.settings.maxAttempts}
                        </span>
                        {exam.endDate && (
                          <span className="flex items-center gap-1 text-orange-600">
                            <Calendar className="w-4 h-4" />
                            {getTimeRemaining(exam.endDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ml-4">
                    {exam.canAttempt || exam.hasInProgress ? (
                      <button
                        onClick={() => handleStartExam(exam)}
                        className="btn btn-primary flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        {exam.hasInProgress ? 'Continue' : 'Start Exam'}
                      </button>
                    ) : (
                      <span className="text-sm text-gray-500">Max attempts reached</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Submissions History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {submissions.length === 0 ? (
            <div className="card p-12 text-center">
              <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No submissions yet</p>
              <p className="text-sm text-gray-400 mt-1">Complete an exam to see your results here</p>
            </div>
          ) : (
            submissions.map((submission) => (
              <div
                key={submission._id}
                className="card p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/submissions/${submission._id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      submission.status === 'RETURNED' || submission.status === 'GRADED'
                        ? submission.isPassing
                          ? 'bg-green-100'
                          : 'bg-red-100'
                        : 'bg-yellow-100'
                    }`}>
                      {submission.status === 'RETURNED' || submission.status === 'GRADED' ? (
                        submission.isPassing ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-red-600" />
                        )
                      ) : (
                        <Clock className="w-6 h-6 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{submission.examId.title}</h3>
                      <p className="text-sm text-gray-500">
                        {submission.examId.courseId?.code} • {submission.examId.type}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Submitted {formatDate(submission.submittedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {submission.status === 'RETURNED' || submission.status === 'GRADED' ? (
                      <>
                        <p className={`text-2xl font-bold ${
                          submission.isPassing ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {submission.percentage}%
                        </p>
                        <p className="text-sm text-gray-500">
                          {submission.totalScore}/{submission.maxScore} pts
                        </p>
                      </>
                    ) : (
                      <span className="badge badge-warning">{submission.status}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default StudentExamsPage;