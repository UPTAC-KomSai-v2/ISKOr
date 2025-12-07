import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle, Loader2, MessageSquare } from 'lucide-react';

interface Choice {
  _id: string;
  text: string;
  isCorrect?: boolean;
}

interface Question {
  _id: string;
  type: string;
  questionText: string;
  points: number;
  choices?: Choice[];
  correctAnswer?: boolean;
  acceptedAnswers?: string[];
  explanation?: string;
}

interface Answer {
  questionId: string;
  selectedChoiceId?: string;
  booleanAnswer?: boolean;
  textAnswer?: string;
  pointsEarned: number;
  isCorrect?: boolean;
  feedback?: string;
}

interface Submission {
  _id: string;
  examId: { 
    _id: string; 
    title: string; 
    type: string; 
    settings: {
      showResults: boolean;
      showCorrectAnswers: boolean;
      showFeedback: boolean;
      allowReview: boolean;
    };
  };
  studentId: { firstName: string; lastName: string; email: string };
  status: string;
  answers: Answer[];
  totalScore: number;
  maxScore: number;
  percentage: number;
  isPassing: boolean;
  overallFeedback?: string;
  submittedAt: string;
  startedAt: string;
}

const ViewSubmissionPage = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const response = await api.get(`/submissions/${submissionId}`);
        setSubmission(response.data.submission);
        setQuestions(response.data.questions);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load submission');
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [submissionId]);

  const getAnswerForQuestion = (questionId: string) => {
    return submission?.answers.find((a) => a.questionId === questionId);
  };

  const formatDuration = (start: string, end: string) => {
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return { label: 'In Progress', color: 'text-yellow-600', bg: 'bg-yellow-100' };
      case 'SUBMITTED':
        return { label: 'Submitted - Awaiting Grading', color: 'text-blue-600', bg: 'bg-blue-100' };
      case 'GRADED':
        return { label: 'Graded', color: 'text-purple-600', bg: 'bg-purple-100' };
      case 'RETURNED':
        return { label: 'Results Available', color: 'text-green-600', bg: 'bg-green-100' };
      default:
        return { label: status, color: 'text-gray-600', bg: 'bg-gray-100' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Cannot View Results</h2>
        <p className="text-gray-600 mb-4">{error || 'Submission not found'}</p>
        <button onClick={() => navigate('/exams')} className="btn btn-primary">
          Back to Exams
        </button>
      </div>
    );
  }

  const statusInfo = getStatusInfo(submission.status);
  const showResults = submission.status === 'GRADED' || submission.status === 'RETURNED';
  const showAnswers = submission.examId.settings?.showCorrectAnswers && showResults;
  const showFeedback = submission.examId.settings?.showFeedback && showResults;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{submission.examId.title}</h1>
          <p className="text-sm text-gray-500">
            {submission.examId.type} • Submitted {formatDate(submission.submittedAt)}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bg} ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Waiting for results message */}
      {(submission.status === 'SUBMITTED' || submission.status === 'GRADED') && submission.status !== 'RETURNED' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 text-center">
          <Clock className="w-12 h-12 text-blue-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-blue-800 mb-2">
            {submission.status === 'SUBMITTED' ? 'Awaiting Grading' : 'Grading Complete'}
          </h2>
          <p className="text-blue-600">
            {submission.status === 'SUBMITTED' 
              ? 'Your exam has been submitted and is waiting to be graded by your instructor.'
              : 'Your exam has been graded. Results will be available once your instructor releases them.'}
          </p>
        </div>
      )}

      {/* Score Card - Only show when results are available */}
      {showResults && (
        <div className={`rounded-xl p-6 mb-6 ${submission.isPassing ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Your Score</p>
              <p className="text-3xl font-bold text-gray-900">
                {submission.totalScore} / {submission.maxScore}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-bold ${submission.isPassing ? 'text-green-600' : 'text-red-600'}`}>
                {submission.percentage}%
              </p>
              <p className={`text-sm font-medium ${submission.isPassing ? 'text-green-600' : 'text-red-600'}`}>
                {submission.isPassing ? '✓ PASSED' : '✗ NEEDS IMPROVEMENT'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-600">Duration</p>
              <p className="font-semibold">{formatDuration(submission.startedAt, submission.submittedAt)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Questions</p>
              <p className="font-semibold">{questions.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Correct</p>
              <p className="font-semibold">
                {submission.answers.filter((a) => a.isCorrect).length} / {questions.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overall Feedback */}
      {submission.overallFeedback && showFeedback && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-800 mb-1">Instructor Feedback</h3>
              <p className="text-blue-700">{submission.overallFeedback}</p>
            </div>
          </div>
        </div>
      )}

      {/* Questions Review */}
      {submission.examId.settings?.showResults && showResults && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Question Review</h2>
          
          {questions.map((question, index) => {
            const answer = getAnswerForQuestion(question._id);
            const isCorrect = answer?.isCorrect;
            const pointsEarned = answer?.pointsEarned || 0;

            return (
              <div key={question._id} className="bg-white rounded-xl border p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    {isCorrect === true && <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />}
                    {isCorrect === false && <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />}
                    {isCorrect === undefined && <Clock className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />}
                    <div>
                      <span className="text-sm text-gray-500">Question {index + 1} • {question.type.replace('_', ' ')}</span>
                      <p className="font-medium mt-1">{question.questionText}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-medium px-2 py-1 rounded ${
                    pointsEarned === question.points 
                      ? 'bg-green-100 text-green-700' 
                      : pointsEarned === 0 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {pointsEarned}/{question.points} pts
                  </span>
                </div>

                {/* Student's Answer */}
                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <p className="text-sm text-gray-500 mb-2">Your Answer:</p>
                  
                  {question.type === 'MULTIPLE_CHOICE' && question.choices && (
                    <div className="space-y-2">
                      {question.choices.map((choice) => {
                        const isSelected = choice._id === answer?.selectedChoiceId;
                        const isCorrectChoice = showAnswers && choice.isCorrect;
                        
                        return (
                          <div
                            key={choice._id}
                            className={`p-3 rounded-lg border ${
                              isSelected && isCorrectChoice
                                ? 'bg-green-50 border-green-300'
                                : isSelected && !isCorrectChoice
                                ? 'bg-red-50 border-red-300'
                                : isCorrectChoice && showAnswers
                                ? 'bg-green-50 border-green-200'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <span className={`text-sm font-medium ${isCorrectChoice ? 'text-green-600' : 'text-red-600'}`}>
                                  {isCorrectChoice ? '✓' : '✗'}
                                </span>
                              )}
                              {!isSelected && isCorrectChoice && showAnswers && (
                                <span className="text-sm font-medium text-green-600">✓</span>
                              )}
                              <span className={isSelected ? 'font-medium' : ''}>{choice.text}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {question.type === 'TRUE_FALSE' && (
                    <div className="flex gap-4">
                      {[true, false].map((value) => {
                        const isSelected = answer?.booleanAnswer === value;
                        const isCorrectAnswer = showAnswers && question.correctAnswer === value;
                        
                        return (
                          <div
                            key={String(value)}
                            className={`flex-1 p-3 rounded-lg border text-center ${
                              isSelected && isCorrectAnswer
                                ? 'bg-green-50 border-green-300'
                                : isSelected && !isCorrectAnswer
                                ? 'bg-red-50 border-red-300'
                                : isCorrectAnswer && showAnswers
                                ? 'bg-green-50 border-green-200'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <span className={isSelected ? 'font-medium' : ''}>
                              {value ? 'True' : 'False'}
                              {isSelected && (isCorrectAnswer ? ' ✓' : ' ✗')}
                              {!isSelected && isCorrectAnswer && showAnswers && ' ✓'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(question.type === 'SHORT_ANSWER' || question.type === 'FILL_IN_BLANK') && (
                    <div>
                      <p className={`font-medium ${isCorrect ? 'text-green-700' : isCorrect === false ? 'text-red-700' : ''}`}>
                        {answer?.textAnswer || <span className="text-gray-400 italic">No answer provided</span>}
                      </p>
                      {showAnswers && question.acceptedAnswers && question.acceptedAnswers.length > 0 && (
                        <p className="text-sm text-green-600 mt-2">
                          Accepted answers: {question.acceptedAnswers.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {question.type === 'ESSAY' && (
                    <p className="whitespace-pre-wrap">
                      {answer?.textAnswer || <span className="text-gray-400 italic">No answer provided</span>}
                    </p>
                  )}
                </div>

                {/* Question Feedback */}
                {answer?.feedback && showFeedback && (
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Feedback: </span>
                      {answer.feedback}
                    </p>
                  </div>
                )}

                {/* Explanation */}
                {question.explanation && showAnswers && (
                  <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 mt-3">
                    <p className="text-sm text-yellow-800">
                      <span className="font-medium">Explanation: </span>
                      {question.explanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Back button */}
      <div className="mt-8 text-center">
        <button onClick={() => navigate('/exams')} className="btn btn-secondary">
          Back to Exams
        </button>
      </div>
    </div>
  );
};

export default ViewSubmissionPage;