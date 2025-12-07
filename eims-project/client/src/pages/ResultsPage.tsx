import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { resultsApi, examsApi } from '@/services/api';
import { ExamResult, Exam, Role } from '@/types';
import Modal from '@/components/Modal';
import { Plus, ClipboardList, CheckCircle, TrendingUp, Send, Eye } from 'lucide-react';

const ResultsPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showRegradeModal, setShowRegradeModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);
  const [selectedExamId, setSelectedExamId] = useState('');

  const [formData, setFormData] = useState({ examId: '', studentId: '', score: 0, remarks: '' });
  const [bulkData, setBulkData] = useState('');
  const [regradeReason, setRegradeReason] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [examResults, setExamResults] = useState<any>(null);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await resultsApi.list();
      setResults(res.data.data.results);
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExams = async () => {
    try {
      const res = await examsApi.list();
      setExams(res.data.data.exams);
    } catch (error) {
      console.error('Failed to fetch exams:', error);
    }
  };

  useEffect(() => {
    fetchResults();
    fetchExams();
  }, []);

  const handleAddResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await resultsApi.create(formData);
      setShowAddModal(false);
      setFormData({ examId: '', studentId: '', score: 0, remarks: '' });
      fetchResults();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to add result');
    } finally {
      setFormLoading(false);
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId) return;
    setFormLoading(true);
    setFormError('');
    try {
      const lines = bulkData.trim().split('\n');
      const results = lines.map((line) => {
        const [studentId, score, remarks] = line.split(',').map((s) => s.trim());
        return { studentId, score: parseInt(score), remarks };
      });
      await resultsApi.createBulk(selectedExamId, results);
      setShowBulkModal(false);
      setBulkData('');
      setSelectedExamId('');
      fetchResults();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to add results');
    } finally {
      setFormLoading(false);
    }
  };

  const handlePublish = async (resultId: string) => {
    try {
      await resultsApi.publish(resultId);
      fetchResults();
      if (examResults) {
        const res = await resultsApi.getByExam(examResults.exam._id);
        setExamResults(res.data.data);
      }
    } catch (error) {
      console.error('Failed to publish result:', error);
    }
  };

  const handlePublishAll = async (examId: string) => {
    try {
      const examResultsRes = await resultsApi.getByExam(examId);
      const resultIds = examResultsRes.data.data.results
        .filter((r: ExamResult) => r.status === 'PENDING')
        .map((r: ExamResult) => r._id);
      if (resultIds.length > 0) {
        await resultsApi.publishBulk(resultIds);
        fetchResults();
        const res = await resultsApi.getByExam(examId);
        setExamResults(res.data.data);
      }
    } catch (error) {
      console.error('Failed to publish results:', error);
    }
  };

  const handleRequestRegrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResult) return;
    setFormLoading(true);
    setFormError('');
    try {
      await resultsApi.requestRegrade(selectedResult._id, regradeReason);
      setShowRegradeModal(false);
      setRegradeReason('');
      fetchResults();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to submit regrade request');
    } finally {
      setFormLoading(false);
    }
  };

  const openViewExamResults = async (examId: string) => {
    try {
      const res = await resultsApi.getByExam(examId);
      setExamResults(res.data.data);
      setShowViewModal(true);
    } catch (error) {
      console.error('Failed to fetch exam results:', error);
    }
  };

  const handleViewResult = (result: ExamResult) => {
    // Check if it's a submission or a result based on type or status
    if (result.type === 'submission' || result.status === 'GRADED' || result.status === 'RETURNED') {
      // It's from ExamSubmission - navigate to submissions route
      navigate(`/submissions/${result._id}`);
    } else {
      // It's from ExamResult - navigate to results detail route
      // For now, also navigate to submissions as most results come from submissions
      navigate(`/submissions/${result._id}`);
    }
  };

  const getScoreColor = (score: number, total: number, passing?: number) => {
    const percentage = (score / total) * 100;
    if (passing && score < passing) return 'text-red-600';
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-blue-600';
    return 'text-yellow-600';
  };

  const canManage = user?.role === Role.ADMIN || user?.role === Role.FACULTY;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Results</h1>
          <p className="text-gray-600">
            {user?.role === Role.STUDENT ? 'View your exam results' : 'Manage exam results and grades'}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={() => setShowBulkModal(true)} className="btn btn-secondary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Bulk Add
            </button>
            <button onClick={() => { setFormData({ examId: '', studentId: '', score: 0, remarks: '' }); setShowAddModal(true); }} className="btn btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Result
            </button>
          </div>
        )}
      </div>

      {canManage && exams.length > 0 && (
        <div className="card p-4">
          <h3 className="font-medium text-gray-900 mb-3">View Results by Exam</h3>
          <div className="flex flex-wrap gap-2">
            {exams.slice(0, 5).map((exam) => (
              <button key={exam._id} onClick={() => openViewExamResults(exam._id)} className="btn btn-secondary text-sm">
                {exam.title}
              </button>
            ))}
          </div>
        </div>
      )}

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
            const exam = result.examId as any;
            const percentage = exam?.totalPoints ? ((result.score / exam.totalPoints) * 100).toFixed(1) : 0;
            const passed = exam?.passingScore ? result.score >= exam.passingScore : true;
            return (
              <div 
                key={result._id} 
                className="card p-5 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleViewResult(result)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
                      {passed ? <CheckCircle className="w-6 h-6 text-green-600" /> : <TrendingUp className="w-6 h-6 text-red-600" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{exam?.title}</h3>
                      <p className="text-sm text-gray-500">{exam?.courseId?.code} • {exam?.type}</p>
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
                    <span className={`badge ${result.status === 'PUBLISHED' || result.status === 'RETURNED' ? 'badge-success' : 'badge-warning'}`}>
                      {result.status === 'RETURNED' ? 'PUBLISHED' : result.status}
                    </span>
                    {exam?.passingScore && <span className="text-gray-500">Passing: {exam.passingScore} pts</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && result.status === 'PENDING' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePublish(result._id);
                        }} 
                        className="btn btn-primary text-sm py-1.5 flex items-center gap-1"
                      >
                        <Send className="w-4 h-4" /> Publish
                      </button>
                    )}
                    {user?.role === Role.STUDENT && (result.status === 'PUBLISHED' || result.status === 'RETURNED') && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewResult(result);
                        }} 
                        className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 hover:underline"
                      >
                        <Eye className="w-4 h-4" /> View Details
                      </button>
                    )}
                  </div>
                </div>
                {result.remarks && (
                  <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg"><strong>Remarks:</strong> {result.remarks}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Result">
        <form onSubmit={handleAddResult} className="space-y-4">
          {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{formError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam</label>
            <select value={formData.examId} onChange={(e) => setFormData({ ...formData, examId: e.target.value })} className="input" required>
              <option value="">Select exam</option>
              {exams.map((exam) => <option key={exam._id} value={exam._id}>{exam.title} ({exam.courseId?.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
            <input type="text" value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className="input" placeholder="MongoDB ObjectId" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
            <input type="number" value={formData.score} onChange={(e) => setFormData({ ...formData, score: parseInt(e.target.value) })} className="input" min={0} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className="input" rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={formLoading} className="btn btn-primary">{formLoading ? 'Adding...' : 'Add Result'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showBulkModal} onClose={() => setShowBulkModal(false)} title="Bulk Add Results" size="lg">
        <form onSubmit={handleBulkAdd} className="space-y-4">
          {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{formError}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam</label>
            <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="input" required>
              <option value="">Select exam</option>
              {exams.map((exam) => <option key={exam._id} value={exam._id}>{exam.title} ({exam.courseId?.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Results Data (CSV: studentId,score,remarks)</label>
            <textarea value={bulkData} onChange={(e) => setBulkData(e.target.value)} className="input font-mono text-sm" rows={8} placeholder="studentId1,85,Good&#10;studentId2,72,Needs work" required />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowBulkModal(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={formLoading} className="btn btn-primary">{formLoading ? 'Adding...' : 'Add Results'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showRegradeModal} onClose={() => setShowRegradeModal(false)} title="Request Regrade">
        <form onSubmit={handleRequestRegrade} className="space-y-4">
          {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{formError}</div>}
          <p className="text-sm text-gray-600">Requesting regrade for: <strong>{(selectedResult?.examId as any)?.title}</strong></p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea value={regradeReason} onChange={(e) => setRegradeReason(e.target.value)} className="input" rows={4} required />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowRegradeModal(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={formLoading} className="btn btn-primary">{formLoading ? 'Submitting...' : 'Submit'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title={`Results: ${examResults?.exam?.title || 'Exam'}`} size="xl">
        {examResults && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-900">{examResults.stats.count}</p>
                <p className="text-sm text-gray-500">Students</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{examResults.stats.average}</p>
                <p className="text-sm text-gray-500">Average</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{examResults.stats.highest}</p>
                <p className="text-sm text-gray-500">Highest</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{examResults.stats.lowest}</p>
                <p className="text-sm text-gray-500">Lowest</p>
              </div>
            </div>
            {examResults.results.some((r: ExamResult) => r.status === 'PENDING') && (
              <div className="flex justify-end">
                <button onClick={() => handlePublishAll(examResults.exam._id)} className="btn btn-primary flex items-center gap-2">
                  <Send className="w-4 h-4" /> Publish All Pending
                </button>
              </div>
            )}
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Student</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Score</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {examResults.results.map((result: ExamResult) => (
                    <tr key={result._id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{result.studentId?.firstName} {result.studentId?.lastName}</p>
                        <p className="text-sm text-gray-500">{result.studentId?.studentNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${getScoreColor(result.score, examResults.exam.totalPoints, examResults.exam.passingScore)}`}>
                          {result.score} / {examResults.exam.totalPoints}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${result.status === 'PUBLISHED' || result.status === 'RETURNED' ? 'badge-success' : 'badge-warning'}`}>
                          {result.status === 'RETURNED' ? 'PUBLISHED' : result.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {result.status === 'PENDING' && (
                          <button onClick={() => handlePublish(result._id)} className="text-sm text-primary-600 hover:text-primary-700">Publish</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={() => setShowViewModal(false)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ResultsPage;