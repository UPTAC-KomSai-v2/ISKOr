import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { coursesApi } from '@/services/api';
import { Course, Role } from '@/types';
import { Plus, Search, BookOpen, Users } from 'lucide-react';

const CoursesPage = () => {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await coursesApi.list({ search: search || undefined });
        setCourses(res.data.data.courses);
      } catch (error) {
        console.error('Failed to fetch courses:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-gray-600">Manage your courses and enrollments</p>
        </div>
        {(user?.role === Role.ADMIN || user?.role === Role.FACULTY) && (
          <button className="btn btn-primary flex items-center gap-2">
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
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{course.academicYear}</span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {course.facultyId?.firstName} {course.facultyId?.lastName}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoursesPage;
