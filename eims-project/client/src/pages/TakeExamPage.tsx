import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, AlertCircle, ChevronLeft, ChevronRight, Send, Loader2, CheckCircle } from 'lucide-react';
import api from '@/services/api';

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
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        // Shuffle if needed
        if (examRes.data.settings.shuffleQuestions) {
          qs = qs.sort(() => Math.random() - 0.5);
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
          handleSubmit(); // Auto-submit when time runs out
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
    (qId) => answers[qId].selectedChoiceId || answers[qId].booleanAnswer !== undefined || answers[qId].textAnswer
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 sticky top-20 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{exam?.title}</h1>
            <p className="text-sm text-gray-500">{exam?.courseId.code}</p>
          </div>
          <div className="flex items-center gap-4">
            {timeRemaining !== null && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                timeRemaining < 300 ? 'bg-red-100 text-red-700' : 'bg-gray-100'
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

        {/* Question navigation */}
        <div className="flex flex-wrap gap-2 mt-4">
          {questions.map((q, i) => (
            <button
              key={q._id}
              onClick={() => setCurrentIndex(i)}
              className={`w-8 h-8 rounded text-sm font-medium ${
                i === currentIndex
                  ? 'bg-primary-600 text-white'
                  : answers[q._id]?.selectedChoiceId || answers[q._id]?.booleanAnswer !== undefined || answers[q._id]?.textAnswer
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Question */}
      {currentQuestion && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <span className="text-sm text-gray-500">Question {currentIndex + 1} of {questions.length}</span>
            <span className="text-sm font-medium">{currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}</span>
          </div>

          <p className="text-lg font-medium mb-6">{currentQuestion.questionText}</p>

          {/* Multiple Choice */}
          {currentQuestion.type === 'MULTIPLE_CHOICE' && currentQuestion.choices && (
            <div className="space-y-3">
              {currentQuestion.choices.map((choice) => (
                <label
                  key={choice._id}
                  className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    answers[currentQuestion._id]?.selectedChoiceId === choice._id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion._id}`}
                    checked={answers[currentQuestion._id]?.selectedChoiceId === choice._id}
                    onChange={() => updateAnswer(currentQuestion._id, { selectedChoiceId: choice._id })}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span>{choice.text}</span>
                </label>
              ))}
            </div>
          )}

          {/* True/False */}
          {currentQuestion.type === 'TRUE_FALSE' && (
            <div className="flex gap-4">
              {[true, false].map((value) => (
                <label
                  key={String(value)}
                  className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border cursor-pointer transition-colors ${
                    answers[currentQuestion._id]?.booleanAnswer === value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion._id}`}
                    checked={answers[currentQuestion._id]?.booleanAnswer === value}
                    onChange={() => updateAnswer(currentQuestion._id, { booleanAnswer: value })}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span className="font-medium">{value ? 'True' : 'False'}</span>
                </label>
              ))}
            </div>
          )}

          {/* Short Answer / Fill in Blank */}
          {(currentQuestion.type === 'SHORT_ANSWER' || currentQuestion.type === 'FILL_IN_BLANK') && (
            <input
              type="text"
              value={answers[currentQuestion._id]?.textAnswer || ''}
              onChange={(e) => updateAnswer(currentQuestion._id, { textAnswer: e.target.value })}
              className="input w-full"
              placeholder="Type your answer..."
            />
          )}

          {/* Essay */}
          {currentQuestion.type === 'ESSAY' && (
            <div>
              <textarea
                value={answers[currentQuestion._id]?.textAnswer || ''}
                onChange={(e) => updateAnswer(currentQuestion._id, { textAnswer: e.target.value })}
                rows={8}
                className="input w-full"
                placeholder="Write your answer..."
              />
              {currentQuestion.maxWords && (
                <p className="text-sm text-gray-500 mt-2">
                  Word count: {(answers[currentQuestion._id]?.textAnswer || '').split(/\s+/).filter(Boolean).length}
                  {currentQuestion.maxWords && ` / ${currentQuestion.maxWords} max`}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>

        {currentIndex === questions.length - 1 ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg"
          >
            <Send className="w-5 h-5" />
            Submit Exam
          </button>
        ) : (
          <button
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Confirm Submit Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Submit Exam?</h3>
            <p className="text-gray-600 mb-4">
              You have answered {answeredCount} out of {questions.length} questions.
              {answeredCount < questions.length && (
                <span className="text-yellow-600 block mt-2">
                  Warning: {questions.length - answeredCount} questions are unanswered.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Review Answers
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeExamPage;
