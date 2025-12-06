import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle, Loader2, Trophy, TrendingUp } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface Question {
  _id: string;
  type: string;
  questionText: string;
  points: number;
  choices?: { _id: string; text: string; isCorrect?: boolean }[];
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
  examId: { _id: string; title: string; type: string; settings: any };
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
        <button onClick={() => navigate('/results')} className="btn btn-primary">
          Back to Results
        </button>
      </div>
    );
  }

  const showAnswers = submission.examId.settings?.showCorrectAnswers && 
    (submission.status === 'GRADED' || submission.status === 'RETURNED');

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{submission.examId.title}</h1>
          <p className="text-sm text-gray-500">
            {submission.examId.type} • Submitted {new Date(submission.submittedAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Score Card */}
      <div className={`rounded-xl p-6 mb-6 ${submission.isPassing ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {submission.isPassing ? (
              <Trophy className="w-12 h-12 text-green-600" />
            ) : (
              <TrendingUp className="w-12 h-12 text-red-600" />
            )}
            <div>
              <p className="text-sm text-gray-600">Your Score</p>
              <p className="text-3xl font-bold">
                {submission.totalScore}/{submission.maxScore}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-bold ${submission.isPassing ? 'text-green-600' : 'text-red-600'}`}>
              {submission.percentage}%
            </p>
            <p className={`text-sm ${submission.isPassing ? 'text-green-600' : 'text-red-600'}`}>
              {submission.isPassing ? 'PASSED' : 'NEEDS IMPROVEMENT'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200">
          <div className="text-center">
            <p className="text-sm text-gray-600">Duration</p>
            <p className="font-semibold">{formatDuration(submission.startedAt, submission.submittedAt)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Status</p>
            <p className="font-semibold">{submission.status}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Questions</p>
            <p className="font-semibold">{questions.length}</p>
          </div>
        </div>
      </div>

      {/* Overall Feedback */}
      {submission.overallFeedback && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-blue-800 mb-2">Instructor Feedback</h3>
          <p className="text-blue-700">{submission.overallFeedback}</p>
        </div>
      )}

      {/* Questions Review */}
      {submission.examId.settings?.showResults && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Question Review</h2>
          
          {questions.map((question, index) => {
            const answer = getAnswerForQuestion(question._id);
            const isCorrect = answer?.isCorrect;

            return (
              <div key={question._id} className="bg-white rounded-xl border p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    {isCorrect === true && <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />}
                    {isCorrect === false && <XCircle className="w-5 h-5 text-red-500 mt-0.5" />}
                    {isCorrect === undefined && <Clock className="w-5 h-5 text-yellow-500 mt-0.5" />}
                    <div>
                      <span className="text-sm text-gray-500">Question {index + 1}</span>
                      <p className="font-medium">{question.questionText}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${
                    answer?.pointsEarned === question.points ? 'text-green-600' :
                    answer?.pointsEarned === 0 ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {answer?.pointsEarned || 0}/{question.points} pts
                  </span>
                </div>

                {/* Multiple Choice */}
                {question.type === 'MULTIPLE_CHOICE' && question.choices && (
                  <div className="space-y-2 ml-8">
                    {question.choices.map((choice) => {
                      const isSelected = answer?.selectedChoiceId === choice._id;
                      const isCorrectChoice = showAnswers && choice.isCorrect;

                      return (
                        <div
                          key={choice._id}
                          className={`p-3 rounded-lg border ${
                            isSelected && isCorrectChoice ? 'bg-green-50 border-green-300' :
                            isSelected && !isCorrectChoice ? 'bg-red-50 border-red-300' :
                            isCorrectChoice ? 'bg-green-50 border-green-200' :
                            'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              isCorrectChoice ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            {!isSelected && isCorrectChoice && <CheckCircle className="w-4 h-4 text-green-500" />}
                            <span>{choice.text}</span>
                            {isSelected && <span className="text-xs text-gray-500">(Your answer)</span>}
                            {isCorrectChoice && <span className="text-xs text-green-600">(Correct)</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* True/False */}
                {question.type === 'TRUE_FALSE' && (
                  <div className="ml-8">
                    <p className="text-gray-600">
                      Your answer: <span className="font-medium">{answer?.booleanAnswer ? 'True' : 'False'}</span>
                    </p>
                    {showAnswers && (
                      <p className="text-green-600">
                        Correct answer: <span className="font-medium">{question.correctAnswer ? 'True' : 'False'}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Short Answer / Essay */}
                {(question.type === 'SHORT_ANSWER' || question.type === 'FILL_IN_BLANK' || question.type === 'ESSAY') && (
                  <div className="ml-8">
                    <p className="text-sm text-gray-500 mb-1">Your answer:</p>
                    <p className="bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                      {answer?.textAnswer || '(No answer provided)'}
                    </p>
                    {showAnswers && question.acceptedAnswers && question.acceptedAnswers.length > 0 && (
                      <p className="text-sm text-green-600 mt-2">
                        Accepted answers: {question.acceptedAnswers.join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {/* Feedback */}
                {answer?.feedback && (
                  <div className="mt-4 ml-8 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Feedback:</span> {answer.feedback}
                    </p>
                  </div>
                )}

                {/* Explanation */}
                {showAnswers && question.explanation && (
                  <div className="mt-4 ml-8 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Explanation:</span> {question.explanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Back Button */}
      <div className="mt-6 flex justify-center">
        <Link to="/results" className="btn btn-outline">
          Back to Results
        </Link>
      </div>
    </div>
  );
};

export default ViewSubmissionPage;
