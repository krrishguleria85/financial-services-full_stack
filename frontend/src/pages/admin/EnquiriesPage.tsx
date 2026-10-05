import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { MessageSquare, CheckCircle, Search, Trash2 } from 'lucide-react';
import api from '../../lib/api';

const EnquiriesPage = () => {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchEnquiries = async () => {
    try {
      const res = await api.get('/enquiries');
      setEnquiries(res.data.enquiries || res.data);
    } catch (error) {
      console.error('Failed to load enquiries', error);
      toast.error('Failed to load enquiries');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
  }, []);

  const handleMarkResolved = async (id: string, isResolved: boolean) => {
    try {
      await api.patch(`/enquiries/${id}`, { isResolved });
      toast.success(isResolved ? 'Marked as resolved' : 'Marked as unresolved');
      fetchEnquiries();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this enquiry?')) {
      try {
        await api.delete(`/enquiries/${id}`);
        toast.success('Enquiry deleted');
        fetchEnquiries();
      } catch (error) {
        console.error(error);
        toast.error('Failed to delete enquiry');
      }
    }
  };

  const filteredEnquiries = enquiries.filter(enq => 
    enq.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    enq.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    enq.phone?.includes(searchTerm) ||
    enq.message?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center">
          <MessageSquare className="mr-2" /> Contact Enquiries
        </h1>
        
        <div className="relative w-full sm:w-64">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input 
            type="text" 
            placeholder="Search by Name, Email, Phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Loading enquiries...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Contact Info</th>
                  <th className="px-6 py-4 font-semibold">Service</th>
                  <th className="px-6 py-4 font-semibold">Message</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEnquiries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p>No enquiries found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredEnquiries.map((enq: any) => (
                    <tr key={enq.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{enq.name}</div>
                        <div className="text-slate-600 text-xs">{enq.email}</div>
                        <div className="text-slate-600 text-xs">{enq.phone}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{enq.service || 'General'}</td>
                      <td className="px-6 py-4 text-slate-700">
                        <p className="line-clamp-2 text-sm">{enq.message}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(enq.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          enq.isResolved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {enq.isResolved ? 'Resolved' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-3">
                          <button 
                            onClick={() => handleMarkResolved(enq.id, !enq.isResolved)}
                            className={`${enq.isResolved ? 'text-slate-500 hover:text-slate-700' : 'text-green-600 hover:text-green-800'} flex items-center font-medium`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" /> {enq.isResolved ? 'Undo' : 'Resolve'}
                          </button>
                          <button 
                            onClick={() => handleDelete(enq.id)} 
                            className="text-red-600 hover:text-red-800 flex items-center font-medium"
                          >
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
    </div>
  );
};

export default EnquiriesPage;
