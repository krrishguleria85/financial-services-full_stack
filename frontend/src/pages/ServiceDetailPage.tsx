import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FileText, Calculator, Building, ShieldCheck, MessageCircle, ArrowLeft, CheckCircle2, HeartPulse } from 'lucide-react';
import api from '../lib/api';
import type { Service } from '../types';

const ServiceDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showForm = searchParams.get('request') === 'true';

  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ requestId: string; message: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', message: '',
    assessmentYear: '', incomeType: '', panNumber: '',
    businessName: '', gstStatus: '', policyNumber: '',
    healthPlanType: '', familyMembersCount: '', eldestMemberAge: '', preExistingDiseases: '',
  });

  useEffect(() => {
    const fetchService = async () => {
      try {
        const res = await api.get(`/services/${slug}`);
        setService(res.data);
      } catch (error) {
        console.error('Failed to load service', error);
        toast.error('Service not found');
        navigate('/services');
      } finally {
        setIsLoading(false);
      }
    };
    if (slug) fetchService();
  }, [slug, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service) return;
    
    setIsSubmitting(true);
    try {
      const payload: any = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        message: formData.message,
        serviceId: service.id,
      };

      if (service.category === 'itr') {
        payload.assessmentYear = formData.assessmentYear;
        payload.incomeType = formData.incomeType;
        if (formData.panNumber) payload.panNumber = formData.panNumber;
      } else if (service.category === 'gst') {
        payload.businessName = formData.businessName;
        payload.gstStatus = formData.gstStatus;
      } else if (service.category === 'lic') {
        payload.policyNumber = formData.policyNumber;
      } else if (service.category === 'health-insurance') {
        payload.formData = {
          healthPlanType: formData.healthPlanType,
          familyMembersCount: formData.familyMembersCount,
          eldestMemberAge: formData.eldestMemberAge,
          preExistingDiseases: formData.preExistingDiseases,
        };
      }

      const res = await api.post('/service-requests', payload);
      setSuccess({
        requestId: res.data.requestId,
        message: res.data.message
      });
      toast.success('Request submitted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!service) return null;

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <button onClick={() => navigate('/services')} className="flex items-center text-slate-500 hover:text-slate-700 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Services
      </button>

      <div className="grid lg:grid-cols-5 gap-12">
        {/* Service Details */}
        <div className={`lg:col-span-${showForm ? '2' : '5'} space-y-8`}>
          <div className="bg-primary-50 w-16 h-16 rounded-xl flex items-center justify-center">
             {service.icon === 'FileText' ? <FileText className="w-8 h-8 text-primary-600" /> :
              service.icon === 'Calculator' ? <Calculator className="w-8 h-8 text-primary-600" /> :
              service.icon === 'Building' ? <Building className="w-8 h-8 text-primary-600" /> :
              service.icon === 'Shield' ? <ShieldCheck className="w-8 h-8 text-primary-600" /> :
              service.icon === 'HeartPulse' ? <HeartPulse className="w-8 h-8 text-red-500" /> :
              <MessageCircle className="w-8 h-8 text-primary-600" />}
          </div>
          
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">{service.name}</h1>
            <p className="text-xl text-slate-600 mb-6">{service.description}</p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="whitespace-pre-line text-slate-700">{service.longDescription || service.description}</p>
          </div>

          {!showForm && !success && (
            <div className="pt-8 flex gap-4">
              <button onClick={() => navigate(`?request=true`)} className="btn btn-primary px-8 py-3 text-lg">
                Request Assistance
              </button>
              <button onClick={() => navigate('/book-appointment')} className="btn btn-secondary px-8 py-3 text-lg">
                Book Consultation
              </button>
            </div>
          )}
        </div>

        {/* Request Form */}
        {(showForm || success) && (
          <div className="lg:col-span-3">
            <div className="card p-8 bg-white border-primary-100 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary-500 to-gold-500"></div>
              
              {success ? (
                <div className="text-center py-12 space-y-6">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Request Submitted Successfully!</h2>
                  <p className="text-slate-600">{success.message}</p>
                  
                  <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mt-8 inline-block text-left w-full max-w-md mx-auto">
                    <p className="text-sm text-slate-500 uppercase tracking-wider mb-1">Your Request ID</p>
                    <p className="text-3xl font-mono font-bold text-primary-700 mb-4">{success.requestId}</p>
                    <p className="text-sm text-slate-600 mb-6">Please save this ID. You can use it to track the status of your request and upload required documents.</p>
                    <button 
                      onClick={() => navigate('/track')} 
                      className="btn btn-primary w-full"
                    >
                      Track Request Now
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Request {service.name}</h2>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                        <input required type="text" name="name" value={formData.name} onChange={handleChange} className="input-field" placeholder="John Doe" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number *</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">+91</span>
                          <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="input-field pl-12" placeholder="9876543210" pattern="[6-9][0-9]{9}" title="10-digit mobile number" />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                      <input type="email" name="email" value={formData.email} onChange={handleChange} className="input-field" placeholder="john@example.com" />
                    </div>

                    {/* ITR Specific Fields */}
                    {service.category === 'itr' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Assessment Year</label>
                          <select name="assessmentYear" value={formData.assessmentYear} onChange={handleChange} className="input-field bg-white">
                            <option value="">Select Year</option>
                            <option value="2026-27">2026-27 (Current)</option>
                            <option value="2025-26">2025-26</option>
                            <option value="2024-25">2024-25</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Income Source</label>
                          <select name="incomeType" value={formData.incomeType} onChange={handleChange} className="input-field bg-white">
                            <option value="">Select Type</option>
                            <option value="Salary">Salary</option>
                            <option value="Business">Business / Professional</option>
                            <option value="Capital Gains">Capital Gains</option>
                            <option value="Other">Other / Multiple</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">PAN Number (Optional)</label>
                          <input type="text" name="panNumber" value={formData.panNumber} onChange={handleChange} className="input-field bg-white uppercase" placeholder="ABCDE1234F" maxLength={10} />
                          <p className="text-xs text-slate-500 mt-1">We will securely store this. Leave blank if you prefer to share it later.</p>
                        </div>
                      </div>
                    )}

                    {/* GST Specific Fields */}
                    {service.category === 'gst' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
                          <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} className="input-field bg-white" placeholder="Enter business name" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Current GST Status</label>
                          <select name="gstStatus" value={formData.gstStatus} onChange={handleChange} className="input-field bg-white">
                            <option value="">Select Status</option>
                            <option value="Not Registered">Not Registered</option>
                            <option value="Registered (Regular)">Registered (Regular)</option>
                            <option value="Registered (Composition)">Registered (Composition)</option>
                            <option value="Cancelled">Cancelled / Suspended</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* LIC Specific Fields */}
                    {service.category === 'lic' && (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Policy Number (if existing customer)</label>
                        <input type="text" name="policyNumber" value={formData.policyNumber} onChange={handleChange} className="input-field bg-white" placeholder="Enter policy number" />
                      </div>
                    )}

                    {/* Health Insurance Specific Fields */}
                    {service.category === 'health-insurance' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Plan Type</label>
                          <select name="healthPlanType" value={formData.healthPlanType} onChange={handleChange} className="input-field bg-white">
                            <option value="">Select Plan Type</option>
                            <option value="Family Floater">Family Floater (Cover for Family)</option>
                            <option value="Individual">Individual</option>
                            <option value="Senior Citizen">Senior Citizen</option>
                            <option value="Corporate">Corporate / Group</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Number of Members to Cover</label>
                          <input type="number" min="1" max="10" name="familyMembersCount" value={formData.familyMembersCount} onChange={handleChange} className="input-field bg-white" placeholder="e.g., 3" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Age of Eldest Member</label>
                          <input type="number" min="0" max="100" name="eldestMemberAge" value={formData.eldestMemberAge} onChange={handleChange} className="input-field bg-white" placeholder="e.g., 45" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Any Pre-existing Diseases?</label>
                          <select name="preExistingDiseases" value={formData.preExistingDiseases} onChange={handleChange} className="input-field bg-white">
                            <option value="">Select</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Message / Requirements</label>
                      <textarea name="message" value={formData.message} onChange={handleChange} rows={4} className="input-field" placeholder="Please describe your requirements..."></textarea>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full py-3 text-lg flex items-center justify-center">
                        {isSubmitting ? 'Submitting...' : 'Submit Request'}
                      </button>
                      <p className="text-xs text-center text-slate-500 mt-4">
                        By submitting this form, you agree to our Terms and Privacy Policy. We will contact you shortly.
                      </p>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceDetailPage;
