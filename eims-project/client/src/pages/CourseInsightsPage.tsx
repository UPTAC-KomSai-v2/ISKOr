import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  Target,
  Award,
  Loader2,
  ChevronRight,
  FileText,
} from 'lucide-react';
import {
  BarChart,
  Bar,
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
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ExamComparison {
  examId: string;
  examTitle: string;
  examType: string;
  submissionCount: number;
  averageScore: number;
  passingRate: number;
}

interface GradeDistribution {
  grade: string;
  count: number;
  percentage: number;
}

interface CourseInsights {
  courseId: string;
  courseName: string;
  courseCode: string;
  enrollmentCount: number;
  totalExams: number;
  totalSubmissions: number;
  coursePassingRate: number;
  averageCourseGrade: number;
  examComparison: ExamComparison[];
  gradeDistribution: GradeDistribution[];
}

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444'];
const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

const CourseInsightsPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<CourseInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInsights();
  }, [courseId]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/insights/course/${courseId}`);
      setInsights(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load course insights');
    } finally {
      setLoading(false);
    }
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const {
    courseName,
    courseCode,
    enrollmentCount,
    totalExams,
    totalSubmissions,
    coursePassingRate,
    averageCourseGrade,
    examComparison,
    gradeDistribution,
  } = insights;

  // Prepare radar chart data for exam comparison
  const radarData = examComparison.map((exam) => ({
    exam: exam.examTitle.length > 15 ? exam.examTitle.substring(0, 15) + '...' : exam.examTitle,
    score: exam.averageScore,
    passingRate: exam.passingRate,
    fullName: exam.examTitle,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Course
        </button>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/20">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{courseCode} - Course Insights</h1>
            <p className="text-gray-600">{courseName}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Enrolled Students</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{enrollmentCount}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Exams</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalExams}</p>
              <p className="text-xs text-gray-500 mt-1">{totalSubmissions} submissions</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Course Average</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{averageCourseGrade}%</p>
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
              <p className="text-2xl font-bold text-gray-900 mt-1">{coursePassingRate}%</p>
            </div>
            <div className={`p-3 rounded-lg ${coursePassingRate >= 70 ? 'bg-green-50' : 'bg-red-50'}`}>
              {coursePassingRate >= 70 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Grade Distribution Pie Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="60%" height={250}>
              <PieChart>
                <Pie
                  data={gradeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="grade"
                  label={({ grade, percentage }) => `${grade}: ${percentage}%`}
                >
                  {gradeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={GRADE_COLORS[entry.grade]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} students`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {gradeDistribution.map((item) => (
                <div key={item.grade} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: GRADE_COLORS[item.grade] }}
                    />
                    <span className="font-medium text-gray-700">Grade {item.grade}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{item.count}</span>
                    <span className="text-gray-500 text-sm ml-1">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Exam Comparison Bar Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Exam Difficulty Comparison</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={examComparison} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
              <YAxis
                dataKey="examTitle"
                type="category"
                width={120}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
              />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                formatter={(value: number, name: string) => [
                  `${value}%`,
                  name === 'averageScore' ? 'Average Score' : 'Passing Rate'
                ]}
              />
              <Legend />
              <Bar
                dataKey="averageScore"
                fill="#3b82f6"
                name="Average Score"
                radius={[0, 4, 4, 0]}
              />
              <Bar
                dataKey="passingRate"
                fill="#22c55e"
                name="Passing Rate"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Exam Details Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Exam Performance Details</h3>
          <p className="text-sm text-gray-500 mt-1">Click on an exam to view detailed insights</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Exam
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submissions
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Score
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Passing Rate
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Difficulty
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {examComparison.map((exam) => {
                const difficulty =
                  exam.averageScore >= 70 ? 'Easy' :
                  exam.averageScore >= 50 ? 'Moderate' : 'Difficult';
                const difficultyColor =
                  difficulty === 'Easy' ? 'text-green-600 bg-green-50' :
                  difficulty === 'Moderate' ? 'text-amber-600 bg-amber-50' :
                  'text-red-600 bg-red-50';

                return (
                  <tr
                    key={exam.examId}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/exams/${exam.examId}/insights`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          {exam.examTitle.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{exam.examTitle}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                        {exam.examType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-900">
                      {exam.submissionCount}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-semibold ${
                        exam.averageScore >= 70 ? 'text-green-600' :
                        exam.averageScore >= 50 ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {exam.averageScore}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              exam.passingRate >= 70 ? 'bg-green-500' :
                              exam.passingRate >= 50 ? 'bg-amber-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${exam.passingRate}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-700">{exam.passingRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${difficultyColor}`}>
                        {difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 hover:text-blue-700 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {examComparison.length === 0 && (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No exams in this course yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseInsightsPage;
