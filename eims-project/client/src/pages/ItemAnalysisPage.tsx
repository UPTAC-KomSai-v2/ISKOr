import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import {
  ArrowLeft, BarChart3, TrendingUp, AlertTriangle, CheckCircle,
  XCircle, HelpCircle, Info, ChevronDown, ChevronRight, Download,
  RefreshCw, BookOpen, Target, Award, Lightbulb, FileText
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter,
  ZAxis
} from 'recharts';

interface ItemStatistics {
  difficultyIndex: number;
  upper27Difficulty: number;
  lower27Difficulty: number;
  discriminationIndex: number;
  pointBiserial: number;
  correctCount: number;
  totalResponses: number;
}

interface DistractorAnalysis {
  choiceIndex: number;
  text: string;
  isCorrect: boolean;
  selectedCount: number;
  proportion: number;
  upper27Rate: number;
  lower27Rate: number;
  discrimination: number;
  pointBiserial: number;
}

interface ItemAnalysis {
  questionId: string;
  questionNumber: number;
  questionText: string;
  type: string;
  points: number;
  isEssay?: boolean;
  message?: string;
  statistics?: ItemStatistics;
  interpretation?: {
    difficulty: string;
    discrimination: string;
    discriminationQuality: string;
    pointBiserial: string;
    pbQuality: string;
  };
  distractorAnalysis?: DistractorAnalysis[];
  recommendations?: string[];
  qualityScore?: number;
}

interface InterpretationRange {
  range: string;
  meaning: string;
}

interface InterpretationGuide {
  description: string;
  ideal: string;
  ranges: InterpretationRange[];
}

const ItemAnalysisPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showGuide, setShowGuide] = useState(false);
  const [filterQuality, setFilterQuality] = useState<string>('all');

  useEffect(() => {
    fetchItemAnalysis();
  }, [examId]);

  const fetchItemAnalysis = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/insights/exam/${examId}/item-analysis`);
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch item analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const getQualityColor = (quality: string | undefined) => {
    switch (quality) {
      case 'good': return 'text-green-600 bg-green-100';
      case 'fair': return 'text-yellow-600 bg-yellow-100';
      case 'poor': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getQualityIcon = (quality: string | undefined) => {
    switch (quality) {
      case 'good': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'fair': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'poor': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <HelpCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getQualityScoreColor = (score: number | undefined) => {
    if (!score) return 'bg-gray-200';
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const COLORS = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6'];

  const filteredItems = data?.items?.filter((item: ItemAnalysis) => {
    if (filterQuality === 'all') return true;
    if (item.isEssay) return filterQuality === 'essay';
    return item.interpretation?.discriminationQuality === filterQuality;
  }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.message) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Item Analysis</h1>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Insufficient Data</h2>
          <p className="text-yellow-700">{data?.message || 'Not enough submissions for item analysis.'}</p>
          <p className="text-sm text-yellow-600 mt-2">
            Current submissions: {data?.submissionCount || 0} / Minimum required: 5
          </p>
        </div>
      </div>
    );
  }

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
              <BarChart3 className="w-7 h-7 text-rose-600" />
              Item Analysis
            </h1>
            <p className="text-gray-500">{data.exam.title}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Interpretation Guide
          </button>
          <button onClick={fetchItemAnalysis} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Methodology Attribution */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
        <div>
          <h3 className="font-medium text-blue-900">Research-Based Methodology</h3>
          <p className="text-sm text-blue-700 mt-1">
            This analysis uses Classical Test Theory (CTT) methodology based on the{' '}
            <span className="font-medium">ExamSoft White Paper: "Exam Quality Through the Use of Psychometric Analysis"</span>
            {' '}by Ohio State University College of Medicine.
          </p>
        </div>
      </div>

      {/* Interpretation Guide Modal */}
      {showGuide && data.interpretationGuide && (
        <div className="bg-white rounded-xl border shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Interpretation Guide
            </h2>
            <button onClick={() => setShowGuide(false)} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(data.interpretationGuide).map(([key, guide]: [string, any]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-1 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </h3>
                <p className="text-sm text-gray-600 mb-2">{guide.description}</p>
                <p className="text-sm text-green-700 font-medium mb-3">Ideal: {guide.ideal}</p>
                <div className="space-y-1">
                  {guide.ranges.map((range: InterpretationRange, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="font-mono text-gray-700">{range.range}</span>
                      <span className="text-gray-600">{range.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exam-Level Statistics */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          <h2 className="font-semibold text-gray-900">Exam Statistics</h2>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{data.submissionCount}</p>
            <p className="text-xs text-gray-500">Submissions</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{data.examStatistics.meanScore}%</p>
            <p className="text-xs text-gray-500">Mean Score</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{data.examStatistics.standardDeviation}</p>
            <p className="text-xs text-gray-500">Std. Deviation</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className={`text-2xl font-bold ${data.examStatistics.kr20 >= 0.7 ? 'text-green-600' : 'text-yellow-600'}`}>
              {data.examStatistics.kr20}
            </p>
            <p className="text-xs text-gray-500">KR-20 Reliability</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{data.examStatistics.upper27Threshold}%</p>
            <p className="text-xs text-gray-500">Upper 27% Threshold</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{data.examStatistics.lower27Threshold}%</p>
            <p className="text-xs text-gray-500">Lower 27% Threshold</p>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className={`rounded-lg p-3 ${
            data.examStatistics.kr20 >= 0.7 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <p className={`text-sm ${data.examStatistics.kr20 >= 0.7 ? 'text-green-700' : 'text-yellow-700'}`}>
              <span className="font-medium">Reliability Assessment:</span> {data.examStatistics.reliabilityInterpretation}
            </p>
          </div>
        </div>
      </div>

      {/* Item Quality Summary */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-500" />
          <h2 className="font-semibold text-gray-900">Item Quality Summary</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{data.summary.goodItems}</p>
              <p className="text-xs text-gray-500">Good Items</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{data.summary.fairItems}</p>
              <p className="text-xs text-gray-500">Fair Items</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{data.summary.poorItems}</p>
              <p className="text-xs text-gray-500">Poor Items</p>
            </div>
            <div className="text-center p-3 bg-gray-100 rounded-lg">
              <p className="text-2xl font-bold text-gray-600">{data.summary.essayItems}</p>
              <p className="text-xs text-gray-500">Essay Items</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{data.summary.averageDiscrimination}</p>
              <p className="text-xs text-gray-500">Avg. Discrimination</p>
            </div>
          </div>
          
          {/* Visual Summary Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Good', value: data.summary.goodItems, color: '#10B981' },
                    { name: 'Fair', value: data.summary.fairItems, color: '#F59E0B' },
                    { name: 'Poor', value: data.summary.poorItems, color: '#EF4444' },
                    { name: 'Essay', value: data.summary.essayItems, color: '#6B7280' }
                  ].filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {[
                    { name: 'Good', value: data.summary.goodItems, color: '#10B981' },
                    { name: 'Fair', value: data.summary.fairItems, color: '#F59E0B' },
                    { name: 'Poor', value: data.summary.poorItems, color: '#EF4444' },
                    { name: 'Essay', value: data.summary.essayItems, color: '#6B7280' }
                  ].filter(d => d.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">Filter by quality:</span>
        <select
          value={filterQuality}
          onChange={(e) => setFilterQuality(e.target.value)}
          className="input w-40"
        >
          <option value="all">All Items</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor/Review</option>
          <option value="essay">Essay</option>
        </select>
        <span className="text-sm text-gray-500">
          Showing {filteredItems.length} of {data.items.length} items
        </span>
      </div>

      {/* Individual Item Analysis */}
      <div className="space-y-4">
        {filteredItems.map((item: ItemAnalysis) => (
          <div key={item.questionId} className="bg-white rounded-xl border overflow-hidden">
            {/* Item Header */}
            <div
              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleItem(item.questionId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {expandedItems.has(item.questionId) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">Q{item.questionNumber}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      item.type === 'MULTIPLE_CHOICE' ? 'bg-blue-100 text-blue-700' :
                      item.type === 'TRUE_FALSE' ? 'bg-purple-100 text-purple-700' :
                      item.type === 'ESSAY' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {item.type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-gray-900 font-medium truncate max-w-md">
                    {item.questionText}
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  {item.isEssay ? (
                    <span className="text-sm text-gray-500">Manual Review</span>
                  ) : (
                    <>
                      {/* Quality Score Bar */}
                      {item.qualityScore !== undefined && (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getQualityScoreColor(item.qualityScore)}`}
                              style={{ width: `${item.qualityScore}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-600">{item.qualityScore}</span>
                        </div>
                      )}
                      
                      {/* Quality Badge */}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                        getQualityColor(item.interpretation?.discriminationQuality)
                      }`}>
                        {getQualityIcon(item.interpretation?.discriminationQuality)}
                        {item.interpretation?.discriminationQuality?.toUpperCase() || 'N/A'}
                      </span>
                    </>
                  )}
                  
                  <span className="text-sm text-gray-500">{item.points} pts</span>
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedItems.has(item.questionId) && !item.isEssay && item.statistics && (
              <div className="border-t border-gray-100 p-4 bg-gray-50">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Statistics */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-500" />
                      Item Statistics
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-2 bg-white rounded">
                        <div>
                          <span className="text-sm text-gray-600">Difficulty Index (p-value)</span>
                          <p className="text-xs text-gray-400">Proportion correct</p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-medium">{item.statistics.difficultyIndex}</span>
                          <p className="text-xs text-gray-500">{item.interpretation?.difficulty}</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center p-2 bg-white rounded">
                        <div>
                          <span className="text-sm text-gray-600">Upper 27% Difficulty</span>
                          <p className="text-xs text-gray-400">Top performers' success rate</p>
                        </div>
                        <span className="font-mono font-medium text-green-600">
                          {item.statistics.upper27Difficulty}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center p-2 bg-white rounded">
                        <div>
                          <span className="text-sm text-gray-600">Lower 27% Difficulty</span>
                          <p className="text-xs text-gray-400">Bottom performers' success rate</p>
                        </div>
                        <span className="font-mono font-medium text-red-600">
                          {item.statistics.lower27Difficulty}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center p-2 bg-white rounded">
                        <div>
                          <span className="text-sm text-gray-600">Discrimination Index</span>
                          <p className="text-xs text-gray-400">Upper - Lower 27%</p>
                        </div>
                        <div className="text-right">
                          <span className={`font-mono font-medium ${
                            item.statistics.discriminationIndex >= 0.3 ? 'text-green-600' :
                            item.statistics.discriminationIndex >= 0.1 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {item.statistics.discriminationIndex}
                          </span>
                          <p className="text-xs text-gray-500">{item.interpretation?.discrimination}</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center p-2 bg-white rounded">
                        <div>
                          <span className="text-sm text-gray-600">Point-Biserial Correlation</span>
                          <p className="text-xs text-gray-400">Item-total correlation</p>
                        </div>
                        <div className="text-right">
                          <span className={`font-mono font-medium ${
                            item.statistics.pointBiserial >= 0.3 ? 'text-green-600' :
                            item.statistics.pointBiserial >= 0.1 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {item.statistics.pointBiserial}
                          </span>
                          <p className="text-xs text-gray-500">{item.interpretation?.pointBiserial}</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center p-2 bg-white rounded">
                        <span className="text-sm text-gray-600">Correct Responses</span>
                        <span className="font-mono">
                          {item.statistics.correctCount} / {item.statistics.totalResponses}
                          <span className="text-gray-400 ml-1">
                            ({Math.round((item.statistics.correctCount / item.statistics.totalResponses) * 100)}%)
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Distractor Analysis */}
                  {item.distractorAnalysis && item.distractorAnalysis.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4 text-purple-500" />
                        Distractor Analysis
                      </h4>
                      <div className="space-y-2">
                        {item.distractorAnalysis.map((dist) => (
                          <div
                            key={dist.choiceIndex}
                            className={`p-2 rounded border ${
                              dist.isCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                  dist.isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                                }`}>
                                  {String.fromCharCode(65 + dist.choiceIndex)}
                                </span>
                                <span className="text-sm truncate max-w-[200px]" title={dist.text}>
                                  {dist.text}
                                </span>
                                {dist.isCorrect && (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                              <span className="text-sm font-medium">
                                {Math.round(dist.proportion * 100)}%
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-xs">
                              <div className="text-center">
                                <p className="text-gray-400">Selected</p>
                                <p className="font-medium">{dist.selectedCount}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-400">Upper 27%</p>
                                <p className="font-medium text-green-600">{Math.round(dist.upper27Rate * 100)}%</p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-400">Lower 27%</p>
                                <p className="font-medium text-red-600">{Math.round(dist.lower27Rate * 100)}%</p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-400">Disc.</p>
                                <p className={`font-medium ${
                                  dist.isCorrect 
                                    ? (dist.discrimination >= 0.3 ? 'text-green-600' : 'text-yellow-600')
                                    : (dist.discrimination < 0 ? 'text-green-600' : 'text-red-600')
                                }`}>
                                  {dist.discrimination}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                {item.recommendations && item.recommendations.length > 0 && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h4 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Recommendations
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      {item.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-amber-800">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Essay Item Message */}
            {expandedItems.has(item.questionId) && item.isEssay && (
              <div className="border-t border-gray-100 p-4 bg-gray-50">
                <div className="flex items-center gap-2 text-gray-600">
                  <Info className="w-5 h-5" />
                  <p>{item.message || 'Essay questions require manual review and cannot be analyzed automatically.'}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Export Options */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => {
            const content = JSON.stringify(data, null, 2);
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `item-analysis-${examId}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export JSON
        </button>
      </div>
    </div>
  );
};

export default ItemAnalysisPage;
