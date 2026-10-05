import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, FileText, Calendar, 
  PlaySquare, Settings, LogOut, Menu, X, Shield, Activity, MessageSquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsMobile(true);
        setIsSidebarOpen(false);
      } else {
        setIsMobile(false);
        setIsSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    toast.success('Logged out successfully');
    navigate('/admin/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Service Requests', path: '/admin/requests', icon: Activity },
    { name: 'Appointments', path: '/admin/appointments', icon: Calendar },
    { name: 'Customers', path: '/admin/customers', icon: Users },
    { name: 'Services', path: '/admin/services', icon: FileText },
    { name: 'Deadlines', path: '/admin/deadlines', icon: Activity },
    { name: 'Blog Posts', path: '/admin/blog', icon: FileText },
    { name: 'Enquiries', path: '/admin/enquiries', icon: MessageSquare },
    { name: 'YouTube & Content', path: '/admin/content', icon: PlaySquare },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out flex flex-col ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          <div className={`flex items-center gap-2 ${!isSidebarOpen && 'lg:justify-center lg:w-full'}`}>
            <Shield className="w-8 h-8 text-primary-500 shrink-0" />
            <span className={`font-bold text-xl tracking-tight transition-opacity duration-200 ${!isSidebarOpen ? 'lg:hidden' : ''}`}>
              Admin Panel
            </span>
          </div>
          {isMobile && (
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center px-3 py-3 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-primary-600 text-white shadow-md' 
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    } ${!isSidebarOpen && !isMobile ? 'lg:justify-center' : ''}`}
                    title={!isSidebarOpen && !isMobile ? item.name : undefined}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${!isSidebarOpen && !isMobile ? '' : 'mr-3'}`} />
                    <span className={`${!isSidebarOpen && !isMobile ? 'lg:hidden' : ''} font-medium`}>
                      {item.name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className={`flex items-center w-full px-3 py-3 rounded-lg text-slate-300 hover:bg-red-500/10 hover:text-red-500 transition-colors ${
              !isSidebarOpen && !isMobile ? 'lg:justify-center' : ''
            }`}
            title={!isSidebarOpen && !isMobile ? 'Logout' : undefined}
          >
            <LogOut className={`w-5 h-5 shrink-0 ${!isSidebarOpen && !isMobile ? '' : 'mr-3'}`} />
            <span className={`${!isSidebarOpen && !isMobile ? 'lg:hidden' : ''} font-medium`}>
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white shadow-sm flex items-center px-4 justify-between shrink-0 border-b border-slate-200">
          <div className="flex items-center">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-slate-500 hover:text-slate-900 focus:outline-none p-2 rounded-lg hover:bg-slate-100"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-sm font-medium text-slate-700">
              Welcome, Administrator
            </div>
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold border border-primary-200">
              A
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
