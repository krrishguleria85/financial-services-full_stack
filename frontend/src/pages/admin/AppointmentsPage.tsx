import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Calendar, Eye, Search, Trash2 } from 'lucide-react';
import api from '../../lib/api';

const AppointmentsPage = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [statusModal, setStatusModal] = useState<{ id: string, status: string, app: any } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const fetchAppointments = async () => {
    try {
      const res = await api.get('/appointments');
      setAppointments(res.data.appointments);
    } catch (error) {
      console.error('Failed to load appointments', error);
      toast.error('Failed to load appointments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleStatusSelect = (app: any, newStatus: string) => {
    if (newStatus === 'RESCHEDULED' || newStatus === 'CANCELLED') {
      setStatusModal({ id: app.id, status: newStatus, app });
      setAdminNote('');
      setNewDate(app.date);
      setNewTime(app.time);
    } else {
      handleUpdateStatus(app.id, newStatus);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string, params: any = {}) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status: newStatus, ...params });
      toast.success('Status updated successfully');
      setStatusModal(null);
      fetchAppointments();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status');
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this appointment? This action cannot be undone.')) {
      try {
        await api.delete(`/appointments/${id}`);
        toast.success('Appointment deleted');
        fetchAppointments();
      } catch (error) {
        console.error(error);
        toast.error('Failed to delete appointment');
      }
    }
  };

  const filteredAppointments = appointments.filter(app => 
    app.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    app.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.customer?.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
        
        <div className="relative w-full sm:w-64">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input 
            type="text" 
            placeholder="Search by Name, Phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Loading appointments...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date & Time</th>
                  <th className="px-6 py-4 font-semibold">Customer Info</th>
                  <th className="px-6 py-4 font-semibold">Purpose</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p>No appointments found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((app: any) => (
                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{app.date}</div>
                        <div className="text-slate-600">{app.time}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{app.customer?.name}</div>
                        <div className="text-slate-600">{app.customer?.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600 line-clamp-2 max-w-xs">{app.message || 'No message provided'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={app.status}
                          onChange={(e) => handleStatusSelect(app, e.target.value)}
                          className={`text-xs font-semibold rounded-full px-3 py-1 border-0 focus:ring-2 focus:ring-primary-500 cursor-pointer ${
                            app.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                            app.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                            app.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            app.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                            'bg-slate-100 text-slate-800'
                          }`}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="CONFIRMED">Confirmed</option>
                          <option value="RESCHEDULED">Rescheduled</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-3">
                          <button 
                            onClick={() => setSelectedAppointment(app)}
                            className="text-primary-600 hover:text-primary-800 flex items-center font-medium"
                          >
                            <Eye className="w-4 h-4 mr-1" /> View
                          </button>
                          <button onClick={() => handleDeleteAppointment(app.id)} className="text-red-600 hover:text-red-800 flex items-center font-medium">
                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold">Appointment Details</h2>
              <button onClick={() => setSelectedAppointment(null)} className="text-slate-500 hover:text-slate-800">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-slate-500 uppercase">Tracking ID (Give this to the user)</label>
                <div className="text-xl font-mono font-bold text-primary-700">{selectedAppointment.id}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase">Customer Name</label>
                  <div className="font-medium">{selectedAppointment.customer?.name}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Phone Number</label>
                  <div className="font-medium">{selectedAppointment.customer?.phone}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Service</label>
                  <div className="font-medium">{selectedAppointment.service?.name || 'General Consultation'}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Status</label>
                  <div className="font-medium">{selectedAppointment.status}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Date</label>
                  <div className="font-medium">{selectedAppointment.date}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Time</label>
                  <div className="font-medium">{selectedAppointment.time}</div>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase">Message</label>
                <p className="bg-slate-50 p-3 rounded border text-sm mt-1">{selectedAppointment.message || 'No message provided.'}</p>
              </div>
            </div>
            <div className="p-6 border-t bg-slate-50 flex justify-end">
              <button onClick={() => setSelectedAppointment(null)} className="btn btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}

      {statusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {statusModal.status === 'RESCHEDULED' ? 'Reschedule Appointment' : 'Cancel Appointment'}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {statusModal.status === 'RESCHEDULED' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">New Date</label>
                    <input 
                      type="date" 
                      value={newDate} 
                      onChange={(e) => setNewDate(e.target.value)} 
                      className="input-field"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">New Time</label>
                    <input 
                      type="time" 
                      value={newTime} 
                      onChange={(e) => setNewTime(e.target.value)} 
                      className="input-field"
                    />
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Message for Customer (Optional)
                </label>
                <textarea 
                  value={adminNote} 
                  onChange={(e) => setAdminNote(e.target.value)} 
                  className="input-field min-h-[100px]"
                  placeholder={statusModal.status === 'RESCHEDULED' ? 'Reason for rescheduling, or call back details...' : 'Reason for cancellation...'}
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
              <button 
                onClick={() => setStatusModal(null)} 
                className="btn bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleUpdateStatus(statusModal.id, statusModal.status, { 
                  adminNote, 
                  newDate: statusModal.status === 'RESCHEDULED' ? newDate : undefined, 
                  newTime: statusModal.status === 'RESCHEDULED' ? newTime : undefined 
                })} 
                className={`btn ${statusModal.status === 'RESCHEDULED' ? 'bg-sky-600 hover:bg-sky-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
              >
                Confirm {statusModal.status === 'RESCHEDULED' ? 'Reschedule' : 'Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;
