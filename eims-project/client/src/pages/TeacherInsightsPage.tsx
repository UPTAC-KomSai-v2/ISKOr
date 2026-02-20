import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
} from 'recharts';

interface ExamMetrics {
  averageScore: number;
  averagePercentage: number;
  passingRate: number;
  passingCount: number;
  failingCount: number;
  averageTimeTaken: number;
  minTimeTaken: number;
  maxTimeTaken: number;
  scoreRange: { min: number; max: number };
  standardDeviation: number;
  totalPoints: number;
}

interface Distribution {
  range: string;
  count: number;
  percentage: number;
}

interface Percentiles {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

interface ItemAnalysis {
  questionId: string;
  questionNumber: number;
  questionText: string;
  questionType: string;
  points: number;
  responseCount: number;
  correctCount: number;
  difficultyIndex: number;
  difficultyLabel: string;
  discriminationIndex: number;
  discriminationLabel: string;
  skipRate: number;
  flag: string;
}

interface ExamInsights {
  examId: string;
  examTitle: string;
  totalSubmissions: number;
  metrics: ExamMetrics | null;
  distribution: Distribution[];
  percentiles: Percentiles;
  itemAnalysis: ItemAnalysis[];
}

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444'];
const PASSFAIL_COLORS = ['#22c55e', '#ef4444'];

const TeacherInsightsPage = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<ExamInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchInsights();
  }, [examId]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/insights/exam/${examId}`);
      setInsights(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  const toggleItemExpand = (questionId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const getFlagBadge = (flag: string) => {
    switch (flag) {
      case 'TOO_HARD':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Too Difficult</span>;
      case 'TOO_EASY':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Too Easy</span>;
      case 'NEGATIVE_DISCRIMINATION':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Review Required</span>;
      case 'POOR_DISCRIMINATION':
        return <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">Poor Discrimination</span>;
      case 'NO_RESPONSES':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">No Responses</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Good</span>;
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

  if (!insights || insights.totalSubmissions === 0) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <BarChart3 className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-blue-900">No Submissions Yet</h3>
          <p className="text-blue-700 mt-1">
            Insights will be available once students start submitting this exam.
          </p>
        </div>
      </div>
    );
  }

  const { metrics, distribution, percentiles, itemAnalysis } = insights;

  const passFailData = [
    { name: 'Passing', value: metrics?.passingCount || 0 },
    { name: 'Failing', value: metrics?.failingCount || 0 },
  ];

  const percentileData = [
    { name: '25th', value: percentiles?.p25 || 0 },
    { name: '50th (Median)', value: percentiles?.p50 || 0 },
    { name: '75th', value: percentiles?.p75 || 0 },
    { name: '90th', value: percentiles?.p90 || 0 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Exam
        </button>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Exam Insights</h1>
            <p className="text-gray-600">{insights.examTitle}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Submissions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{insights.totalSubmissions}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Average Score</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics?.averagePercentage}%</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Target className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Passing Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics?.passingRate}%</p>
            </div>
            <div className={`p-3 rounded-lg ${(metrics?.passingRate || 0) >= 70 ? 'bg-green-50' : 'bg-red-50'}`}>
              {(metrics?.passingRate || 0) >= 70 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Avg. Time Taken</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics?.averageTimeTaken} min</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Std. Deviation</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics?.standardDeviation}</p>
            </div>
            <div className="p-3 bg-cyan-50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-cyan-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Score Distribution */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                formatter={(value: number) => [`${value} students`, 'Count']}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pass/Fail Pie */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pass/Fail Ratio</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={passFailData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {passFailData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PASSFAIL_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-600">Passing ({metrics?.passingCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-gray-600">Failing ({metrics?.failingCount})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Percentiles */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Percentiles</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
            <p className="text-sm text-blue-600 font-medium">25th Percentile</p>
            <p className="text-3xl font-bold text-blue-900 mt-1">{percentiles?.p25}%</p>
            <p className="text-xs text-blue-600 mt-1">Lower Quartile</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
            <p className="text-sm text-green-600 font-medium">50th Percentile</p>
            <p className="text-3xl font-bold text-green-900 mt-1">{percentiles?.p50}%</p>
            <p className="text-xs text-green-600 mt-1">Median</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
            <p className="text-sm text-purple-600 font-medium">75th Percentile</p>
            <p className="text-3xl font-bold text-purple-900 mt-1">{percentiles?.p75}%</p>
            <p className="text-xs text-purple-600 mt-1">Upper Quartile</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl">
            <p className="text-sm text-amber-600 font-medium">90th Percentile</p>
            <p className="text-3xl font-bold text-amber-900 mt-1">{percentiles?.p90}%</p>
            <p className="text-xs text-amber-600 mt-1">Top 10%</p>
          </div>
        </div>
      </div>

      {/* Item Analysis */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Item Analysis</h3>
              <p className="text-sm text-gray-500 mt-1">
                Psychometric analysis of each question
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Info className="w-4 h-4" />
              <span>Ideal difficulty: 0.3-0.7 | Good discrimination: &gt;0.3</span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {itemAnalysis.map((item) => (
            <div key={item.questionId} className="hover:bg-gray-50 transition-colors">
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleItemExpand(item.questionId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-semibold text-gray-700">
                      Q{item.questionNumber}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 line-clamp-1">{item.questionText}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{item.questionType.replace('_', ' ')}</span>
                        <span className="text-xs text-gray-300">•</span>
                        <span className="text-xs text-gray-500">{item.points} pts</span>
                        <span className="text-xs text-gray-300">•</span>
                        <span className="text-xs text-gray-500">{item.responseCount} responses</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getFlagBadge(item.flag)}
                    {expandedItems.has(item.questionId) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {expandedItems.has(item.questionId) && (
                <div className="px-4 pb-4 bg-gray-50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white rounded-lg border border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Difficulty Index</p>
                      <p className="text-xl font-bold text-gray-900 mt-1">{item.difficultyIndex}</p>
                      <p className={`text-sm mt-1 ${
                        item.difficultyIndex >= 0.3 && item.difficultyIndex <= 0.7
                          ? 'text-green-600'
                          : 'text-amber-600'
                      }`}>
                        {item.difficultyLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Discrimination Index</p>
                      <p className="text-xl font-bold text-gray-900 mt-1">{item.discriminationIndex}</p>
                      <p className={`text-sm mt-1 ${
                        item.discriminationIndex >= 0.3
                          ? 'text-green-600'
                          : item.discriminationIndex >= 0.2
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}>
                        {item.discriminationLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Correct Rate</p>
                      <p className="text-xl font-bold text-gray-900 mt-1">
                        {item.responseCount > 0
                          ? Math.round((item.correctCount / item.responseCount) * 100)
                          : 0}%
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {item.correctCount} of {item.responseCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Skip Rate</p>
                      <p className="text-xl font-bold text-gray-900 mt-1">{item.skipRate}%</p>
                      <p className={`text-sm mt-1 ${
                        item.skipRate > 20 ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {item.skipRate > 20 ? 'High skip rate' : 'Normal'}
                      </p>
                    </div>
                  </div>

                  {/* Interpretation Guide */}
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Interpretation:</strong>{' '}
                      {item.flag === 'OK'
                        ? 'This question is performing well with good difficulty and discrimination.'
                        : item.flag === 'TOO_HARD'
                        ? 'Consider simplifying this question or providing more scaffolding.'
                        : item.flag === 'TOO_EASY'
                        ? 'Consider making this question more challenging.'
                        : item.flag === 'NEGATIVE_DISCRIMINATION'
                        ? 'Low performers are doing better than high performers - review for ambiguity.'
                        : item.flag === 'POOR_DISCRIMINATION'
                        ? 'This question doesn\'t effectively distinguish between high and low performers.'
                        : 'No responses yet - insights will appear after students submit.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeacherInsightsPage;
