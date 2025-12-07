import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import CoursesPage from '@/pages/CoursesPage';
import ExamsPage from '@/pages/ExamsPage';
import StudentExamsPage from '@/pages/StudentExamsPage';
import ExamCreatorPage from '@/pages/ExamCreatorPage';
import TakeExamPage from '@/pages/TakeExamPage';
import ExamBuilderPage from '@/pages/ExamBuilder';
import ExamSubmissionsPage from '@/pages/ExamSubmissionsPage';
import ResultsPage from '@/pages/ResultsPage';
import ViewSubmissionPage from '@/pages/ViewSubmissionPage';
import AnnouncementsPage from '@/pages/AnnouncementsPage';
import UsersPage from '@/pages/UsersPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ProfilePage from '@/pages/ProfilePage';
import ProfileSettingsPage from '@/pages/ProfileSettingsPage';
import { Role } from '@/types';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Route that shows different content based on role
const ExamsRoute = () => {
  const { user } = useAuthStore();
  
  // Students see the StudentExamsPage, teachers/admins see ExamsPage
  if (user?.role === Role.STUDENT) {
    return <StudentExamsPage />;
  }
  return <ExamsPage />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/courses" element={<CoursesPage />} />
                  <Route path="/exams" element={<ExamsRoute />} />
                  <Route path="/exams/:examId/edit" element={<ExamCreatorPage />} />
                  <Route path="/exams/:examId/take" element={<TakeExamPage />} />
                  <Route path="/exams/:examId/builder" element={<ExamBuilderPage />} />
                  <Route path="/exams/:examId/submissions" element={<ExamSubmissionsPage />} />
                  <Route path="/results" element={<ResultsPage />} />
                  <Route path="/submissions/:submissionId" element={<ViewSubmissionPage />} />
                  <Route path="/announcements" element={<AnnouncementsPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/profile/settings" element={<ProfileSettingsPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;