import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { resultsApi } from '@/services/api';
import { ExamResult, Role } from '@/types';
import { ClipboardList, CheckCircle, Clock, TrendingUp } from 'lucide-react';

const ResultsPage = () => {
  const { user } = useAuthStore();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await resultsApi.list();
        setResults(res.data.data.results);
      } catch (error) {
        console.error('Failed to fetch results:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  const getScoreColor = (score: number, total: number, passing?: number) => {
    const percentage = (score / total) * 100;
    if (passing && score < passing) return 'text-red-600';
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-blue-600';
    return 'text-yellow-600';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Results</h1>
        <p className="text-gray-600">
          {user?.role === Role.STUDENT
            ? 'View your exam results'
            : 'Manage exam results and grades'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No results available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((result) => {
            const exam = result.examId;
            const percentage = exam?.totalPoints 
              ? ((result.score / exam.totalPoints) * 100).toFixed(1) 
              : 0;
            const passed = exam?.passingScore ? result.score >= exam.passingScore : true;

            return (
              <div key={result._id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      passed ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {passed ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <TrendingUp className="w-6 h-6 text-red-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{exam?.title}</h3>
                      <p className="text-sm text-gray-500">
                        {exam?.courseId?.code} • {exam?.type}
                      </p>
                      {user?.role !== Role.STUDENT && (
                        <p className="text-sm text-gray-600 mt-1">
                          {result.studentId?.firstName} {result.studentId?.lastName}
                          {result.studentId?.studentNumber && ` (${result.studentId.studentNumber})`}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getScoreColor(result.score, exam?.totalPoints || 100, exam?.passingScore)}`}>
                      {result.score} / {exam?.totalPoints}
                    </p>
                    <p className="text-sm text-gray-500">{percentage}%</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`badge ${result.status === 'PUBLISHED' ? 'badge-success' : 'badge-warning'}`}>
                      {result.status}
                    </span>
                    {exam?.passingScore && (
                      <span className="text-gray-500">
                        Passing: {exam.passingScore} pts
                      </span>
                    )}
                  </div>
                  
                  {user?.role === Role.STUDENT && result.status === 'PUBLISHED' && (
                    <button className="text-sm text-primary-600 hover:text-primary-700">
                      Request Regrade
                    </button>
                  )}
                </div>

                {result.remarks && (
                  <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    <strong>Remarks:</strong> {result.remarks}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ResultsPage;
