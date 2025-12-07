import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, questionsApi, Question, QuestionType } from '../services/api';
import { Exam } from '../types'; // adjust if your Exam type export is different

import AddQuestionModal from '@/components/AddQuestionModal';
import QuestionCard from '@/components/QuestionCard';

const ExamBuilderPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (!examId) return;

        const examRes = await api.get<Exam>(`/exams/${examId}`);
        setExam(examRes.data);

        const q = await questionsApi.getByExam(examId);
        setQuestions(q);
      } catch (err) {
        console.error('Failed to load exam or questions', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [examId]);

  const handleQuestionCreated = (question: Question) => {
    setQuestions(prev => [...prev, question].sort((a, b) => a.order - b.order));
  };

  const handleQuestionUpdated = (updated: Question) => {
    setQuestions(prev =>
      prev.map(q => (q._id === updated._id ? updated : q)).sort((a, b) => a.order - b.order)
    );
  };

  const handleQuestionDeleted = (id: string) => {
    setQuestions(prev => prev.filter(q => q._id !== id));
  };

  if (loading) return <div className="p-6">Loading exam builder...</div>;
  if (!exam) return <div className="p-6">Exam not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left: Exam info */}
      <aside className="w-80 border-r bg-white p-6 flex flex-col items-start gap-3">
        <button
          className="text-sm text-gray-500 mb-2"
          onClick={() => navigate('/exams')}
        >
          ← Back to Exams
        </button>

        <h1 className="text-xl font-semibold">{exam.title}</h1>
        <p className="text-sm text-gray-600">{exam.description}</p>

        <div className="mt-4 space-y-2 text-sm">
          <div>
            <span className="font-medium">Course:</span> {exam.courseId?.code}{' '}
            {exam.courseId?.name}
          </div>
          <div>
            <span className="font-medium">Status:</span> {exam.status}
          </div>
          <div>
            <span className="font-medium">Questions:</span> {questions.length}
          </div>
          <div>
            <span className="font-medium">Total Points:</span> {exam.totalPoints ?? 0}
          </div>
        </div>

        <button
          className="mt-auto px-4 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => navigate(`/exams`)}
        >
          Done
        </button>
      </aside>

      {/* Right: Question builder */}
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Questions</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-md bg-rose-600 text-white text-sm font-medium hover:bg-rose-700"
          >
            + Add Question
          </button>
        </div>

        {questions.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
            No questions yet. Click <span className="font-semibold">“Add Question”</span> to
            start building this exam.
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map(q => (
              <QuestionCard
                key={q._id}
                question={q}
                onUpdate={handleQuestionUpdated}
                onDelete={handleQuestionDeleted}
              />
            ))}
          </div>
        )}

        {showAddModal && examId && (
          <AddQuestionModal
            examId={examId}
            onClose={() => setShowAddModal(false)}
            onCreated={handleQuestionCreated}
          />
        )}
      </main>
    </div>
  );
};

export default ExamBuilderPage;
