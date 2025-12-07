import { useState } from 'react';
import { questionsApi, Question, QuestionType, Choice } from '../services/api';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';

interface Props {
  examId: string;
  onClose: () => void;
  onCreated: (question: Question) => void;
}

const defaultChoices: Choice[] = [
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
];

// LaTeX preview component
const MathPreview = ({ text }: { text: string }) => {
  // Simple regex to detect LaTeX patterns
  const hasLatex = /\$.*?\$|\\\[.*?\\\]|\\\(.*?\\\)/s.test(text);
  
  if (!hasLatex) return null;
  
  return (
    <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
      <p className="text-blue-600 text-xs mb-1">Math Preview (LaTeX detected):</p>
      <div 
        className="text-blue-800"
        dangerouslySetInnerHTML={{ 
          __html: text
            .replace(/\$\$(.*?)\$\$/gs, '<span class="block text-center my-2 font-mono">[$1]</span>')
            .replace(/\$(.*?)\$/g, '<span class="font-mono">$1</span>')
            .replace(/\\\[(.*?)\\\]/gs, '<span class="block text-center my-2 font-mono">[$1]</span>')
            .replace(/\\\((.*?)\\\)/g, '<span class="font-mono">($1)</span>')
        }}
      />
    </div>
  );
};

const AddQuestionModal = ({ examId, onClose, onCreated }: Props) => {
  const [type, setType] = useState<QuestionType>('MULTIPLE_CHOICE');
  const [questionText, setQuestionText] = useState('');
  const [points, setPoints] = useState(1);
  const [choices, setChoices] = useState<Choice[]>(defaultChoices);
  const [correctAnswerTF, setCorrectAnswerTF] = useState<boolean | undefined>(true);
  const [shortAnswer, setShortAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMathHelp, setShowMathHelp] = useState(false);

  const handleAddChoice = () => {
    setChoices(prev => [...prev, { text: '', isCorrect: false }]);
  };

  const handleRemoveChoice = (index: number) => {
    if (choices.length <= 2) return;
    setChoices(prev => prev.filter((_, i) => i !== index));
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

  // Insert LaTeX template at cursor position
  const insertLatex = (template: string) => {
    const textarea = document.getElementById('questionText') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = questionText;
      const newText = text.substring(0, start) + template + text.substring(end);
      setQuestionText(newText);
      // Focus and set cursor position after the template
      setTimeout(() => {
        textarea.focus();
        const cursorPos = start + template.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    } else {
      setQuestionText(prev => prev + template);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Add Question</h3>

        {/* Question text with math support */}
        <label className="block mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="block text-sm font-medium">Question</span>
            <button
              type="button"
              onClick={() => setShowMathHelp(!showMathHelp)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <HelpCircle className="w-3 h-3" />
              Math Equations Help
            </button>
          </div>
          
          {/* Math help panel */}
          {showMathHelp && (
            <div className="mb-2 p-3 bg-gray-50 rounded-lg text-sm">
              <p className="font-medium mb-2">LaTeX Math Equations:</p>
              <p className="text-gray-600 mb-2">
                Use LaTeX syntax to include mathematical equations in your questions.
              </p>
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Inline math: <code className="bg-gray-200 px-1 rounded">$x^2 + y^2 = z^2$</code></p>
                <p className="text-xs text-gray-500">Display math: <code className="bg-gray-200 px-1 rounded">$$\frac&#123;a&#125;&#123;b&#125;$$</code></p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => insertLatex('$x$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Inline $...$
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$$x$$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Display $$...$$
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$\\frac{a}{b}$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Fraction
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$\\sqrt{x}$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Square Root
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$x^{n}$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Exponent
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$x_{n}$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Subscript
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$\\sum_{i=1}^{n}$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Summation
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$\\int_{a}^{b}$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Integral
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$\\pi$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  π
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$\\theta$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  θ
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$\\infty$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  ∞
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$\\pm$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  ±
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$\\leq$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  ≤
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$\\geq$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  ≥
                </button>
                <button
                  type="button"
                  onClick={() => insertLatex('$\\neq$')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  ≠
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Note: Math equations will be rendered using KaTeX when students view the exam.
              </p>
            </div>
          )}
          
          <textarea
            id="questionText"
            className="w-full border rounded-md px-3 py-2 text-sm font-mono"
            rows={4}
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            placeholder="Enter your question... Use $...$ for inline math or $$...$$ for display math"
          />
          
          {/* Math preview */}
          <MathPreview text={questionText} />
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
              <span className="text-sm font-medium">Options (select correct answer)</span>
              <button
                type="button"
                onClick={handleAddChoice}
                className="text-xs text-rose-600 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add option
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
                    className="w-4 h-4 text-blue-600"
                  />
                  <input
                    className="flex-1 border rounded-md px-3 py-1 text-sm"
                    placeholder={`Option ${index + 1} (supports math: $x^2$)`}
                    value={choice.text}
                    onChange={e =>
                      handleChoiceChange(index, 'text', e.target.value)
                    }
                  />
                  {choices.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveChoice(index)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Tip: You can use LaTeX in choices too, e.g., $\frac&#123;1&#125;&#123;2&#125;$
            </p>
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
                placeholder="e.g. 42, forty-two, Forty Two"
                value={shortAnswer}
                onChange={e => setShortAnswer(e.target.value)}
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Enter multiple accepted answers separated by commas. Matching is case-insensitive.
            </p>
          </div>
        )}

        {type === 'ESSAY' && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Essay questions require manual grading. Students will be able to write a long-form response.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              You can add rubric and max words later in the advanced settings.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <button
            className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={handleSubmit}
            disabled={loading || !questionText.trim()}
          >
            {loading ? 'Saving…' : 'Add Question'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddQuestionModal;
