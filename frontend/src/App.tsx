import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layouts
import MainLayout from './components/layout/MainLayout';
import AdminLayout from './components/layout/AdminLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Public Pages
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import TrackRequestPage from './pages/TrackRequestPage';
import BookAppointmentPage from './pages/BookAppointmentPage';
import ChannelPage from './pages/ChannelPage';
import BlogPage from './pages/BlogPage';
import ContactPage from './pages/ContactPage';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import RequestsPage from './pages/admin/RequestsPage';
import AppointmentsPage from './pages/admin/AppointmentsPage';
import ContentPage from './pages/admin/ContentPage';
import CustomersPage from './pages/admin/CustomersPage';
import ServicesManagementPage from './pages/admin/ServicesManagementPage';
import SettingsPage from './pages/admin/SettingsPage';
import EnquiriesPage from './pages/admin/EnquiriesPage';
import AdminDeadlinesPage from './pages/admin/AdminDeadlinesPage';
import BlogManagementPage from './pages/admin/BlogManagementPage';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="services/:slug" element={<ServiceDetailPage />} />
          <Route path="track" element={<TrackRequestPage />} />
          <Route path="book-appointment" element={<BookAppointmentPage />} />
          <Route path="channel" element={<ChannelPage />} />
          <Route path="blog" element={<BlogPage />} />
          <Route path="contact" element={<ContactPage />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        
        <Route path="/admin" element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="services" element={<ServicesManagementPage />} />
            <Route path="deadlines" element={<AdminDeadlinesPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="blog" element={<BlogManagementPage />} />
            <Route path="enquiries" element={<EnquiriesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
