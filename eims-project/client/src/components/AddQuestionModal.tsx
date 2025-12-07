import { useState } from 'react';
import { questionsApi, Question, QuestionType, Choice } from '../services/api';

interface Props {
  examId: string;
  onClose: () => void;
  onCreated: (question: Question) => void;
}

const defaultChoices: Choice[] = [
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
];

const AddQuestionModal = ({ examId, onClose, onCreated }: Props) => {
  const [type, setType] = useState<QuestionType>('MULTIPLE_CHOICE');
  const [questionText, setQuestionText] = useState('');
  const [points, setPoints] = useState(1);
  const [choices, setChoices] = useState<Choice[]>(defaultChoices);
  const [correctAnswerTF, setCorrectAnswerTF] = useState<boolean | undefined>(true);
  const [shortAnswer, setShortAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddChoice = () => {
    setChoices(prev => [...prev, { text: '', isCorrect: false }]);
  };

  const handleChoiceChange = (index: number, field: 'text' | 'isCorrect', value: any) => {
    setChoices(prev =>
      prev.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      )
    );
  };

  const handleSetCorrectMCQ = (index: number) => {
    setChoices(prev =>
      prev.map((c, i) => ({ ...c, isCorrect: i === index }))
    );
  };

  const handleSubmit = async () => {
    if (!questionText.trim()) return;

    setLoading(true);
    try {
      const payload: any = {
        examId,
        type,
        questionText,
        points,
      };

      if (type === 'MULTIPLE_CHOICE') {
        payload.choices = choices;
      } else if (type === 'TRUE_FALSE') {
        payload.correctAnswer = correctAnswerTF;
      } else if (type === 'SHORT_ANSWER' || type === 'FILL_IN_BLANK') {
        payload.acceptedAnswers = shortAnswer
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }

      const created = await questionsApi.create(payload);
      onCreated(created);
      onClose();
    } catch (err) {
      console.error('Failed to create question', err);
      alert('Failed to create question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Add Question</h3>

        {/* Question text */}
        <label className="block mb-4">
          <span className="block text-sm font-medium mb-1">Question</span>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm"
            rows={3}
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
          />
        </label>

        {/* Question type + points */}
        <div className="flex gap-4 mb-4">
          <label className="flex-1">
            <span className="block text-sm font-medium mb-1">Type</span>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={type}
              onChange={e => setType(e.target.value as QuestionType)}
            >
              <option value="MULTIPLE_CHOICE">Multiple choice</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="SHORT_ANSWER">Short answer</option>
              <option value="FILL_IN_BLANK">Fill in the blank</option>
              <option value="ESSAY">Essay</option>
            </select>
          </label>

          <label className="w-32">
            <span className="block text-sm font-medium mb-1">Points</span>
            <input
              type="number"
              min={0}
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={points}
              onChange={e => setPoints(Number(e.target.value) || 0)}
            />
          </label>
        </div>

        {/* Type-specific UI */}
        {type === 'MULTIPLE_CHOICE' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Options</span>
              <button
                onClick={handleAddChoice}
                className="text-xs text-rose-600 hover:underline"
              >
                + Add option
              </button>
            </div>

            <div className="space-y-2">
              {choices.map((choice, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={choice.isCorrect}
                    onChange={() => handleSetCorrectMCQ(index)}
                  />
                  <input
                    className="flex-1 border rounded-md px-3 py-1 text-sm"
                    placeholder={`Option ${index + 1}`}
                    value={choice.text}
                    onChange={e =>
                      handleChoiceChange(index, 'text', e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {type === 'TRUE_FALSE' && (
          <div className="mb-4">
            <span className="block text-sm font-medium mb-1">
              Correct answer
            </span>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={correctAnswerTF === true}
                  onChange={() => setCorrectAnswerTF(true)}
                />
                True
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={correctAnswerTF === false}
                  onChange={() => setCorrectAnswerTF(false)}
                />
                False
              </label>
            </div>
          </div>
        )}

        {(type === 'SHORT_ANSWER' || type === 'FILL_IN_BLANK') && (
          <div className="mb-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1">
                Accepted answers (comma separated)
              </span>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="e.g. UPCAT, UP College Admission Test"
                value={shortAnswer}
                onChange={e => setShortAnswer(e.target.value)}
              />
            </label>
          </div>
        )}

        {type === 'ESSAY' && (
          <p className="text-xs text-gray-500 mb-4">
            For now this will be an open-ended question. You can add rubric and
            max words later in the advanced settings.
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            className="px-3 py-2 text-sm rounded-md border border-gray-300"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Saving…' : 'Add question'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddQuestionModal;
