import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { coursesApi, usersApi } from '@/services/api';
import { Course, Role, User } from '@/types';
import Modal from '@/components/Modal';
import { Plus, Search, BookOpen, Users, Edit, Trash2, UserPlus, Eye } from 'lucide-react';

const CoursesPage = () => {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    semester: '1ST',
    academicYear: '2024-2025',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Enrollment states
  const [availableStudents, setAvailableStudents] = useState<User[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<User[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await coursesApi.list({ search: search || undefined });
      setCourses(res.data.data.courses);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [search]);

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      semester: '1ST',
      academicYear: '2024-2025',
    });
    setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      await coursesApi.create(formData);
      setShowCreateModal(false);
      resetForm();
      fetchCourses();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to create course');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setFormLoading(true);
    setFormError('');

    try {
      await coursesApi.update(selectedCourse._id, formData);
      setShowEditModal(false);
      resetForm();
      fetchCourses();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to update course');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCourse) return;
    setFormLoading(true);

    try {
      await coursesApi.delete(selectedCourse._id);
      setShowDeleteModal(false);
      setSelectedCourse(null);
      fetchCourses();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to delete course');
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (course: Course) => {
    setSelectedCourse(course);
    setFormData({
      code: course.code,
      name: course.name,
      description: course.description || '',
      semester: course.semester,
      academicYear: course.academicYear,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (course: Course) => {
    setSelectedCourse(course);
    setShowDeleteModal(true);
  };

  const openEnrollModal = async (course: Course) => {
    setSelectedCourse(course);
    setSelectedStudentIds([]);
    try {
      const res = await usersApi.getStudents();
      setAvailableStudents(res.data.data.students);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    }
    setShowEnrollModal(true);
  };

  const openStudentsModal = async (course: Course) => {
    setSelectedCourse(course);
    try {
      const res = await coursesApi.getStudents(course._id);
      setEnrolledStudents(res.data.data.students);
    } catch (error) {
      console.error('Failed to fetch enrolled students:', error);
    }
    setShowStudentsModal(true);
  };

  const handleEnroll = async () => {
    if (!selectedCourse || selectedStudentIds.length === 0) return;
    setFormLoading(true);

    try {
      await coursesApi.enrollStudents(selectedCourse._id, selectedStudentIds);
      setShowEnrollModal(false);
      setSelectedStudentIds([]);
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to enroll students');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const canManage = user?.role === Role.ADMIN || user?.role === Role.FACULTY;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-gray-600">Manage your courses and enrollments</p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Course
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* Courses grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No courses found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <div key={course._id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary-600" />
                </div>
                <span className="badge badge-primary">{course.semester}</span>
              </div>
              <h3 className="font-semibold text-gray-900">{course.code}</h3>
              <p className="text-sm text-gray-600 mb-3">{course.name}</p>
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>{course.academicYear}</span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {course.facultyId?.firstName} {course.facultyId?.lastName}
                </span>
              </div>

              {/* Action buttons */}
              {canManage && (
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => openStudentsModal(course)}
                    className="flex-1 btn btn-secondary text-sm py-1.5 flex items-center justify-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    Students
                  </button>
                  <button
                    onClick={() => openEnrollModal(course)}
                    className="flex-1 btn btn-secondary text-sm py-1.5 flex items-center justify-center gap-1"
                  >
                    <UserPlus className="w-4 h-4" />
                    Enroll
                  </button>
                  <button
                    onClick={() => openEditModal(course)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {user?.role === Role.ADMIN && (
                    <button
                      onClick={() => openDeleteModal(course)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Course"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="input"
              placeholder="CMSC 135"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="Data Communication and Networking"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={3}
              placeholder="Course description..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="input"
              >
                <option value="1ST">1st Semester</option>
                <option value="2ND">2nd Semester</option>
                <option value="SUMMER">Summer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <input
                type="text"
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="input"
                placeholder="2024-2025"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={formLoading} className="btn btn-primary">
              {formLoading ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Course"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="input"
              >
                <option value="1ST">1st Semester</option>
                <option value="2ND">2nd Semester</option>
                <option value="SUMMER">Summer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <input
                type="text"
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={formLoading} className="btn btn-primary">
              {formLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Course"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedCourse?.code}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={formLoading}
              className="btn btn-danger"
            >
              {formLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Enroll Students Modal */}
      <Modal
        isOpen={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        title={`Enroll Students to ${selectedCourse?.code}`}
        size="lg"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {formError}
            </div>
          )}
          <p className="text-sm text-gray-600">
            Select students to enroll ({selectedStudentIds.length} selected)
          </p>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y">
            {availableStudents.map((student) => (
              <label
                key={student._id || student.id}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes((student._id || student.id)!)}
                  onChange={() => toggleStudentSelection((student._id || student.id)!)}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <div>
                  <p className="font-medium text-gray-900">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {student.studentNumber} • {student.program} {student.yearLevel}-{student.section}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowEnrollModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleEnroll}
              disabled={formLoading || selectedStudentIds.length === 0}
              className="btn btn-primary"
            >
              {formLoading ? 'Enrolling...' : `Enroll ${selectedStudentIds.length} Students`}
            </button>
          </div>
        </div>
      </Modal>

      {/* View Students Modal */}
      <Modal
        isOpen={showStudentsModal}
        onClose={() => setShowStudentsModal(false)}
        title={`Students in ${selectedCourse?.code}`}
        size="lg"
      >
        <div className="space-y-4">
          {enrolledStudents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No students enrolled yet
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Name</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Student No.</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Section</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {enrolledStudents.map((student) => (
                    <tr key={student._id || student.id}>
                      <td className="px-4 py-3">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{student.studentNumber}</td>
                      <td className="px-4 py-3 text-gray-500">{student.section}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end pt-4">
            <button
              onClick={() => setShowStudentsModal(false)}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CoursesPage;
