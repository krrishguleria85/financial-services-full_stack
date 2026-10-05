import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FileText, Eye, Search, Trash2, X } from 'lucide-react';
import api from '../../lib/api';

const RequestsPage = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [statusModal, setStatusModal] = useState<{ id: string, status: string, req: any } | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const fetchRequests = async () => {
    try {
      const res = await api.get('/service-requests');
      setRequests(res.data.requests || res.data);
    } catch (error) {
      console.error('Failed to load requests', error);
      toast.error('Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleStatusSelect = (req: any, newStatus: string) => {
    if (newStatus === 'DOCUMENTS_REQUIRED' || newStatus === 'CANCELLED') {
      setStatusModal({ id: req.id, status: newStatus, req });
      setAdminNote('');
    } else {
      handleUpdateStatus(req.id, newStatus);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string, params: any = {}) => {
    try {
      await api.patch(`/service-requests/${id}/status`, { status: newStatus, ...params });
      toast.success('Status updated successfully');
      setStatusModal(null);
      fetchRequests();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status');
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this request? This action cannot be undone.')) {
      try {
        await api.delete(`/service-requests/${id}`);
        toast.success('Service request deleted');
        fetchRequests();
      } catch (error) {
        console.error(error);
        toast.error('Failed to delete request');
      }
    }
  };

  const handleDownload = async (docId: string, originalName: string) => {
    try {
      const res = await api.get(`/documents/${docId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error('Failed to download document');
    }
  };

  const filteredRequests = requests.filter(req => 
    req.requestId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    req.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.customer?.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Service Requests</h1>
        
        <div className="relative w-full sm:w-64">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input 
            type="text" 
            placeholder="Search by ID, Name, Phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Loading requests...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Request Details</th>
                  <th className="px-6 py-4 font-semibold">Customer Info</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p>No service requests found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req: any) => (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs font-bold text-primary-600 mb-1">{req.requestId}</div>
                        <div className="font-semibold text-slate-900">{req.service?.name || 'Unknown Service'}</div>
                        <div className="text-xs text-slate-500 mt-1 line-clamp-1">{req.message || 'No message provided'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{req.customer?.name}</div>
                        <div className="text-slate-600">{req.customer?.phone}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={req.status}
                          onChange={(e) => handleStatusSelect(req, e.target.value)}
                          className={`text-xs font-semibold rounded-full px-3 py-1 border-0 focus:ring-2 focus:ring-primary-500 cursor-pointer ${
                            req.status === 'NEW' ? 'bg-blue-100 text-blue-800' :
                            req.status === 'DOCUMENTS_REQUIRED' ? 'bg-amber-100 text-amber-800' :
                            req.status === 'DOCUMENTS_RECEIVED' ? 'bg-indigo-100 text-indigo-800' :
                            req.status === 'UNDER_REVIEW' ? 'bg-purple-100 text-purple-800' :
                            req.status === 'IN_PROGRESS' ? 'bg-sky-100 text-sky-800' :
                            req.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            req.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                            'bg-slate-100 text-slate-800'
                          }`}
                        >
                          <option value="NEW">New</option>
                          <option value="DOCUMENTS_REQUIRED">Docs Required</option>
                          <option value="DOCUMENTS_RECEIVED">Docs Received</option>
                          <option value="UNDER_REVIEW">Under Review</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-3">
                          <button 
                            onClick={() => setSelectedRequest(req)}
                            className="text-primary-600 hover:text-primary-800 flex items-center font-medium"
                          >
                            <Eye className="w-4 h-4 mr-1" /> View Details
                          </button>
                          <button onClick={() => handleDeleteRequest(req.id)} className="text-red-600 hover:text-red-800 flex items-center font-medium">
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

      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold">Request Details</h2>
              <button onClick={() => setSelectedRequest(null)} className="text-slate-500 hover:text-slate-800">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-slate-500 uppercase">Tracking Request ID (Give this to the user)</label>
                <div className="text-xl font-mono font-bold text-primary-700">{selectedRequest.requestId}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase">Customer Name</label>
                  <div className="font-medium">{selectedRequest.customer?.name}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Phone Number</label>
                  <div className="font-medium">{selectedRequest.customer?.phone}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Service</label>
                  <div className="font-medium">{selectedRequest.service?.name}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase">Status</label>
                  <div className="font-medium">{selectedRequest.status}</div>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase">Message</label>
                <p className="bg-slate-50 p-3 rounded border text-sm mt-1">{selectedRequest.message || 'No message provided.'}</p>
              </div>
              
              {selectedRequest.formData && Object.keys(JSON.parse(selectedRequest.formData)).length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Additional Information</h3>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded border">
                    {Object.entries(JSON.parse(selectedRequest.formData)).map(([key, value]) => (
                      <div key={key}>
                        <label className="text-xs text-slate-500 uppercase block">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                        <div className="font-medium text-sm">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedRequest.documents && selectedRequest.documents.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <h3 className="font-semibold text-slate-900 mb-3">Uploaded Documents</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {selectedRequest.documents.map((doc: any) => (
                      <div key={doc.id} className="flex justify-between items-center p-3 bg-slate-50 border rounded-lg">
                        <div>
                          <div className="font-medium text-sm text-slate-800">{doc.documentType}</div>
                          <div className="text-xs text-slate-500">{doc.originalName}</div>
                        </div>
                        <button 
                          onClick={() => handleDownload(doc.id, doc.originalName)}
                          className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-slate-50 flex justify-end">
              <button onClick={() => setSelectedRequest(null)} className="btn btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}

      {statusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {statusModal.status === 'DOCUMENTS_REQUIRED' ? 'Request Documents' : 'Cancel Request'}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Message for Customer <span className="text-red-500">*</span>
                </label>
                <textarea 
                  value={adminNote} 
                  onChange={(e) => setAdminNote(e.target.value)} 
                  className="input-field min-h-[100px]"
                  placeholder={statusModal.status === 'DOCUMENTS_REQUIRED' ? 'Specify which document they need to upload (e.g., Please upload your PAN Card and latest Bank Statement)...' : 'Reason for cancellation...'}
                  required
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
                onClick={() => handleUpdateStatus(statusModal.id, statusModal.status, { note: adminNote })} 
                className={`btn ${statusModal.status === 'DOCUMENTS_REQUIRED' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                disabled={!adminNote.trim()}
              >
                Confirm {statusModal.status === 'DOCUMENTS_REQUIRED' ? 'Request Docs' : 'Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsPage;
