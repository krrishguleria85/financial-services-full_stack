import { useState } from 'react';
import { Search, FileText, CheckCircle2, Clock, Upload, ArrowRight, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../lib/api';
import type { ServiceRequest, Document } from '../types';

const TrackRequestPage = () => {
  const [requestId, setRequestId] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requestData, setRequestData] = useState<{ request: ServiceRequest, documents: Document[] } | null>(null);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('Identity Proof');
  const [isUploading, setIsUploading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId || !phone) {
      toast.error('Please enter both Tracking ID and Phone number');
      return;
    }

    setIsLoading(true);
    setRequestData(null);
    try {
      const cleanId = requestId.trim();
      const cleanPhone = phone.trim();
      let res;
      if (cleanId.toUpperCase().startsWith('REQ-')) {
        res = await api.get(`/service-requests/track?requestId=${cleanId.toUpperCase()}&phone=${cleanPhone}`);
      } else {
        res = await api.get(`/appointments/track?appointmentId=${cleanId}&phone=${cleanPhone}`);
      }
      setRequestData(res.data);
      toast.success('Found');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to find tracking information. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !requestData) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('documentType', documentType);

    try {
      // Upload using request ID
      await api.post(`/documents/upload/${requestData.request.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Document uploaded successfully');
      setSelectedFile(null);
      // Refresh request data to show new document
      const refreshRes = await api.get(`/service-requests/track?requestId=${requestId.trim()}&phone=${phone.trim()}`);
      setRequestData(refreshRes.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
      case 'PENDING':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800"><Clock className="w-4 h-4 mr-1" /> Pending</span>;
      case 'DOCUMENTS_REQUIRED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800"><FileText className="w-4 h-4 mr-1" /> Docs Required</span>;
      case 'DOCUMENTS_RECEIVED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"><ShieldCheck className="w-4 h-4 mr-1" /> Docs Received</span>;
      case 'UNDER_REVIEW':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"><Clock className="w-4 h-4 mr-1" /> Under Review</span>;
      case 'IN_PROGRESS':
      case 'CONFIRMED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"><ArrowRight className="w-4 h-4 mr-1" /> {status === 'CONFIRMED' ? 'Confirmed' : 'In Progress'}</span>;
      case 'RESCHEDULED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-sky-100 text-sky-800"><Clock className="w-4 h-4 mr-1" /> Rescheduled</span>;
      case 'COMPLETED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-4 h-4 mr-1" /> Completed</span>;
      case 'REJECTED':
      case 'CANCELLED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800"><XCircle className="w-4 h-4 mr-1" /> {status === 'CANCELLED' ? 'Cancelled' : 'Rejected'}</span>;
      default:
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-[calc(100vh-200px)]">
      <div className="text-center max-w-3xl mx-auto mb-12 print:hidden">
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mb-4">Track Your Request</h1>
        <p className="text-lg text-slate-600 mb-2">
          Enter your Request ID (provided after you submit a service request) and registered Phone Number.
        </p>
        <p className="text-sm text-slate-500">
          This allows you to check your current status, review admin notes, and upload any required documents.
        </p>
      </div>

      <div className="max-w-xl mx-auto mb-12 print:hidden">
        <form onSubmit={handleSearch} className="card p-6 bg-white shadow-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tracking ID</label>
            <input 
              type="text" 
              value={requestId} 
              onChange={(e) => setRequestId(e.target.value)} 
              className="input-field" 
              placeholder="e.g., REQ-1234abcd or Appointment ID" 
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Registered Phone Number</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">+91</span>
              <input 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                className="input-field pl-12" 
                placeholder="9876543210" 
                required
              />
            </div>
          </div>
          <button type="submit" disabled={isLoading} className="btn btn-primary w-full flex items-center justify-center">
            {isLoading ? 'Searching...' : <><Search className="w-5 h-5 mr-2" /> Track Status</>}
          </button>
        </form>
      </div>

      {requestData && (
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
          {/* Status Details */}
          {/* @ts-ignore */}
          <div className={`card p-6 bg-white shadow-lg border-t-4 border-primary-500 ${!requestData.request.requestId ? 'md:col-span-2 max-w-2xl mx-auto w-full' : ''} print:shadow-none print:border-none print:p-0`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-primary-600 print:hidden" /> 
                <span className="print:text-2xl">Request Details</span>
              </h2>
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors print:hidden"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                Download Receipt
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <span className="text-slate-500">Status</span>
                {getStatusBadge(requestData.request.status)}
              </div>
              
              <div className="pb-4 border-b border-slate-100">
                <span className="text-slate-500 block text-sm mb-1">Service Requested</span>
                <span className="font-semibold text-slate-900">
                  {/* @ts-ignore */}
                  {requestData.request.service?.name || 'Service'}
                </span>
              </div>
              
              <div className="pb-4 border-b border-slate-100">
                <span className="text-slate-500 block text-sm mb-1">Date Submitted</span>
                <span className="text-slate-900">{new Date(requestData.request.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              
              {/* @ts-ignore */}
              {requestData.request.date && requestData.request.time && (
                <div className="pb-4 border-b border-slate-100 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 block text-sm mb-1">Appointment Date</span>
                    {/* @ts-ignore */}
                    <span className="font-semibold text-slate-900">{requestData.request.date}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-sm mb-1">Appointment Time</span>
                    {/* @ts-ignore */}
                    <span className="font-semibold text-slate-900">{requestData.request.time}</span>
                  </div>
                </div>
              )}
              
              {requestData.request.adminNotes && (
                <div className="bg-primary-50 p-4 rounded-lg">
                  <span className="text-primary-800 block text-sm font-semibold mb-1">Message from Admin:</span>
                  <p className="text-slate-700 text-sm">{requestData.request.adminNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Document Upload (Only for Service Requests) */}
          {/* @ts-ignore */}
          {requestData.request.requestId && (
            <div className="card p-6 bg-white shadow-lg space-y-6 print:hidden">
              <h2 className="text-xl font-bold text-slate-900 flex items-center mb-4">
                <ShieldCheck className="w-5 h-5 mr-2 text-primary-600" /> Documents
              </h2>
              
              {requestData.documents.length === 0 && requestData.request.status === 'COMPLETED' && (
                 <p className="text-sm text-slate-500">No documents available.</p>
              )}
              
              {/* Uploaded Documents List */}
              {requestData.documents.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Uploaded Files</h3>
                  <ul className="space-y-2">
                    {requestData.documents.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center overflow-hidden">
                          <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 shrink-0" />
                          <span className="text-sm font-medium text-slate-700 truncate">{doc.name}</span>
                        </div>
                        <span className="text-xs text-slate-400 shrink-0 ml-2">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Upload Form */}
              {requestData.request.status !== 'COMPLETED' && requestData.request.status !== 'CANCELLED' && (
                <form onSubmit={handleFileUpload} className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">Upload New Document</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Document Type</label>
                    <select 
                      value={documentType} 
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="input-field"
                    >
                      <option value="Identity Proof">Identity Proof (Aadhaar/PAN)</option>
                      <option value="Address Proof">Address Proof</option>
                      <option value="Income Proof">Income Proof (Form 16/Salary Slip)</option>
                      <option value="Bank Statement">Bank Statement</option>
                      <option value="Investment Proof">Investment Proof</option>
                      <option value="Policy Document">Policy Document</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Select File (PDF, JPG, PNG)</label>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                      className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary-50 file:text-primary-700
                        hover:file:bg-primary-100
                        border border-slate-200 rounded-lg p-2"
                      required
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={!selectedFile || isUploading} 
                    className="btn btn-secondary w-full flex items-center justify-center"
                  >
                    {isUploading ? 'Uploading...' : <><Upload className="w-4 h-4 mr-2" /> Upload Document</>}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrackRequestPage;
