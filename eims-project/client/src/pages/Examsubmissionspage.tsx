import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
import Modal from '@/components/Modal';
import {
  ArrowLeft,
  Loader2,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  Eye,
  BarChart3,
  Download,
} from 'lucide-react';

interface Student {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  studentNumber?: string;
  section?: string;
}

interface Submission {
  _id: string;
  studentId: Student;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'RETURNED';
  totalScore: number;
  maxScore: number;
  percentage: number;
  isPassing: boolean;
  startedAt: string;
  submittedAt?: string;
  answers: Answer[];
}

interface Answer {
  questionId: string;
  selectedChoiceId?: string;
  booleanAnswer?: boolean;
  textAnswer?: string;
  pointsEarned: number;
  isCorrect?: boolean;
  feedback?: string;
  gradedAt?: string;
}

interface Question {
  _id: string;
  type: string;
  questionText: string;
  points: number;
  choices?: { _id: string; text: string; isCorrect?: boolean }[];
  correctAnswer?: boolean;
  acceptedAnswers?: string[];
}

interface Exam {
  _id: string;
  title: string;
  type: string;
  totalPoints: number;
  courseId: { code: string; name: string };
  settings: {
    passingPercentage: number;
    showResults: boolean;
    showCorrectAnswers: boolean;
    showFeedback: boolean;
    allowReview: boolean;
  };
}

interface Statistics {
  totalSubmissions: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passingCount: number;
  passingRate: number;
}

const ExamSubmissionsPage = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [exam, setExam] = useState<Exam | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'graded'>('all');

  // Grading modal
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [gradingData, setGradingData] = useState<Record<string, { points: number; feedback: string }>>({});
  const [overallFeedback, setOverallFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  // Return modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnFeedback, setReturnFeedback] = useState('');
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    fetchData();
  }, [examId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [examRes, submissionsRes, statsRes] = await Promise.all([
        api.get(`/exams/${examId}`),
        api.get(`/submissions/exam/${examId}/all`),
        api.get(`/exams/${examId}/statistics`),
      ]);
      setExam(examRes.data);
      setSubmissions(submissionsRes.data);
      setStatistics(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openGradingModal = async (submission: Submission) => {
    try {
      const [submissionRes, questionsRes] = await Promise.all([
        api.get(`/submissions/${submission._id}`),
        api.get(`/questions/exam/${examId}`),
      ]);
      
      setSelectedSubmission(submissionRes.data.submission);
      setQuestions(questionsRes.data);
      
      // Initialize grading data with existing grades
      const existingGrades: Record<string, { points: number; feedback: string }> = {};
      submissionRes.data.submission.answers.forEach((answer: Answer) => {
        existingGrades[answer.questionId] = {
          points: answer.pointsEarned || 0,
          feedback: answer.feedback || '',
        };
      });
      setGradingData(existingGrades);
      setOverallFeedback(submissionRes.data.submission.overallFeedback || '');
      setShowGradingModal(true);
    } catch (error) {
      console.error('Failed to fetch submission details:', error);
    }
  };

  const handleGradeQuestion = async (questionId: string) => {
    if (!selectedSubmission) return;
    
    const gradeInfo = gradingData[questionId];
    if (!gradeInfo) return;

    try {
      setSaving(true);
      await api.put(`/submissions/${selectedSubmission._id}/grade/${questionId}`, {
        pointsEarned: gradeInfo.points,
        feedback: gradeInfo.feedback,
      });
      
      // Refresh submission data
      const res = await api.get(`/submissions/${selectedSubmission._id}`);
      setSelectedSubmission(res.data.submission);
    } catch (error) {
      console.error('Failed to grade question:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReturnSubmission = async () => {
    if (!selectedSubmission) return;
    
    try {
      setReturning(true);
      await api.post(`/submissions/${selectedSubmission._id}/return`, {
        overallFeedback: returnFeedback,
      });
      
      setShowReturnModal(false);
      setShowGradingModal(false);
      setReturnFeedback('');
      fetchData();
    } catch (error) {
      console.error('Failed to return submission:', error);
    } finally {
      setReturning(false);
    }
  };

  const handleReturnAll = async () => {
    if (!confirm('Return all graded submissions to students?')) return;
    
    try {
      await api.post(`/submissions/exam/${examId}/return-all`);
      fetchData();
    } catch (error) {
      console.error('Failed to return all:', error);
    }
  };

  const getAnswerForQuestion = (questionId: string) => {
    return selectedSubmission?.answers.find((a) => a.questionId === questionId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'badge-warning';
      case 'SUBMITTED':
        return 'badge-primary';
      case 'GRADED':
        return 'badge-info';
      case 'RETURNED':
        return 'badge-success';
      default:
        return 'badge-gray';
    }
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (activeTab === 'pending') return s.status === 'SUBMITTED';
    if (activeTab === 'graded') return s.status === 'GRADED' || s.status === 'RETURNED';
    return true;
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/exams')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{exam?.title} - Submissions</h1>
          <p className="text-gray-600">{exam?.courseId.code} • {exam?.type}</p>
        </div>
        {submissions.some((s) => s.status === 'GRADED') && (
          <button onClick={handleReturnAll} className="btn btn-primary flex items-center gap-2">
            <Send className="w-4 h-4" />
            Return All Graded
          </button>
        )}
      </div>

      {/* Statistics */}
      {statistics && statistics.totalSubmissions > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{statistics.totalSubmissions}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-primary-600">{statistics.averageScore}%</p>
            <p className="text-sm text-gray-500">Average</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{statistics.highestScore}%</p>
            <p className="text-sm text-gray-500">Highest</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{statistics.lowestScore}%</p>
            <p className="text-sm text-gray-500">Lowest</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{statistics.passingCount}</p>
            <p className="text-sm text-gray-500">Passed</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-primary-600">{statistics.passingRate}%</p>
            <p className="text-sm text-gray-500">Pass Rate</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['all', 'pending', 'graded'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab} ({submissions.filter((s) => {
              if (tab === 'pending') return s.status === 'SUBMITTED';
              if (tab === 'graded') return s.status === 'GRADED' || s.status === 'RETURNED';
              return true;
            }).length})
          </button>
        ))}
      </div>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No submissions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map((submission) => (
            <div key={submission._id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    submission.status === 'RETURNED'
                      ? submission.isPassing ? 'bg-green-100' : 'bg-red-100'
                      : submission.status === 'GRADED'
                      ? 'bg-blue-100'
                      : 'bg-yellow-100'
                  }`}>
                    {submission.status === 'RETURNED' ? (
                      <CheckCircle className={`w-5 h-5 ${submission.isPassing ? 'text-green-600' : 'text-red-600'}`} />
                    ) : submission.status === 'GRADED' ? (
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {submission.studentId.firstName} {submission.studentId.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {submission.studentId.studentNumber}
                      {submission.studentId.section && ` • Section ${submission.studentId.section}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {submission.submittedAt && (
                      <p className="text-sm text-gray-500">
                        Submitted {formatDate(submission.submittedAt)}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className={`badge ${getStatusBadge(submission.status)}`}>
                        {submission.status}
                      </span>
                      {(submission.status === 'GRADED' || submission.status === 'RETURNED') && (
                        <span className={`font-bold ${submission.isPassing ? 'text-green-600' : 'text-red-600'}`}>
                          {submission.percentage}%
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => openGradingModal(submission)}
                    className="btn btn-secondary flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    {submission.status === 'SUBMITTED' ? 'Grade' : 'View'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grading Modal */}
      <Modal
        isOpen={showGradingModal}
        onClose={() => setShowGradingModal(false)}
        title={`Grade Submission - ${selectedSubmission?.studentId.firstName} ${selectedSubmission?.studentId.lastName}`}
        size="xl"
      >
        {selectedSubmission && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-500">Total Score</p>
                  <p className="text-xl font-bold">{selectedSubmission.totalScore}/{selectedSubmission.maxScore}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Percentage</p>
                  <p className={`text-xl font-bold ${selectedSubmission.isPassing ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedSubmission.percentage}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`badge ${getStatusBadge(selectedSubmission.status)}`}>
                    {selectedSubmission.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Questions */}
            {questions.map((question, index) => {
              const answer = getAnswerForQuestion(question._id);
              const gradeInfo = gradingData[question._id] || { points: answer?.pointsEarned || 0, feedback: answer?.feedback || '' };

              return (
                <div key={question._id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <span className="text-sm text-gray-500">Question {index + 1} • {question.type}</span>
                      <p className="font-medium mt-1">{question.questionText}</p>
                    </div>
                    <span className="text-sm text-gray-500">{question.points} pts</span>
                  </div>

                  {/* Student's Answer */}
                  <div className="bg-gray-50 rounded p-3 mb-3">
                    <p className="text-sm text-gray-500 mb-1">Student's Answer:</p>
                    {question.type === 'MULTIPLE_CHOICE' && question.choices && (
                      <p className="font-medium">
                        {question.choices.find((c) => c._id === answer?.selectedChoiceId)?.text || 'No answer'}
                        {answer?.isCorrect !== undefined && (
                          <span className={`ml-2 ${answer.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            ({answer.isCorrect ? 'Correct' : 'Incorrect'})
                          </span>
                        )}
                      </p>
                    )}
                    {question.type === 'TRUE_FALSE' && (
                      <p className="font-medium">
                        {answer?.booleanAnswer !== undefined ? (answer.booleanAnswer ? 'True' : 'False') : 'No answer'}
                        {answer?.isCorrect !== undefined && (
                          <span className={`ml-2 ${answer.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            ({answer.isCorrect ? 'Correct' : 'Incorrect'})
                          </span>
                        )}
                      </p>
                    )}
                    {(question.type === 'SHORT_ANSWER' || question.type === 'ESSAY' || question.type === 'FILL_IN_BLANK') && (
                      <p className="font-medium whitespace-pre-wrap">{answer?.textAnswer || 'No answer'}</p>
                    )}
                  </div>

                  {/* Correct Answer (for objective questions) */}
                  {question.type !== 'ESSAY' && (
                    <div className="bg-green-50 rounded p-3 mb-3">
                      <p className="text-sm text-green-700 mb-1">Correct Answer:</p>
                      {question.type === 'MULTIPLE_CHOICE' && question.choices && (
                        <p className="font-medium text-green-800">
                          {question.choices.find((c) => c.isCorrect)?.text}
                        </p>
                      )}
                      {question.type === 'TRUE_FALSE' && (
                        <p className="font-medium text-green-800">
                          {question.correctAnswer ? 'True' : 'False'}
                        </p>
                      )}
                      {(question.type === 'SHORT_ANSWER' || question.type === 'FILL_IN_BLANK') && question.acceptedAnswers && (
                        <p className="font-medium text-green-800">
                          {question.acceptedAnswers.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Grading controls */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Points Earned (max {question.points})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={question.points}
                        value={gradeInfo.points}
                        onChange={(e) =>
                          setGradingData({
                            ...gradingData,
                            [question._id]: { ...gradeInfo, points: Math.min(Number(e.target.value), question.points) },
                          })
                        }
                        className="input"
                      />
                    </div>
                    
                  </div>

                  <button
                    onClick={() => handleGradeQuestion(question._id)}
                    disabled={saving}
                    className="btn btn-secondary mt-3 text-sm"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Grade'}
                  </button>
                </div>
              );
            })}

            {/* Actions */}
            {selectedSubmission.status !== 'RETURNED' && (
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={() => setShowGradingModal(false)} className="btn btn-secondary">
                  Close
                </button>
                <button
                  onClick={() => {
                    setReturnFeedback(overallFeedback);
                    setShowReturnModal(true);
                  }}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Return to Student
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Return Modal */}
      <Modal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Return Graded Exam"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            This will make the graded exam visible to the student. You can add overall feedback below.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Overall Feedback (Optional)</label>
            <textarea
              value={returnFeedback}
              onChange={(e) => setReturnFeedback(e.target.value)}
              rows={4}
              placeholder="Add any overall comments for the student..."
              className="input"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowReturnModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleReturnSubmission}
              disabled={returning}
              className="btn btn-primary flex items-center gap-2"
            >
              {returning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Return to Student
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ExamSubmissionsPage;