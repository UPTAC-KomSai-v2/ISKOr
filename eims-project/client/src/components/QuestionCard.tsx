import { Question, questionsApi } from '../services/api';

interface Props {
  question: Question;
  onUpdate: (q: Question) => void;
  onDelete: (id: string) => void;
}

const QuestionCard = ({ question, onUpdate, onDelete }: Props) => {
  const handleDelete = async () => {
    if (!confirm('Delete this question?')) return;

    try {
      await questionsApi.remove(question._id);
      onDelete(question._id);
    } catch (err) {
      console.error('Failed to delete question', err);
      alert('Failed to delete question');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            {question.type.replace('_', ' ')}
          </div>
          <div className="font-medium mb-2">{question.questionText}</div>

          {/* Show choices for MCQ */}
          {question.type === 'MULTIPLE_CHOICE' && question.choices && (
            <ul className="mt-2 space-y-1 text-sm">
              {question.choices.map(choice => (
                <li key={choice._id} className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
                  <span>{choice.text}</span>
                  {choice.isCorrect && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Correct
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Show general info for others */}
          {question.type === 'TRUE_FALSE' && (
            <div className="mt-2 text-sm text-gray-600">
              Correct answer:{' '}
              <span className="font-semibold">
                {question.correctAnswer ? 'True' : 'False'}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="text-sm text-gray-500">{question.points} pts</span>
          <button
            onClick={handleDelete}
            className="text-xs text-red-600 hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionCard;
