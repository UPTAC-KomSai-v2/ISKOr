import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
import { Role } from '@/types';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  Loader2,
  FileText,
  Trophy,
  BarChart3,
  CheckCircle,
  XCircle,
  Calendar,
  Percent,
  BookOpen,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

interface StudentData {
  _id: string;
  firstName: string;
  lastName: string;
  studentNumber?: string;
  email: string;
  section?: string;
  program?: string;
  yearLevel?: number;
}

interface Statistics {
  totalExams: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  medianScore: number;
  passingRate: number;
  percentileRank: number;
  comparedToClass: number;
}

interface TypePerformance {
  type: string;
  accuracy: number;
  totalQuestions: number;
  correctAnswers: number;
}

interface Submission {
  _id: string;
  exam: {
    _id: string;
    title: string;
    type: string;
  };
  score: number;
  maxScore: number;
  percentage: number;
  isPassing: boolean;
  submittedAt: string;
  gradedAt?: string;
}

interface PerformanceData {
  student: StudentData;
  statistics: Statistics;
  typePerformance: TypePerformance[];
  submissions: Submission[];
  recentExams: any[];
  message?: string;
}

const TYPE_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  TRUE_FALSE: 'True/False',
  SHORT_ANSWER: 'Short Answer',
  ESSAY: 'Essay',
  FILL_IN_THE_BLANK: 'Fill in Blank',
  MATCHING: 'Matching',
  CODING: 'Coding',
};

const EXAM_TYPE_COLORS: Record<string, string> = {
  QUIZ: '#3b82f6',
  MIDTERM: '#8b5cf6',
  FINAL: '#ef4444',
  ASSIGNMENT: '#22c55e',
  PRACTICE: '#f59e0b',
};

const StudentInsightsPage = () => {
  const navigate = useNavigate();
  // ── studentId is present when a faculty/admin navigates to /insights/student/:studentId
  const { studentId } = useParams<{ studentId?: string }>();
  const { user } = useAuthStore();

  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // True when a faculty/admin is viewing someone else's page
  const isFacultyViewing =
    (user?.role === Role.FACULTY || user?.role === Role.ADMIN) && !!studentId;

  useEffect(() => {
    fetchPerformance();
  }, [studentId]);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      setError('');

      let res;
      if (isFacultyViewing) {
        // Faculty/Admin → call the dedicated endpoint that accepts a student ID
        res = await api.get(`/insights/student/${studentId}`);
      } else {
        // Student → fetch their own performance
        res = await api.get('/insights/my-performance');
      }

      setData(res.data.data);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.error ||
          'Failed to load performance data'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-800">Student Not Found</h3>
          <p className="text-red-600 mt-1">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { student, statistics, typePerformance, submissions } = data;

  // ── Chart data ──────────────────────────────────────────────
  const scoreHistory = [...submissions].reverse().map((sub, index) => ({
    exam:
      sub.exam.title.length > 12
        ? sub.exam.title.substring(0, 12) + '...'
        : sub.exam.title,
    score: sub.percentage,
    passing: sub.isPassing ? 100 : 0,
    index: index + 1,
  }));

  const radarData = typePerformance.map((tp) => ({
    type: TYPE_LABELS[tp.type] || tp.type,
    accuracy: tp.accuracy,
    fullMark: 100,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
            {student.firstName.charAt(0)}
            {student.lastName.charAt(0)}
          </div>
          <div>
            {/* ── Title changes based on who is viewing ── */}
            <h1 className="text-2xl font-bold text-gray-900">
              {isFacultyViewing
                ? `${student.firstName} ${student.lastName}'s Performance`
                : 'My Performance'}
            </h1>
            <p className="text-gray-600">
              {student.firstName} {student.lastName}
            </p>
            {student.studentNumber && (
              <p className="text-sm text-gray-500">{student.studentNumber}</p>
            )}
            {isFacultyViewing && student.section && (
              <p className="text-sm text-gray-400">
                Section {student.section}
                {student.program ? ` · ${student.program}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* No Data State */}
      {statistics.totalExams === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No Exam Results Yet</h3>
          <p className="text-gray-500 mt-2">
            {isFacultyViewing
              ? 'This student has not completed any graded exams yet.'
              : 'Your performance data will appear here once you complete and have exams graded.'}
          </p>
        </div>
      ) : (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Exams Taken</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {statistics.totalExams}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Average Score</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {statistics.averageScore}%
                  </p>
                  <p
                    className={`text-xs mt-1 flex items-center gap-1 ${
                      statistics.comparedToClass >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {statistics.comparedToClass >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {statistics.comparedToClass >= 0 ? '+' : ''}
                    {statistics.comparedToClass}% vs class
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <Target className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Passing Rate</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {statistics.passingRate}%
                  </p>
                </div>
                <div
                  className={`p-3 rounded-lg ${
                    statistics.passingRate >= 70 ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  {statistics.passingRate >= 70 ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Percentile Rank</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {statistics.percentileRank}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Top {100 - statistics.percentileRank}%
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Trophy className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Score Range */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-8">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Score Range</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-600 font-medium">
                    Lowest: {statistics.lowestScore}%
                  </span>
                  <span className="text-gray-500">
                    Median: {statistics.medianScore}%
                  </span>
                  <span className="text-green-600 font-medium">
                    Highest: {statistics.highestScore}%
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                  <div
                    className="absolute h-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-400"
                    style={{
                      left: `${statistics.lowestScore}%`,
                      width: `${statistics.highestScore - statistics.lowestScore}%`,
                    }}
                  />
                  <div
                    className="absolute h-full w-1 bg-blue-600"
                    style={{ left: `${statistics.averageScore}%` }}
                    title={`Average: ${statistics.averageScore}%`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Score History */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                Score History
              </h3>
              {scoreHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={scoreHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="exam"
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                      formatter={(value: number) => [`${value}%`, 'Score']}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-500">
                  No score history available
                </div>
              )}
            </div>

            {/* Performance by Question Type */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-500" />
                Performance by Question Type
              </h3>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="type" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                    />
                    <Radar
                      name="Accuracy"
                      dataKey="accuracy"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.3}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Accuracy']}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-500">
                  No question type data available
                </div>
              )}
            </div>
          </div>

          {/* Type Performance Details */}
          {typePerformance.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Question Type Breakdown
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {typePerformance.map((tp) => (
                  <div key={tp.type} className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 font-medium">
                      {TYPE_LABELS[tp.type] || tp.type}
                    </p>
                    <div className="flex items-end justify-between mt-2">
                      <p
                        className={`text-2xl font-bold ${
                          tp.accuracy >= 80
                            ? 'text-green-600'
                            : tp.accuracy >= 60
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {tp.accuracy}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {tp.correctAnswers}/{tp.totalQuestions}
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          tp.accuracy >= 80
                            ? 'bg-green-500'
                            : tp.accuracy >= 60
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${tp.accuracy}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exam History Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                Exam History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Exam
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Score
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions.map((sub) => (
                    <tr key={sub._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            {sub.exam.title.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">
                            {sub.exam.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className="px-2 py-1 text-xs font-medium rounded-full"
                          style={{
                            backgroundColor: `${
                              EXAM_TYPE_COLORS[sub.exam.type] || '#6b7280'
                            }20`,
                            color: EXAM_TYPE_COLORS[sub.exam.type] || '#6b7280',
                          }}
                        >
                          {sub.exam.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`font-semibold ${
                            sub.percentage >= 90
                              ? 'text-green-600'
                              : sub.percentage >= 75
                              ? 'text-blue-600'
                              : sub.percentage >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {sub.percentage}%
                        </span>
                        <span className="text-gray-400 text-sm ml-1">
                          ({sub.score}/{sub.maxScore})
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {sub.isPassing ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-full">
                            <XCircle className="w-3 h-3" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-500">
                        {formatDate(sub.submittedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StudentInsightsPage;