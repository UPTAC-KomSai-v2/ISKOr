import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import Modal from '@/components/Modal';
import MathRenderer from '@/components/MathRenderer';
import ExamTimer, { ExamTimerFloating } from '@/components/ExamTimer';
import useExamTimer from '@/hooks/useExamTimer';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  Loader2,
  Send,
  CheckCircle,
  FileText,
  Save,
  AlertTriangle,
} from 'lucide-react';

interface Choice {
  _id: string;
  text: string;
}

interface Question {
  _id: string;
  type: string;
  questionText: string;
  points: number;
  choices?: Choice[];
  maxWords?: number;
}

interface Answer {
  questionId: string;
  selectedChoiceId?: string;
  booleanAnswer?: boolean;
  textAnswer?: string;
}

interface Exam {
  _id: string;
  title: string;
  instructions?: string;
  settings: {
    timeLimitMinutes?: number;
    shuffleQuestions?: boolean;
    showTimerWarning?: boolean;
    warningThresholdMinutes?: number;
    autoSubmitOnTimeExpire?: boolean;
  };
  totalPoints: number;
}

interface Submission {
  _id: string;
  status: string;
  answers: Answer[];
  startedAt: string;
  timeExpiry?: string;
  timeAllottedMinutes?: number;
}

const TakeExamPageWithTimer = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  // State
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Timer hook
  const timer = useExamTimer({
    timeExpiry: submission?.timeExpiry || null,
    warningThresholdMinutes: exam?.settings?.warningThresholdMinutes || 5,
    onTimeExpire: handleTimeExpire,
    onWarning: handleTimeWarning,
    onAutoSave: handleAutoSave,
    autoSaveInterval: 30,
  });

  // Fetch exam data
  useEffect(() => {
    fetchExamData();
  }, [examId]);

  const fetchExamData = async () => {
    try {
      setLoading(true);
      
      // Start or get existing submission
      const startRes = await api.post(`/submissions/exam/${examId}/start`);
      const submissionData = startRes.data;
      setSubmission(submissionData);

      // Fetch exam details
      const examRes = await api.get(`/exams/${examId}`);
      setExam(examRes.data);

      // Fetch questions
      const questionsRes = await api.get(`/exams/${examId}/questions`);
      setQuestions(questionsRes.data);

      // Initialize answers from existing submission
      const answersMap: Record<string, Answer> = {};
      submissionData.answers?.forEach((ans: Answer) => {
        answersMap[ans.questionId] = ans;
      });
      setAnswers(answersMap);

    } catch (err: any) {
      if (err.response?.status === 400) {
        // Max attempts reached or other error
        setError(err.response?.data?.error || 'Cannot start exam');
      } else {
        setError('Failed to load exam');
      }
    } finally {
      setLoading(false);
    }
  };

  // Save single answer
  const saveAnswer = async (answer: Answer) => {
    if (!submission) return;
    
    try {
      setSaving(true);
      await api.post(`/submissions/${submission._id}/answer`, answer);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save answer:', err);
    } finally {
      setSaving(false);
    }
  };

  // Handle answer change
  const handleAnswerChange = (questionId: string, update: Partial<Answer>) => {
    const newAnswer: Answer = {
      questionId,
      ...answers[questionId],
      ...update,
    };
    setAnswers((prev) => ({ ...prev, [questionId]: newAnswer }));
    
    // Debounced save
    saveAnswer(newAnswer);
  };

  // Auto-save callback
  function handleAutoSave() {
    // Auto-save is handled per-answer, but we can trigger a save status update
    setLastSaved(new Date());
  }

  // Time warning callback
  function handleTimeWarning() {
    // Play warning sound
    try {
      const audio = new Audio('/sounds/timer-warning.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {}
    
    // Could show a toast notification here
  }

  // Time expire callback
  function handleTimeExpire() {
    setShowTimeUpModal(true);
    
    // Auto-submit after brief delay
    setTimeout(() => {
      handleSubmit(true);
    }, 2000);
  }

  // Submit exam
  const handleSubmit = async (isAutoSubmit = false) => {
    if (!submission) return;
    
    try {
      setSubmitting(true);
      await api.post(`/submissions/${submission._id}/submit`);
      
      // Navigate to results or confirmation page
      navigate(`/submissions/${submission._id}`, { 
        state: { autoSubmitted: isAutoSubmit } 
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit exam');
      setShowSubmitModal(false);
      setShowTimeUpModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Navigation
  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
    }
  };

  // Get answer status for question
  const getAnswerStatus = (questionId: string) => {
    const answer = answers[questionId];
    if (!answer) return 'unanswered';
    
    const question = questions.find(q => q._id === questionId);
    if (!question) return 'unanswered';
    
    switch (question.type) {
      case 'MULTIPLE_CHOICE':
        return answer.selectedChoiceId ? 'answered' : 'unanswered';
      case 'TRUE_FALSE':
        return answer.booleanAnswer !== undefined ? 'answered' : 'unanswered';
      case 'SHORT_ANSWER':
      case 'ESSAY':
      case 'FILL_IN_BLANK':
        return answer.textAnswer?.trim() ? 'answered' : 'unanswered';
      default:
        return 'unanswered';
    }
  };

  // Count answered questions
  const answeredCount = questions.filter(q => getAnswerStatus(q._id) === 'answered').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-900">{error}</h2>
          <button
            onClick={() => navigate('/exams')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Back to Exams
          </button>
        </div>
      </div>
    );
  }

  if (!exam || !submission || questions.length === 0) return null;

  const currentQuestion = questions[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Floating Timer */}
      {submission.timeExpiry && (
        <ExamTimerFloating
          timeExpiry={submission.timeExpiry}
          timeLimitMinutes={exam.settings.timeLimitMinutes}
          warningThresholdMinutes={exam.settings.warningThresholdMinutes}
          onTimeExpire={handleTimeExpire}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{exam.title}</h1>
              <p className="text-sm text-gray-500">
                Question {currentIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Save Status */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Saved {lastSaved.toLocaleTimeString()}</span>
                  </>
                ) : null}
              </div>

              {/* Inline Timer (for smaller screens where floating is hidden) */}
              {submission.timeExpiry && (
                <div className="hidden sm:block">
                  <ExamTimer
                    timeExpiry={submission.timeExpiry}
                    timeLimitMinutes={exam.settings.timeLimitMinutes}
                    size="sm"
                  />
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={() => setShowSubmitModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Send className="w-4 h-4" />
                Submit
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 flex gap-6">
        {/* Main Content */}
        <div className="flex-1">
          {/* Question Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
            {/* Question Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {currentQuestion.type.replace('_', ' ')}
              </span>
              <span className="text-sm text-gray-500">
                {currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Question Text */}
            <div className="prose prose-lg max-w-none mb-6">
              <MathRenderer content={currentQuestion.questionText} />
            </div>

            {/* Answer Input */}
            <div className="space-y-3">
              {currentQuestion.type === 'MULTIPLE_CHOICE' && currentQuestion.choices && (
                currentQuestion.choices.map((choice) => (
                  <label
                    key={choice._id}
                    className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      answers[currentQuestion._id]?.selectedChoiceId === choice._id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion._id}`}
                      checked={answers[currentQuestion._id]?.selectedChoiceId === choice._id}
                      onChange={() => handleAnswerChange(currentQuestion._id, { selectedChoiceId: choice._id })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-3">
                      <MathRenderer content={choice.text} />
                    </span>
                  </label>
                ))
              )}

              {currentQuestion.type === 'TRUE_FALSE' && (
                <div className="flex gap-4">
                  {[true, false].map((value) => (
                    <label
                      key={String(value)}
                      className={`flex-1 flex items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        answers[currentQuestion._id]?.booleanAnswer === value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion._id}`}
                        checked={answers[currentQuestion._id]?.booleanAnswer === value}
                        onChange={() => handleAnswerChange(currentQuestion._id, { booleanAnswer: value })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="ml-3 font-medium">{value ? 'True' : 'False'}</span>
                    </label>
                  ))}
                </div>
              )}

              {(currentQuestion.type === 'SHORT_ANSWER' || currentQuestion.type === 'FILL_IN_BLANK') && (
                <input
                  type="text"
                  value={answers[currentQuestion._id]?.textAnswer || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion._id, { textAnswer: e.target.value })}
                  placeholder="Type your answer here..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}

              {currentQuestion.type === 'ESSAY' && (
                <div>
                  <textarea
                    value={answers[currentQuestion._id]?.textAnswer || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion._id, { textAnswer: e.target.value })}
                    placeholder="Write your essay here..."
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                  />
                  {currentQuestion.maxWords && (
                    <p className="text-sm text-gray-500 mt-2">
                      Word count: {(answers[currentQuestion._id]?.textAnswer || '').split(/\s+/).filter(Boolean).length} / {currentQuestion.maxWords} max
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => goToQuestion(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={() => goToQuestion(currentIndex + 1)}
              disabled={currentIndex === questions.length - 1}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sidebar - Question Navigator */}
        <aside className="w-64 flex-shrink-0 hidden lg:block">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-20">
            <h3 className="font-medium text-gray-900 mb-3">Questions</h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, index) => {
                const status = getAnswerStatus(q._id);
                return (
                  <button
                    key={q._id}
                    onClick={() => goToQuestion(index)}
                    className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${
                      index === currentIndex
                        ? 'bg-blue-600 text-white'
                        : status === 'answered'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            {/* Progress */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium text-gray-900">
                  {answeredCount} / {questions.length}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Timer Progress */}
            {submission.timeExpiry && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Time</span>
                  <span className={`font-medium ${
                    timer.status === 'critical' ? 'text-red-600' :
                    timer.status === 'warning' ? 'text-amber-600' :
                    'text-gray-900'
                  }`}>
                    {timer.formattedTime}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      timer.status === 'critical' ? 'bg-red-500' :
                      timer.status === 'warning' ? 'bg-amber-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${timer.progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Submit Confirmation Modal */}
      <Modal isOpen={showSubmitModal} onClose={() => setShowSubmitModal(false)}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <Send className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Submit Exam?</h2>
          </div>

          <p className="text-gray-600 mb-4">
            You have answered {answeredCount} out of {questions.length} questions.
          </p>

          {answeredCount < questions.length && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-amber-800">
                  You have {questions.length - answeredCount} unanswered question{questions.length - answeredCount !== 1 ? 's' : ''}.
                  Are you sure you want to submit?
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowSubmitModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Continue Exam
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Submit
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Time's Up Modal */}
      <Modal isOpen={showTimeUpModal} onClose={() => {}}>
        <div className="p-6 text-center">
          <div className="p-4 bg-red-100 rounded-full w-fit mx-auto mb-4">
            <Clock className="w-12 h-12 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Time's Up!</h2>
          <p className="text-gray-600 mb-4">
            Your exam is being automatically submitted...
          </p>
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        </div>
      </Modal>
    </div>
  );
};

export default TakeExamPageWithTimer;
