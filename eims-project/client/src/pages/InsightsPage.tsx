import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
import { Role } from '@/types';
import {
  BarChart3, TrendingUp, Users, Award, Target, Brain,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle,
  XCircle, HelpCircle, BookOpen, Filter, Download,
  ArrowLeft, Eye, RefreshCw, Info
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

interface HighestScorer {
  examId: string;
  examTitle: string;
  examType: string;
  highestScore: number;
  totalPoints: number;
  maxPoints: number;
  student: {
    id: string;
    name: string;
    studentNumber: string;
    section?: string;
  };
  submittedAt: string;
  examStats: {
    totalSubmissions: number;
    averageScore: number;
    passingCount: number;
  };
}

interface CategoryPerformance {
  category: string;
  count: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passingRate: number;
  topPerformer: {
    name: string;
    score: number;
    examTitle: string;
  };
}

interface ClassRanking {
  rank: number;
  studentId: string;
  name: string;
  studentNumber: string;
  section?: string;
  examsTaken: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}

interface Trend {
  month: string;
  averageScore: number;
  submissionCount: number;
  passingRate: number;
}

const InsightsPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseIdParam = searchParams.get('courseId');

  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<any>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>(courseIdParam || '');
  const [courses, setCourses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'rankings' | 'trends'>('overview');

  useEffect(() => {
    fetchCourses();
    fetchInsights();
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses');
      setCourses(response.data.data?.courses || response.data || []);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    }
  };

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const params = selectedCourse ? `?courseId=${selectedCourse}` : '';
      const response = await api.get(`/insights/comprehensive${params}`);
      setInsights(response.data.data);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-100 border-green-200';
    if (score >= 75) return 'bg-blue-100 border-blue-200';
    if (score >= 60) return 'bg-yellow-100 border-yellow-200';
    return 'bg-red-100 border-red-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
      </div>
    );
  }

  const stats = insights?.statistics;
  const highestScorers = insights?.highestScorers || [];
  const performanceByCategory = insights?.performanceByCategory || [];
  const trends = insights?.trends || [];
  const classRankings = insights?.classRankings || [];
  const studentInsights = insights?.studentInsights;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              Insights Dashboard
            </h1>
            <p className="text-gray-500">Comprehensive analytics and performance metrics</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="input w-48"
          >
            <option value="">All Courses</option>
            {courses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.code} - {course.name}
              </option>
            ))}
          </select>
          <button onClick={fetchInsights} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total Submissions</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalSubmissions}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Average Score</p>
            <p className={`text-2xl font-bold ${getScoreColor(stats.averageScore)}`}>
              {stats.averageScore}%
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Highest Score</p>
            <p className="text-2xl font-bold text-green-600">{stats.highestScore}%</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Lowest Score</p>
            <p className="text-2xl font-bold text-red-600">{stats.lowestScore}%</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Passing Rate</p>
            <p className={`text-2xl font-bold ${stats.passingRate >= 60 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.passingRate}%
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Std. Deviation</p>
            <p className="text-2xl font-bold text-purple-600">{stats.standardDeviation}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['overview', 'rankings', 'trends'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
              activeTab === tab
                ? 'border-rose-600 text-rose-600'
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
          {/* Highest Scorers by Exam */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              <h2 className="font-semibold text-gray-900">Highest Scorers by Exam</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {highestScorers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No exam submissions yet
                </div>
              ) : (
                highestScorers.map((scorer: HighestScorer) => (
                  <div key={scorer.examId} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            scorer.examType === 'QUIZ' ? 'bg-blue-100 text-blue-700' :
                            scorer.examType === 'MIDTERM' ? 'bg-purple-100 text-purple-700' :
                            scorer.examType === 'FINAL' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {scorer.examType}
                          </div>
                          <h3 className="font-medium text-gray-900">{scorer.examTitle}</h3>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {scorer.examStats.totalSubmissions} submissions
                          </span>
                          <span>Avg: {scorer.examStats.averageScore}%</span>
                          <span className="text-green-600">
                            {scorer.examStats.passingCount} passed
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-yellow-500" />
                            <span className="font-semibold text-gray-900">{scorer.student.name}</span>
                          </div>
                          {scorer.student.studentNumber && (
                            <p className="text-xs text-gray-500">{scorer.student.studentNumber}</p>
                          )}
                        </div>
                        <div className={`px-4 py-2 rounded-lg text-center min-w-[80px] ${getScoreBg(scorer.highestScore)}`}>
                          <p className={`text-xl font-bold ${getScoreColor(scorer.highestScore)}`}>
                            {scorer.highestScore}%
                          </p>
                          <p className="text-xs text-gray-500">
                            {scorer.totalPoints}/{scorer.maxPoints} pts
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Performance by Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                <h2 className="font-semibold text-gray-900">Performance by Exam Type</h2>
              </div>
              {performanceByCategory.length > 0 ? (
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={performanceByCategory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="averageScore" name="Average %" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="passingRate" name="Passing Rate %" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">No data available</div>
              )}
            </div>

            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-500" />
                <h2 className="font-semibold text-gray-900">Top Performers by Category</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {performanceByCategory.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No data available</div>
                ) : (
                  performanceByCategory.map((cat: CategoryPerformance) => (
                    <div key={cat.category} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            cat.category === 'QUIZ' ? 'bg-blue-100 text-blue-700' :
                            cat.category === 'MIDTERM' ? 'bg-purple-100 text-purple-700' :
                            cat.category === 'FINAL' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {cat.category}
                          </span>
                          <p className="mt-1 text-sm text-gray-500">
                            {cat.count} exams • Avg: {cat.averageScore}%
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-yellow-500" />
                            <span className="font-medium text-gray-900">{cat.topPerformer.name}</span>
                          </div>
                          <p className="text-sm text-green-600 font-semibold">
                            {cat.topPerformer.score}% on {cat.topPerformer.examTitle}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rankings Tab */}
      {activeTab === 'rankings' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <h2 className="font-semibold text-gray-900">Class Rankings</h2>
            </div>
            <span className="text-sm text-gray-500">
              Showing top {Math.min(50, classRankings.length)} students
            </span>
          </div>
          
          {classRankings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No rankings available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Exams</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Average</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Highest</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Lowest</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {classRankings.map((student: ClassRanking) => (
                    <tr key={student.studentId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          student.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                          student.rank === 2 ? 'bg-gray-100 text-gray-700' :
                          student.rank === 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {student.rank}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{student.name}</p>
                        <p className="text-xs text-gray-500">{student.studentNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{student.section || '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-900">{student.examsTaken}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${getScoreColor(student.averageScore)}`}>
                          {student.averageScore}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">
                        {student.highestScore}%
                      </td>
                      <td className="px-4 py-3 text-center text-red-600 font-medium">
                        {student.lowestScore}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => navigate(`/insights/student/${student.studentId}`)}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <h2 className="font-semibold text-gray-900">Performance Trends Over Time</h2>
            </div>
            {trends.length > 0 ? (
              <div className="p-4">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="averageScore" 
                      name="Average Score %" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="passingRate" 
                      name="Passing Rate %" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      dot={{ fill: '#10B981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                Not enough data for trend analysis
              </div>
            )}
          </div>

          {/* Submission Volume */}
          {trends.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-500" />
                <h2 className="font-semibold text-gray-900">Submission Volume</h2>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="submissionCount" name="Submissions" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Student Insights (for students only) */}
      {user?.role === Role.STUDENT && studentInsights && (
        <div className="bg-gradient-to-r from-rose-50 to-purple-50 rounded-xl border border-rose-200 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-rose-600" />
            Your Personal Insights
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-gray-900">{studentInsights.totalExamsTaken}</p>
              <p className="text-sm text-gray-500">Exams Taken</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <p className={`text-3xl font-bold ${getScoreColor(studentInsights.averageScore)}`}>
                {studentInsights.averageScore}%
              </p>
              <p className="text-sm text-gray-500">Average Score</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-600">{studentInsights.percentileRank}th</p>
              <p className="text-sm text-gray-500">Percentile</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <p className={`text-3xl font-bold ${studentInsights.passingRate >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                {studentInsights.passingRate}%
              </p>
              <p className="text-sm text-gray-500">Passing Rate</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studentInsights.strengthAreas?.length > 0 && (
              <div className="bg-white rounded-lg p-4">
                <h3 className="font-medium text-green-700 flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  Strength Areas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {studentInsights.strengthAreas.map((area: string) => (
                    <span key={area} className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {studentInsights.improvementAreas?.length > 0 && (
              <div className="bg-white rounded-lg p-4">
                <h3 className="font-medium text-orange-700 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Areas for Improvement
                </h3>
                <div className="flex flex-wrap gap-2">
                  {studentInsights.improvementAreas.map((area: string) => (
                    <span key={area} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightsPage;
