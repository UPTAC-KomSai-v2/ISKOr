import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus, Save, Trash2, GripVertical, ChevronDown, ChevronUp,
  Loader2, ArrowLeft, Eye, Play, Settings,
  CheckCircle, Type, ToggleLeft, ListOrdered, AlignLeft, FileText,
} from 'lucide-react';
import api from '@/services/api';

type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY' | 'FILL_IN_BLANK';

interface Choice {
  _id?: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  _id?: string;
  type: QuestionType;
  questionText: string;
  points: number;
  order: number;
  choices?: Choice[];
  correctAnswer?: boolean;
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  rubric?: string;
  maxWords?: number;
  explanation?: string;
  isExpanded?: boolean;
}

interface Exam {
  _id: string;
  title: string;
  type: string;
  status: string;
  totalPoints: number;
  questionCount: number;
  settings: {
    shuffleQuestions: boolean;
    shuffleChoices: boolean;
    showResults: boolean;
    showCorrectAnswers: boolean;
    maxAttempts: number;
    timeLimitMinutes?: number;
    passingPercentage: number;
  };
  courseId: { _id: string; code: string; name: string };
}

const questionTypeIcons: Record<QuestionType, React.ReactNode> = {
  MULTIPLE_CHOICE: <ListOrdered className="w-4 h-4" />,
  TRUE_FALSE: <ToggleLeft className="w-4 h-4" />,
  SHORT_ANSWER: <Type className="w-4 h-4" />,
  ESSAY: <AlignLeft className="w-4 h-4" />,
  FILL_IN_BLANK: <FileText className="w-4 h-4" />,
};

const questionTypeLabels: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  TRUE_FALSE: 'True/False',
  SHORT_ANSWER: 'Short Answer',
  ESSAY: 'Essay',
  FILL_IN_BLANK: 'Fill in Blank',
};

const ExamCreatorPage = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchExam();
    fetchQuestions();
  }, [examId]);

  const fetchExam = async () => {
    try {
      const response = await api.get(`/exams/${examId}`);
      setExam(response.data);
    } catch (error) {
      console.error('Error fetching exam:', error);
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await api.get(`/questions/exam/${examId}`);
      setQuestions(response.data.map((q: Question) => ({ ...q, isExpanded: false })));
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = (type: QuestionType) => {
    const newQuestion: Question = {
      type,
      questionText: '',
      points: 1,
      order: questions.length,
      isExpanded: true,
    };

    if (type === 'MULTIPLE_CHOICE') {
      newQuestion.choices = [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ];
    }
    if (type === 'TRUE_FALSE') newQuestion.correctAnswer = true;
    if (type === 'SHORT_ANSWER' || type === 'FILL_IN_BLANK') {
      newQuestion.acceptedAnswers = [''];
      newQuestion.caseSensitive = false;
    }

    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const deleteQuestion = async (index: number) => {
    const question = questions[index];
    if (question._id) {
      try {
        await api.delete(`/questions/${question._id}`);
      } catch (error) {
        return;
      }
    }
    setQuestions(questions.filter((_, i) => i !== index));
    fetchExam();
  };

  const toggleQuestion = (index: number) => {
    updateQuestion(index, { isExpanded: !questions[index].isExpanded });
  };

  const saveQuestion = async (index: number) => {
    const question = questions[index];
    setSaving(true);
    try {
      if (question._id) {
        await api.put(`/questions/${question._id}`, question);
      } else {
        const response = await api.post('/questions', { ...question, examId });
        updateQuestion(index, { _id: response.data._id });
      }
      setMessage({ type: 'success', text: 'Question saved!' });
      fetchExam();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const saveAllQuestions = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (q._id) {
          await api.put(`/questions/${q._id}`, { ...q, order: i });
        } else {
          const res = await api.post('/questions', { ...q, examId, order: i });
          questions[i]._id = res.data._id;
        }
      }
      setMessage({ type: 'success', text: 'All questions saved!' });
      fetchExam();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const publishExam = async () => {
    if (questions.length === 0) {
      setMessage({ type: 'error', text: 'Add questions first' });
      return;
    }
    await saveAllQuestions();
    try {
      await api.post(`/exams/${examId}/publish`);
      setMessage({ type: 'success', text: 'Exam published!' });
      fetchExam();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to publish' });
    }
  };

  const activateExam = async () => {
    try {
      await api.post(`/exams/${examId}/activate`);
      setMessage({ type: 'success', text: 'Exam is now active!' });
      fetchExam();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to activate' });
    }
  };

  const updateSettings = async (settings: Partial<Exam['settings']>) => {
    try {
      await api.put(`/exams/${examId}`, { settings });
      setExam(prev => prev ? { ...prev, settings: { ...prev.settings, ...settings } } : null);
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/exams')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{exam?.title}</h1>
            <p className="text-sm text-gray-500">
              {exam?.courseId?.code} • {questions.length} questions • {exam?.totalPoints || 0} pts
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm ${
          exam?.status === 'DRAFT' ? 'bg-gray-100' :
          exam?.status === 'PUBLISHED' ? 'bg-blue-100 text-blue-700' :
          exam?.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100'
        }`}>{exam?.status}</span>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Add:</span>
            {(Object.keys(questionTypeLabels) as QuestionType[]).map((type) => (
              <button
                key={type}
                onClick={() => addQuestion(type)}
                disabled={exam?.status !== 'DRAFT'}
                className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
              >
                {questionTypeIcons[type]}
                <span className="hidden md:inline">{questionTypeLabels[type]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-gray-100 rounded">
              <Settings className="w-4 h-4" /> Settings
            </button>
            <button onClick={saveAllQuestions} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save All
            </button>
            {exam?.status === 'DRAFT' && (
              <button onClick={publishExam} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded">
                <Eye className="w-4 h-4" /> Publish
              </button>
            )}
            {exam?.status === 'PUBLISHED' && (
              <button onClick={activateExam} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 rounded">
                <Play className="w-4 h-4" /> Activate
              </button>
            )}
          </div>
        </div>

        {showSettings && (
          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={exam?.settings.shuffleQuestions} onChange={(e) => updateSettings({ shuffleQuestions: e.target.checked })} /> Shuffle Questions
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={exam?.settings.shuffleChoices} onChange={(e) => updateSettings({ shuffleChoices: e.target.checked })} /> Shuffle Choices
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={exam?.settings.showResults} onChange={(e) => updateSettings({ showResults: e.target.checked })} /> Show Results
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={exam?.settings.showCorrectAnswers} onChange={(e) => updateSettings({ showCorrectAnswers: e.target.checked })} /> Show Answers
            </label>
            <div>
              <label className="text-xs text-gray-600">Max Attempts</label>
              <input type="number" min="1" value={exam?.settings.maxAttempts || 1} onChange={(e) => updateSettings({ maxAttempts: parseInt(e.target.value) })} className="input mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Time Limit (min)</label>
              <input type="number" min="0" value={exam?.settings.timeLimitMinutes || ''} onChange={(e) => updateSettings({ timeLimitMinutes: e.target.value ? parseInt(e.target.value) : undefined })} className="input mt-1" placeholder="No limit" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Passing %</label>
              <input type="number" min="0" max="100" value={exam?.settings.passingPercentage || 60} onChange={(e) => updateSettings({ passingPercentage: parseInt(e.target.value) })} className="input mt-1" />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No questions yet</h3>
            <p className="text-gray-500">Add questions using the buttons above</p>
          </div>
        ) : (
          questions.map((question, index) => (
            <QuestionEditor
              key={index}
              question={question}
              index={index}
              isEditable={exam?.status === 'DRAFT'}
              onUpdate={(updates) => updateQuestion(index, updates)}
              onDelete={() => deleteQuestion(index)}
              onSave={() => saveQuestion(index)}
              onToggle={() => toggleQuestion(index)}
              saving={saving}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface QuestionEditorProps {
  question: Question;
  index: number;
  isEditable: boolean;
  onUpdate: (updates: Partial<Question>) => void;
  onDelete: () => void;
  onSave: () => void;
  onToggle: () => void;
  saving: boolean;
}

const QuestionEditor = ({ question, index, isEditable, onUpdate, onDelete, onSave, onToggle, saving }: QuestionEditorProps) => {
  const updateChoice = (ci: number, updates: Partial<Choice>) => {
    const newChoices = [...(question.choices || [])];
    newChoices[ci] = { ...newChoices[ci], ...updates };
    onUpdate({ choices: newChoices });
  };

  const setCorrectChoice = (ci: number) => {
    const newChoices = (question.choices || []).map((c, i) => ({ ...c, isCorrect: i === ci }));
    onUpdate({ choices: newChoices });
  };

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="flex items-center gap-3 p-4 bg-gray-50 cursor-pointer" onClick={onToggle}>
        <GripVertical className="w-5 h-5 text-gray-400" />
        <div className="flex items-center gap-2 px-2 py-1 bg-white rounded text-sm">
          {questionTypeIcons[question.type]}
          <span className="hidden sm:inline">{questionTypeLabels[question.type]}</span>
        </div>
        <span className="text-gray-500">Q{index + 1}</span>
        <span className="flex-1 truncate">{question.questionText || '(No text)'}</span>
        <span className="text-sm text-gray-500">{question.points} pts</span>
        {question._id && <CheckCircle className="w-4 h-4 text-green-500" />}
        {question.isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </div>

      {question.isExpanded && (
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Question Text</label>
            <textarea value={question.questionText} onChange={(e) => onUpdate({ questionText: e.target.value })} disabled={!isEditable} rows={2} className="input" placeholder="Enter your question..." />
          </div>

          <div className="w-32">
            <label className="block text-sm font-medium mb-1">Points</label>
            <input type="number" min="0" value={question.points} onChange={(e) => onUpdate({ points: parseInt(e.target.value) || 0 })} disabled={!isEditable} className="input" />
          </div>

          {question.type === 'MULTIPLE_CHOICE' && (
            <div>
              <label className="block text-sm font-medium mb-2">Choices (click circle for correct)</label>
              <div className="space-y-2">
                {question.choices?.map((choice, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <button onClick={() => setCorrectChoice(ci)} disabled={!isEditable} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${choice.isCorrect ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'}`}>
                      {choice.isCorrect && <CheckCircle className="w-4 h-4" />}
                    </button>
                    <input type="text" value={choice.text} onChange={(e) => updateChoice(ci, { text: e.target.value })} disabled={!isEditable} className="input flex-1" placeholder={`Choice ${ci + 1}`} />
                    {question.choices && question.choices.length > 2 && (
                      <button onClick={() => onUpdate({ choices: question.choices?.filter((_, i) => i !== ci) })} disabled={!isEditable} className="p-2 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => onUpdate({ choices: [...(question.choices || []), { text: '', isCorrect: false }] })} disabled={!isEditable} className="mt-2 flex items-center gap-1 text-sm text-primary-600">
                <Plus className="w-4 h-4" /> Add Choice
              </button>
            </div>
          )}

          {question.type === 'TRUE_FALSE' && (
            <div>
              <label className="block text-sm font-medium mb-2">Correct Answer</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={question.correctAnswer === true} onChange={() => onUpdate({ correctAnswer: true })} disabled={!isEditable} /> True
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={question.correctAnswer === false} onChange={() => onUpdate({ correctAnswer: false })} disabled={!isEditable} /> False
                </label>
              </div>
            </div>
          )}

          {(question.type === 'SHORT_ANSWER' || question.type === 'FILL_IN_BLANK') && (
            <div>
              <label className="block text-sm font-medium mb-2">Accepted Answers</label>
              <div className="space-y-2">
                {question.acceptedAnswers?.map((ans, ai) => (
                  <div key={ai} className="flex items-center gap-2">
                    <input type="text" value={ans} onChange={(e) => {
                      const newAns = [...(question.acceptedAnswers || [])];
                      newAns[ai] = e.target.value;
                      onUpdate({ acceptedAnswers: newAns });
                    }} disabled={!isEditable} className="input flex-1" placeholder="Accepted answer" />
                    {question.acceptedAnswers && question.acceptedAnswers.length > 1 && (
                      <button onClick={() => onUpdate({ acceptedAnswers: question.acceptedAnswers?.filter((_, i) => i !== ai) })} disabled={!isEditable} className="p-2 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => onUpdate({ acceptedAnswers: [...(question.acceptedAnswers || []), ''] })} disabled={!isEditable} className="mt-2 flex items-center gap-1 text-sm text-primary-600">
                <Plus className="w-4 h-4" /> Add Answer
              </button>
              <label className="flex items-center gap-2 mt-2 text-sm">
                <input type="checkbox" checked={question.caseSensitive} onChange={(e) => onUpdate({ caseSensitive: e.target.checked })} disabled={!isEditable} /> Case sensitive
              </label>
            </div>
          )}

          {question.type === 'ESSAY' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Grading Rubric</label>
                <textarea value={question.rubric || ''} onChange={(e) => onUpdate({ rubric: e.target.value })} disabled={!isEditable} rows={2} className="input" placeholder="How will this be graded?" />
              </div>
              <div className="w-32">
                <label className="block text-sm font-medium mb-1">Max Words</label>
                <input type="number" min="0" value={question.maxWords || ''} onChange={(e) => onUpdate({ maxWords: e.target.value ? parseInt(e.target.value) : undefined })} disabled={!isEditable} className="input" placeholder="No limit" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Explanation (optional)</label>
            <textarea value={question.explanation || ''} onChange={(e) => onUpdate({ explanation: e.target.value })} disabled={!isEditable} rows={2} className="input" placeholder="Shown after answering..." />
          </div>

          <div className="flex justify-between pt-4 border-t">
            <button onClick={onDelete} disabled={!isEditable} className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button onClick={onSave} disabled={saving || !isEditable} className="flex items-center gap-1 px-4 py-2 text-sm bg-primary-600 text-white hover:bg-primary-700 rounded disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamCreatorPage;
