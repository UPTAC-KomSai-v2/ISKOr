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
  Trophy,
  Clock,
  Eye,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface HighestScorer {
  name: string;
  studentNumber?: string;
  score: number;
}

interface ExamComparison {
  examId: string;
  examTitle: string;
  examType: string;
  submissionCount: number;
  averageScore: number;
  passingRate: number;
  highestScore: number;
  lowestScore: number;
  highestScorer: HighestScorer | null;
}

interface GradeDistribution {
  grade: string;
  count: number;
  percentage: number;
  remark?: string;
}

interface TopPerformer {
  studentId: string;
  name: string;
  studentNumber?: string;
  examsTaken: number;
  averageScore: number;
  highestScore: number;
}

interface RecentActivity {
  submissionId: string;
  studentName: string;
  examTitle: string;
  score: number;
  isPassing: boolean;
  submittedAt: string;
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
  topPerformers: TopPerformer[];
  recentActivity: RecentActivity[];
}

const GRADE_COLORS: Record<string, string> = {
  '1.0':  '#065f46',  // dark green - Excellent
  '1.25': '#059669',  // green - Excellent
  '1.5':  '#10b981',  // emerald - Very Good
  '1.75': '#34d399',  // light emerald - Very Good
  '2.0':  '#3b82f6',  // blue - Good
  '2.25': '#60a5fa',  // light blue - Good
  '2.5':  '#f59e0b',  // amber - Satisfactory
  '2.75': '#fbbf24',  // yellow - Satisfactory
  '3.0':  '#f97316',  // orange - Passed
  '4.0':  '#ef4444',  // red - Conditional Failure
  '5.0':  '#991b1b',  // dark red - Failed
};

const CourseInsightsPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<CourseInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'exams' | 'students'>('overview');

  useEffect(() => {
    fetchInsights();
  }, [courseId]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/insights/course/${courseId}`);
      setInsights(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.error || 'Failed to load course insights');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
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
    topPerformers,
    recentActivity,
  } = insights;

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

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['overview', 'exams', 'students'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
              activeTab === tab
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Distribution Pie Chart */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h3>
              {gradeDistribution.some(g => g.count > 0) ? (
                <div className="flex items-center">
                  <ResponsiveContainer width="60%" height={250}>
                    <PieChart>
                      <Pie
                          data={gradeDistribution.filter(g => g.count > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="count"
                          nameKey="grade"
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, grade, percentage }) => {
                            if (percentage < 8) return null; // skip small slices
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) / 2;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            return (
                              <text
                                x={x}
                                y={y}
                                fill="#fff"
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={10}
                                fontWeight={600}
                              >
                                {grade}
                              </text>
                            );
                          }}
                          labelLine={false}
                      >
                        {gradeDistribution.filter(g => g.count > 0).map((entry, index) => (
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
                          <span className="font-medium text-gray-700">{item.grade}</span>
                          {item.remark && (
                            <span className="text-xs text-gray-400">({item.remark})</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-gray-900">{item.count}</span>
                          <span className="text-gray-500 text-sm ml-1">({item.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-500">
                  No grade data available
                </div>
              )}
            </div>

            {/* Top Performers */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Top Performers
              </h3>
              {topPerformers.length > 0 ? (
                <div className="space-y-3">
                  {topPerformers.slice(0, 5).map((student, index) => (
                    <div key={student.studentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-200 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.examsTaken} exams taken</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{student.averageScore}%</p>
                        <p className="text-xs text-gray-500">avg</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-gray-500">
                  No performance data available
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Recent Submissions
            </h3>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.submissionId} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{activity.studentName}</p>
                      <p className="text-sm text-gray-500">{activity.examTitle}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-semibold ${activity.isPassing ? 'text-green-600' : 'text-red-600'}`}>
                        {activity.score}%
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(activity.submittedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No recent activity
              </div>
            )}
          </div>
        </div>
      )}

      {/* Exams Tab */}
      {activeTab === 'exams' && (
        <div className="space-y-6">
          {/* Exam Comparison Chart */}
          {examComparison.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Exam Performance Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={examComparison} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis
                    dataKey="examTitle"
                    type="category"
                    width={150}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.length > 20 ? value.substring(0, 20) + '...' : value}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    formatter={(value: number, name: string) => [
                      `${value}%`,
                      name === 'averageScore' ? 'Average Score' : 'Passing Rate'
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="averageScore" fill="#3b82f6" name="Average Score" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="passingRate" fill="#22c55e" name="Passing Rate" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Exam Cards with Highest Scorer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examComparison.map((exam) => (
              <div
                key={exam.examId}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/exams/${exam.examId}/insights`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                      {exam.examType.replace('_', ' ')}
                    </span>
                    <h4 className="font-semibold text-gray-900 mt-2">{exam.examTitle}</h4>
                    <p className="text-sm text-gray-500">{exam.submissionCount} submissions</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{exam.averageScore}%</p>
                    <p className="text-xs text-gray-500">Average</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{exam.highestScore}%</p>
                    <p className="text-xs text-gray-500">Highest</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{exam.lowestScore}%</p>
                    <p className="text-xs text-gray-500">Lowest</p>
                  </div>
                </div>

                {/* Highest Scorer Highlight */}
                {exam.highestScorer && (
                  <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-medium text-yellow-800">Top Scorer</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-semibold text-gray-900">{exam.highestScorer.name}</span>
                      <span className="font-bold text-green-600">{exam.highestScorer.score}%</span>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <span className={`text-sm font-medium ${exam.passingRate >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                    {exam.passingRate}% passing rate
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/exams/${exam.examId}/item-analysis`);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <BarChart3 className="w-3 h-3" />
                    Item Analysis
                  </button>
                </div>
              </div>
            ))}
          </div>

          {examComparison.length === 0 && (
            <div className="bg-white rounded-xl p-8 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No exams with submissions in this course yet</p>
            </div>
          )}
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Student Rankings</h3>
            <p className="text-sm text-gray-500 mt-1">Top {topPerformers.length} students by average score</p>
          </div>
          
          {topPerformers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Exams Taken</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Average</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Highest</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topPerformers.map((student, index) => (
                    <tr key={student.studentId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-200 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{student.name}</p>
                        {student.studentNumber && (
                          <p className="text-xs text-gray-500">{student.studentNumber}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-900">{student.examsTaken}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-semibold ${
                          student.averageScore >= 90 ? 'text-green-600' :
                          student.averageScore >= 75 ? 'text-blue-600' :
                          student.averageScore >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {student.averageScore}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-green-600 font-medium">
                        {student.highestScore}%
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => navigate(`/insights/student/${student.studentId}`)}
                          className="text-blue-600 hover:text-blue-700"
                          title="View student insights"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No student performance data available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseInsightsPage;