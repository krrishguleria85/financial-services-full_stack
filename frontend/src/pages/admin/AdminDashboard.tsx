import { useState, useEffect } from 'react';
import { Users, FileText, Calendar, Activity, ArrowUpRight, TrendingUp, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeRequests: 0,
    upcomingAppointments: 0,
    recentRequests: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/admin/stats');
        setStats(res.data);
      } catch (error) {
        console.error('Failed to load dashboard stats', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();

    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-[80vh]">
      <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-medium animate-pulse">Loading your dashboard...</p>
    </div>
  );

  const statCards = [
    { 
      name: 'Active Requests', 
      value: stats.activeRequests, 
      icon: Activity, 
      color: 'text-blue-600', 
      bg: 'bg-blue-100',
      gradient: 'from-blue-500 to-cyan-400',
      trend: '+12% this week'
    },
    { 
      name: 'Total Customers', 
      value: stats.totalCustomers, 
      icon: Users, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-100',
      gradient: 'from-emerald-500 to-teal-400',
      trend: '+5 new today'
    },
    { 
      name: 'Upcoming Appts', 
      value: stats.upcomingAppointments, 
      icon: Calendar, 
      color: 'text-amber-600', 
      bg: 'bg-amber-100',
      gradient: 'from-amber-500 to-orange-400',
      trend: 'Next 7 days'
    },
    { 
      name: 'Total Revenue (Est)', 
      value: '₹ --', 
      icon: TrendingUp, 
      color: 'text-purple-600', 
      bg: 'bg-purple-100',
      gradient: 'from-purple-500 to-indigo-400',
      trend: 'Calculated monthly'
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Welcome Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900 to-primary-600 opacity-90"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="relative z-10 px-8 py-10 md:py-14 flex justify-between items-center">
          <div className="text-white">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-2">{greeting}, Admin! 👋</h1>
            <p className="text-primary-100 max-w-lg text-lg">Here's what's happening with your business today. You have {stats.activeRequests} active requests to look into.</p>
          </div>
          <div className="hidden md:flex flex-col items-end space-y-3">
            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg text-white font-medium flex items-center border border-white/10 shadow-inner">
              <Calendar className="w-4 h-4 mr-2 opacity-80" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 relative overflow-hidden group hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.gradient} opacity-[0.08] rounded-full blur-2xl -mr-10 -mt-10 group-hover:opacity-[0.15] transition-opacity`}></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`p-3 rounded-xl ${card.bg}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{card.trend}</span>
            </div>
            <div className="relative z-10">
              <p className="text-4xl font-black text-slate-900 tracking-tight mb-1">{card.value}</p>
              <p className="text-sm font-medium text-slate-500">{card.name}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity Table (takes up 2 columns on lg) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center mr-3">
                <FileText className="w-4 h-4 text-primary-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Recent Service Requests</h2>
            </div>
            <Link to="/admin/requests" className="text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center bg-primary-50 px-3 py-1.5 rounded-lg transition-colors">
              View All <ArrowUpRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          
          <div className="overflow-x-auto flex-grow">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Request ID</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Service</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.recentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <FileText className="w-12 h-12 mb-3 opacity-20" />
                        <p className="font-medium text-slate-500">No recent requests found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  stats.recentRequests.map((req: any) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 font-mono font-medium text-primary-600">{req.id.substring(0, 8)}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{req.customer?.name || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-600 max-w-[200px] truncate">{req.service?.name || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{new Date(req.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                          req.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          req.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          req.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions / Notifications */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3">
                <Bell className="w-4 h-4 text-slate-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Notifications</h2>
            </div>
          </div>
          
          <div className="p-6 flex-grow flex flex-col space-y-4">
            {stats.activeRequests > 0 ? (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start">
                <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 mr-3 flex-shrink-0 animate-pulse"></div>
                <div>
                  <h4 className="text-sm font-bold text-blue-900 mb-1">Action Required</h4>
                  <p className="text-xs text-blue-700 leading-relaxed">You have {stats.activeRequests} pending service requests that need your attention.</p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start">
                <div className="w-2 h-2 mt-2 rounded-full bg-slate-300 mr-3 flex-shrink-0"></div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-1">All Caught Up</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">There are no pending requests right now. Great job!</p>
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 mb-3">Quick Links</h4>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/admin/services" className="text-xs font-medium text-slate-600 bg-white border border-slate-200 p-2 rounded-lg hover:bg-slate-50 hover:text-primary-600 transition-colors text-center">Manage Services</Link>
                <Link to="/admin/blog" className="text-xs font-medium text-slate-600 bg-white border border-slate-200 p-2 rounded-lg hover:bg-slate-50 hover:text-primary-600 transition-colors text-center">Write a Post</Link>
                <Link to="/admin/settings" className="text-xs font-medium text-slate-600 bg-white border border-slate-200 p-2 rounded-lg hover:bg-slate-50 hover:text-primary-600 transition-colors text-center col-span-2">Update Settings</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
