import { useState, useEffect } from 'react';
import { Search, FileText, CheckCircle2, Clock, Upload, ArrowRight, ShieldCheck, XCircle, Mail, KeyRound, RotateCcw, ArrowLeft, LogOut } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../lib/api';
import type { ServiceRequest, Document } from '../types';

const SESSION_STORAGE_KEY = 'customerTrackingSession';

const TrackRequestPage = () => {
  const [requestId, setRequestId] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requestData, setRequestData] = useState<{ request: ServiceRequest, documents: Document[] } | null>(null);

  // OTP Verification State
  const [step, setStep] = useState<'search' | 'otp' | 'details'>('search');
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('Identity Proof');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToken, setUploadToken] = useState<string | null>(null);

  // Check if an existing tracking session exists in sessionStorage synchronously
  const [isRestoring, setIsRestoring] = useState<boolean>(() => {
    try {
      const savedSessionStr = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!savedSessionStr) return false;
      const saved = JSON.parse(savedSessionStr);
      return Boolean(saved?.token && saved?.requestId);
    } catch {
      return false;
    }
  });

  // Restore authenticated tracking session on page refresh without sending another OTP email
  useEffect(() => {
    const savedSessionStr = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!savedSessionStr) {
      setIsRestoring(false);
      return;
    }
    try {
      const saved = JSON.parse(savedSessionStr);
      if (saved?.token && saved?.requestId) {
        setRequestId(saved.requestId);
        if (saved.phone) setPhone(saved.phone);
        restoreSession(saved.token);
      } else {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setIsRestoring(false);
      }
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setIsRestoring(false);
    }
  }, []);

  const restoreSession = async (token: string) => {
    setIsLoading(true);
    try {
      const res = await api.get('/service-requests/track/session', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tracking-Token': token,
        },
      });
      setRequestData(res.data);
      if (res.data?.uploadToken || res.data?.sessionToken) {
        setUploadToken(res.data.uploadToken || res.data.sessionToken);
      }
      if (res.data?.request?.requestId) {
        setRequestId(res.data.request.requestId);
      }
      setStep('details');
    } catch (error: any) {
      console.warn('Session restoration failed:', error);
      if (error.response?.status === 401 || error.response?.status === 403 || error.response?.status === 404) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setRequestData(null);
        setUploadToken(null);
        setStep('search');
        toast.error(error.response?.data?.error || 'Tracking session expired. Please verify with a new code.');
      } else {
        // Transient error (network failure, 5xx, etc.) - do not wipe the valid token from sessionStorage
        setStep('search');
        toast.error('Unable to restore tracking session. Please check your connection or retry.');
      }
    } finally {
      setIsLoading(false);
      setIsRestoring(false);
    }
  };

  const handleEndSession = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setRequestData(null);
    setUploadToken(null);
    setStep('search');
    setOtp('');
    toast.success('Tracking session ended');
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId || !phone) {
      toast.error('Please enter both Tracking ID and Phone number');
      return;
    }

    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setIsLoading(true);
    setRequestData(null);
    setUploadToken(null);
    try {
      const cleanId = requestId.trim();
      const cleanPhone = phone.trim();

      if (cleanId.toUpperCase().startsWith('REQ-')) {
        // Service requests require email OTP verification for private tracking & uploads
        const res = await api.post('/service-requests/track/request-otp', {
          requestId: cleanId.toUpperCase(),
          phone: cleanPhone,
        });

        setCooldown(60);
        setStep('otp');
        toast.success(res.data.message || 'Verification code sent to registered email');
      } else {
        // Appointments tracking
        const res = await api.get(`/appointments/track?appointmentId=${cleanId}&phone=${cleanPhone}`);
        setRequestData(res.data);
        if (res.data?.uploadToken) {
          setUploadToken(res.data.uploadToken);
        }
        setStep('details');
        toast.success('Found');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to find tracking information. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      toast.error('Please enter a valid 6-digit verification code');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await api.post('/service-requests/track/verify-otp', {
        requestId: requestId.trim().toUpperCase(),
        phone: phone.trim(),
        otp: cleanOtp,
      });

      setRequestData(res.data);
      const token = res.data?.sessionToken || res.data?.uploadToken;
      if (token) {
        setUploadToken(token);
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            token,
            requestId: requestId.trim().toUpperCase(),
            phone: phone.trim(),
          })
        );
      }
      setStep('details');
      toast.success('Verification successful!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Verification failed. Please check your code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    try {
      await api.post('/service-requests/track/resend-otp', {
        requestId: requestId.trim().toUpperCase(),
        phone: phone.trim(),
      });

      setCooldown(60);
      toast.success('New verification code sent to your email.');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !requestData) return;

    if (!uploadToken) {
      toast.error('Upload session expired or unauthorized. Please track your request again or refresh.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('documentType', documentType);

    try {
      // Upload using request ID with signed authorization token
      // Omit manual Content-Type so Axios/browser automatically attaches multipart boundary
      const uploadRes = await api.post(`/documents/upload/${requestData.request.id}`, formData, {
        headers: {
          'Authorization': `Bearer ${uploadToken}`,
          'X-Upload-Token': uploadToken,
        },
      });

      toast.success('Document uploaded successfully');
      setSelectedFile(null);
      // Append newly uploaded document to local request state
      if (uploadRes.data?.document) {
        setRequestData((prev: any) => prev ? {
          ...prev,
          documents: [...(prev.documents || []), uploadRes.data.document],
        } : prev);
      }
    } catch (error: any) {
      console.error('File upload error details:', error);
      const errorMsg =
        error.response?.data?.error ||
        error.message ||
        'Failed to upload document';
      toast.error(errorMsg);
      if (error.response?.status === 401 || error.response?.status === 403) {
        setUploadToken(null);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
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

      {isRestoring && (
        <div className="max-w-xl mx-auto mb-12 text-center p-8 bg-white rounded-xl shadow-lg border border-slate-100 print:hidden">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent mb-4"></div>
          <p className="text-slate-600 font-medium">Restoring your tracking session...</p>
        </div>
      )}

      {!isRestoring && step === 'search' && (
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
              {isLoading ? 'Sending Verification Code...' : <><Search className="w-5 h-5 mr-2" /> Track Status</>}
            </button>
          </form>
        </div>
      )}

      {step === 'otp' && (
        <div className="max-w-md mx-auto mb-12 print:hidden">
          <div className="card p-8 bg-white shadow-xl border-t-4 border-primary-600 space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Email Verification</h2>
              <p className="text-sm text-slate-600 mt-2">
                For security, we sent a 6-digit verification code to your registered email:
              </p>
              <p className="text-base font-semibold text-primary-700 mt-1 font-mono">
                your registered email address
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 text-center">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="input-field text-center text-3xl font-mono tracking-widest py-3 font-bold text-slate-900"
                  placeholder="123456"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying || otp.length !== 6}
                className="btn btn-primary w-full flex items-center justify-center py-3 text-base"
              >
                {isVerifying ? 'Verifying...' : <><KeyRound className="w-5 h-5 mr-2" /> Verify &amp; View Request</>}
              </button>
            </form>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-sm">
              <button
                type="button"
                onClick={() => { setStep('search'); setOtp(''); }}
                className="text-slate-500 hover:text-slate-800 flex items-center"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Change Details
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={cooldown > 0 || isResending}
                className={`flex items-center font-medium ${cooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-primary-600 hover:text-primary-800'}`}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                {cooldown > 0 ? `Resend in ${cooldown}s` : (isResending ? 'Sending...' : 'Resend Code')}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={handleEndSession}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  title="End tracking session"
                >
                  <LogOut className="w-4 h-4" />
                  <span>End Session</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                  Download Receipt
                </button>
              </div>
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

              {(requestData.request.customerMessage || requestData.request.documentRequestMessage || requestData.request.adminNotes) && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-1">
                    <FileText className="w-4 h-4" />
                    <span>Requested Documents / Message from Team:</span>
                  </div>
                  <p className="text-slate-700 text-sm whitespace-pre-wrap">
                    {requestData.request.customerMessage || requestData.request.documentRequestMessage || requestData.request.adminNotes}
                  </p>
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
                          <span className="text-sm font-medium text-slate-700 truncate">{(doc as any).originalName || doc.name}</span>
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
