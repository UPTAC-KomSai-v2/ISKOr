import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts';

interface OverallStats {
  totalExamsTaken: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passingRate: number;
}

interface ScoreHistoryItem {
  examId: string;
  examTitle: string;
  examType: string;
  courseCode: string;
  score: number;
  isPassing: boolean;
  submittedAt: string;
}

interface CoursePerformance {
  courseId: string;
  courseCode: string;
  courseName: string;
  averageScore: number;
  examCount: number;
  passingRate: number;
  exams: { examTitle: string; score: number; isPassing: boolean }[];
}

interface StudentPerformance {
  studentId: string;
  overallStats: OverallStats;
  scoreHistory: ScoreHistoryItem[];
  coursePerformance: CoursePerformance[];
}

interface ExamRanking {
  examId: string;
  examTitle: string;
  studentScore: number;
  studentRank: number;
  totalStudents: number;
  percentileRank: number;
  classAverage: number;
  aboveAverage: boolean;
  deviationFromAverage: number;
  quartile: string;
  isPassing: boolean;
  scoreDistribution: { label: string; count: number }[];
}

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444'];

const StudentInsightsPage = () => {
  const navigate = useNavigate();
  const [performance, setPerformance] = useState<StudentPerformance | null>(null);
  const [selectedExamRanking, setSelectedExamRanking] = useState<ExamRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPerformance();
  }, []);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      const res = await api.get('/insights/student/performance');
      setPerformance(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchExamRanking = async (examId: string) => {
    try {
      setRankingLoading(true);
      const res = await api.get(`/insights/student/exam/${examId}/ranking`);
      setSelectedExamRanking(res.data);
    } catch (err: any) {
      console.error('Failed to fetch ranking:', err);
    } finally {
      setRankingLoading(false);
    }
  };

  const getScoreTrend = () => {
    if (!performance || performance.scoreHistory.length < 2) return null;
    const recent = performance.scoreHistory.slice(0, 5);
    const avgRecent = recent.reduce((sum, s) => sum + s.score, 0) / recent.length;
    const older = performance.scoreHistory.slice(5, 10);
    if (older.length === 0) return null;
    const avgOlder = older.reduce((sum, s) => sum + s.score, 0) / older.length;
    return avgRecent - avgOlder;
  };

  const trend = getScoreTrend();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-600">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!performance || performance.scoreHistory.length === 0) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-600 hover:text-gray-900 mb-6"
        >
          Back
        </button>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-blue-900">No Exam History Yet</h3>
          <p className="text-blue-700 mt-1">
            Your performance insights will appear here after you complete some exams.
          </p>
        </div>
      </div>
    );
  }

  const { overallStats, scoreHistory, coursePerformance } = performance;

  // Prepare chart data (reverse for chronological order)
  const chartData = [...scoreHistory].reverse().slice(-10).map((item, index) => ({
    name: `Exam ${index + 1}`,
    score: item.score,
    examTitle: item.examTitle,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          Back
        </button>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Performance</h1>
          <p className="text-gray-600">Track your progress and rankings</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Exams Taken</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{overallStats.totalExamsTaken}</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Average Score</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{overallStats.averageScore}%</p>

          {trend !== null && (
            <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? 'Up' : 'Down'} {Math.abs(Math.round(trend))}% vs previous
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Highest Score</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{overallStats.highestScore}%</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Lowest Score</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{overallStats.lowestScore}%</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Passing Rate</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{overallStats.passingRate}%</p>
        </div>
      </div>

      {/* Score Trend Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              formatter={(value: number, name: string, props: any) => [`${value}%`, props.payload.examTitle]}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#scoreGradient)"
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: '#6366f1', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Course Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Performance by Course</h3>
          <p className="text-sm text-gray-500 mt-1">Your average scores across different courses</p>
        </div>

        <div className="divide-y divide-gray-100">
          {coursePerformance.map((course) => (
            <div key={course.courseId} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  
                  <div>
                    <p className="font-medium text-gray-900">{course.courseCode}</p>
                    <p className="text-sm text-gray-500">{course.courseName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{course.averageScore}%</p>
                    <p className="text-xs text-gray-500">{course.examCount} exams</p>
                  </div>

                  <div className="w-24">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          course.averageScore >= 70
                            ? 'bg-green-500'
                            : course.averageScore >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${course.averageScore}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{course.passingRate}% passing</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Exam Rankings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Recent Exam Results</h3>
          <p className="text-sm text-gray-500 mt-1">Click on an exam to see your ranking</p>
        </div>

        <div className="divide-y divide-gray-100">
          {scoreHistory.slice(0, 10).map((exam) => (
            <div
              key={exam.examId}
              className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => fetchExamRanking(exam.examId)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{exam.examTitle}</p>
                  <p className="text-sm text-gray-500">
                    {exam.courseCode} • {exam.examType.replace('_', ' ')} •{' '}
                    {new Date(exam.submittedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="text-right">
                  <p className={`text-xl font-bold ${exam.isPassing ? 'text-green-600' : 'text-red-600'}`}>
                    {exam.score}%
                  </p>
                  <p className={`text-xs ${exam.isPassing ? 'text-green-600' : 'text-red-600'}`}>
                    {exam.isPassing ? 'Passed' : 'Failed'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ranking Modal */}
      {(selectedExamRanking || rankingLoading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {rankingLoading ? 'Loading...' : selectedExamRanking?.examTitle}
                </h3>
                <button
                  onClick={() => setSelectedExamRanking(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>

            {rankingLoading ? (
              <div className="p-8 flex items-center justify-center text-gray-600">
                Loading...
              </div>
            ) : selectedExamRanking && (
              <div className="p-6">
                {/* Ranking Card */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm opacity-80">{selectedExamRanking.quartile}</span>
                  </div>

                  <div className="text-center">
                    <p className="text-sm opacity-80">Your Rank</p>
                    <p className="text-5xl font-bold mt-1">#{selectedExamRanking.studentRank}</p>
                    <p className="text-sm opacity-80 mt-1">
                      out of {selectedExamRanking.totalStudents} students
                    </p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/20 text-center">
                    <p className="text-3xl font-bold">{selectedExamRanking.percentileRank}th</p>
                    <p className="text-sm opacity-80">Percentile</p>
                  </div>
                </div>

                {/* Comparison */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500">Your Score</p>
                    <p
                      className={`text-2xl font-bold ${
                        selectedExamRanking.isPassing ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {selectedExamRanking.studentScore}%
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500">Class Average</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedExamRanking.classAverage}%</p>
                  </div>
                </div>

                {/* Deviation */}
                <div
                  className={`rounded-xl p-4 mb-6 ${
                    selectedExamRanking.aboveAverage ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div className="text-sm">
                    <span className={selectedExamRanking.aboveAverage ? 'text-green-700' : 'text-red-700'}>
                      <strong>{selectedExamRanking.aboveAverage ? 'Above Average' : 'Below Average'}:</strong>{' '}
                      You scored {Math.abs(selectedExamRanking.deviationFromAverage)}%{' '}
                      {selectedExamRanking.aboveAverage ? 'above' : 'below'} the class average
                    </span>
                  </div>
                </div>

                {/* Distribution */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Score Distribution</p>
                  <div className="space-y-2">
                    {selectedExamRanking.scoreDistribution.map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-20">{item.label}</span>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{
                              width: `${(item.count / selectedExamRanking.totalStudents) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentInsightsPage;