import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { examsApi } from "@/services/api";
import { Exam, Question } from "@/types";
import { ArrowLeft } from "lucide-react";

const ExamPreviewPage = () => {
  const { examId } = useParams();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchExam = async () => {
    try {
      const res = await examsApi.getById(examId!);
      setExam(res.data);
    } catch (err) {
      console.error("Failed to load exam:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [examId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-300 border-t-primary-600 animate-spin rounded-full" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="text-center mt-12 text-gray-600">Exam not found.</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      {/* Back Button */}
      <Link to={`/exams/${exam._id}/builder`} className="flex items-center gap-2 text-primary-600 hover:text-primary-700">
        <ArrowLeft className="w-4 h-4" />
        Back to Builder
      </Link>

      {/* Exam Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-900">{exam.title}</h1>
        <p className="text-gray-600">{exam.courseId?.code} — {exam.courseId?.name}</p>

        <p className="text-gray-500">
          Total Points: <strong>{exam.totalPoints}</strong>  
          {exam.passingScore !== undefined && (
            <> • Passing Score: <strong>{exam.passingScore}</strong></>
          )}
        </p>

        {exam.description && (
          <p className="text-gray-700 mt-2">{exam.description}</p>
        )}
      </div>

      {/* Questions Section */}
      <div className="border-t pt-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Questions ({exam.questions?.length || 0})
        </h2>

        {(!exam.questions || exam.questions.length === 0) && (
          <p className="text-gray-500">No questions added yet.</p>
        )}

        {exam.questions?.map((q: Question, index: number) => (
          <div key={q._id} className="border p-4 rounded-lg shadow-sm bg-white">
            {/* Question Header */}
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-gray-900 text-lg">
                {index + 1}. {q.question}
              </h3>
              <span className="text-sm text-gray-600">{q.points} pts</span>
            </div>

            {/* Question Type */}
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">
              {q.type.replace("_", " ")}
            </p>

            {/* Display Choices */}
            {q.type === "MULTIPLE_CHOICE" && (
              <ul className="space-y-2 ml-2">
                {q.options?.map((opt, idx) => (
                  <li
                    key={idx}
                    className={`flex items-center gap-2 ${
                      opt.isCorrect ? "text-green-600 font-medium" : "text-gray-700"
                    }`}
                  >
                    <input type="radio" disabled className="text-primary-600" />
                    {opt.text}
                    {opt.isCorrect && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                        correct
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* True or False */}
            {q.type === "TRUE_FALSE" && (
              <div className="ml-2 space-y-1">
                <p className={`text-gray-700 ${q.answer === "TRUE" ? "font-semibold" : ""}`}>
                  ● True {q.answer === "TRUE" && "(Correct)"}
                </p>
                <p className={`text-gray-700 ${q.answer === "FALSE" ? "font-semibold" : ""}`}>
                  ● False {q.answer === "FALSE" && "(Correct)"}
                </p>
              </div>
            )}

            {/* Identification */}
            {q.type === "IDENTIFICATION" && (
              <div className="p-2 bg-gray-50 border rounded mt-2">
                <p className="text-gray-700">
                  Correct Answer: <strong>{q.answer}</strong>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExamPreviewPage;
