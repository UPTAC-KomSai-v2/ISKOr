import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import Modal from '@/components/Modal';
import MathRenderer from '@/components/MathRenderer';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  Loader2,
  Send,
  CheckCircle,
  FileText,
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
    shuffleQuestions: boolean;
    shuffleChoices: boolean;
  };
  courseId: { code: string; name: string };
}

const TakeExamPage = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  // Shuffle array helper
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Start exam and fetch questions
  useEffect(() => {
    const startExam = async () => {
      try {
        // Start the exam
        const startRes = await api.post(`/submissions/start/${examId}`);
        setSubmissionId(startRes.data._id);

        // Fetch exam details
        const examRes = await api.get(`/exams/${examId}`);
        setExam(examRes.data);

        // Set timer if time limit exists
        if (examRes.data.settings.timeLimitMinutes) {
          const startTime = new Date(startRes.data.startedAt).getTime();
          const timeLimit = examRes.data.settings.timeLimitMinutes * 60 * 1000;
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, timeLimit - elapsed);
          setTimeRemaining(Math.floor(remaining / 1000));
        }

        // Fetch questions
        const questionsRes = await api.get(`/questions/exam/${examId}`);
        let qs = questionsRes.data;

        // Shuffle questions if needed
        if (examRes.data.settings.shuffleQuestions) {
          qs = shuffleArray(qs);
        }

        // Shuffle choices if needed
        if (examRes.data.settings.shuffleChoices) {
          qs = qs.map((q: Question) => ({
            ...q,
            choices: q.choices ? shuffleArray(q.choices) : q.choices,
          }));
        }

        setQuestions(qs);

        // Load existing answers if any
        if (startRes.data.answers?.length > 0) {
          const existingAnswers: Record<string, Answer> = {};
          startRes.data.answers.forEach((a: any) => {
            existingAnswers[a.questionId] = {
              questionId: a.questionId,
              selectedChoiceId: a.selectedChoiceId,
              booleanAnswer: a.booleanAnswer,
              textAnswer: a.textAnswer,
            };
          });
          setAnswers(existingAnswers);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to start exam');
      } finally {
        setLoading(false);
      }
    };

    startExam();
  }, [examId]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          // Auto-submit when time runs out
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Auto-save answer
  const saveAnswer = useCallback(async (answer: Answer) => {
    if (!submissionId) return;
    try {
      await api.put(`/submissions/${submissionId}/answer`, answer);
    } catch (err) {
      console.error('Failed to save answer:', err);
    }
  }, [submissionId]);

  const updateAnswer = (questionId: string, update: Partial<Answer>) => {
    const newAnswer = { ...answers[questionId], questionId, ...update };
    setAnswers((prev) => ({ ...prev, [questionId]: newAnswer }));
    saveAnswer(newAnswer);
  };

  const handleSubmit = async () => {
    if (!submissionId) return;
    setSubmitting(true);
    setShowConfirmModal(false);
    
    try {
      await api.post(`/submissions/${submissionId}/submit`);
      navigate(`/submissions/${submissionId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit');
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).filter(
    (qId) => 
      answers[qId].selectedChoiceId || 
      answers[qId].booleanAnswer !== undefined || 
      answers[qId].textAnswer
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Cannot Take Exam</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={() => navigate('/exams')} className="btn btn-primary">
          Back to Exams
        </button>
      </div>
    );
  }

  // Show instructions first
  if (showInstructions && exam?.instructions) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{exam.title}</h1>
          <p className="text-gray-500 mb-6">{exam.courseId.code}</p>

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-blue-800 mb-2">Instructions</h2>
            <div className="text-blue-700 whitespace-pre-wrap">
              <MathRenderer text={exam.instructions} />
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-600 mb-6">
            <p>• Total Questions: {questions.length}</p>
            {exam.settings.timeLimitMinutes && (
              <p>• Time Limit: {exam.settings.timeLimitMinutes} minutes</p>
            )}
            <p>• Your progress is saved automatically</p>
          </div>

          <button
            onClick={() => setShowInstructions(false)}
            className="btn btn-primary w-full"
          >
            Start Exam
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="card p-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900">{exam?.title}</h1>
          <p className="text-sm text-gray-500">{exam?.courseId?.code}</p>
        </div>
        
        <div className="flex items-center gap-4">
          {timeRemaining !== null && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
              timeRemaining < 300 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
            }`}>
              <Clock className="w-4 h-4" />
              <span className="font-mono font-medium">{formatTime(timeRemaining)}</span>
            </div>
          )}
          <div className="text-sm text-gray-500">
            {answeredCount}/{questions.length} answered
          </div>
        </div>
      </div>

      {/* Question Navigator */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {questions.map((q, idx) => {
            const isAnswered = answers[q._id]?.selectedChoiceId || 
                              answers[q._id]?.booleanAnswer !== undefined ||
                              answers[q._id]?.textAnswer;
            return (
              <button
                key={q._id}
                onClick={() => setCurrentIndex(idx)}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                  idx === currentIndex
                    ? 'bg-primary-600 text-white'
                    : isAnswered
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Question */}
      {currentQuestion && (
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <span className="text-sm text-gray-500">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {currentQuestion.points} {currentQuestion.points === 1 ? 'point' : 'points'}
            </span>
          </div>

          {/* Question text with math rendering */}
          <div className="text-lg font-medium text-gray-900 mb-6">
            <MathRenderer text={currentQuestion.questionText} />
          </div>

          {/* Answer Options */}
          {currentQuestion.type === 'MULTIPLE_CHOICE' && currentQuestion.choices && (
            <div className="space-y-3">
              {currentQuestion.choices.map((choice) => (
                <label
                  key={choice._id}
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    answers[currentQuestion._id]?.selectedChoiceId === choice._id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion._id}`}
                    checked={answers[currentQuestion._id]?.selectedChoiceId === choice._id}
                    onChange={() => updateAnswer(currentQuestion._id, { selectedChoiceId: choice._id })}
                    className="mt-1"
                  />
                  <MathRenderer text={choice.text} className="flex-1" />
                </label>
              ))}
            </div>
          )}

          {currentQuestion.type === 'TRUE_FALSE' && (
            <div className="space-y-3">
              {[
                { value: true, label: 'True' },
                { value: false, label: 'False' },
              ].map((option) => (
                <label
                  key={String(option.value)}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    answers[currentQuestion._id]?.booleanAnswer === option.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion._id}`}
                    checked={answers[currentQuestion._id]?.booleanAnswer === option.value}
                    onChange={() => updateAnswer(currentQuestion._id, { booleanAnswer: option.value })}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          )}

          {(currentQuestion.type === 'SHORT_ANSWER' || currentQuestion.type === 'FILL_IN_BLANK') && (
            <input
              type="text"
              value={answers[currentQuestion._id]?.textAnswer || ''}
              onChange={(e) => updateAnswer(currentQuestion._id, { textAnswer: e.target.value })}
              className="input w-full"
              placeholder="Type your answer here..."
            />
          )}

          {currentQuestion.type === 'ESSAY' && (
            <div>
              <textarea
                value={answers[currentQuestion._id]?.textAnswer || ''}
                onChange={(e) => updateAnswer(currentQuestion._id, { textAnswer: e.target.value })}
                className="input w-full"
                rows={8}
                placeholder="Write your essay here..."
              />
              {currentQuestion.maxWords && (
                <p className="text-sm text-gray-500 mt-2">
                  Max words: {currentQuestion.maxWords}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="btn btn-secondary flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        {currentIndex < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIndex(currentIndex + 1)}
            className="btn btn-primary flex items-center gap-2"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={submitting}
            className="btn btn-success flex items-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit Exam
          </button>
        )}
      </div>

      {/* Confirm Submit Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Submit Exam"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to submit your exam?
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Answered Questions:</span>
              <span className="font-medium">{answeredCount} of {questions.length}</span>
            </div>
            {answeredCount < questions.length && (
              <p className="text-orange-600 text-sm mt-2">
                ⚠️ You have {questions.length - answeredCount} unanswered question(s)
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="btn btn-secondary"
            >
              Review Answers
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-primary flex items-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Confirm Submit
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TakeExamPage;
