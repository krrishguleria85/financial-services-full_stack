import { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, MessageCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const ContactPage = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    service: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        setSettings(res.data);
      } catch (error) {
        console.error('Failed to load settings', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.phone.replace(/\D/g, '').length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await api.post('/enquiries', formData);
      toast.success('Your enquiry has been submitted. We will get back to you soon.');
      setFormData({ name: '', phone: '', email: '', service: '', message: '' });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit enquiry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-[calc(100vh-200px)]">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl mb-4">Contact Us</h1>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto">
          Have questions? We're here to help. Reach out to us through any of the channels below.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        {/* Contact Info */}
        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Get in Touch</h2>
            
            <div className="space-y-6">
              {settings.address && (
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-slate-900">Office Address</h3>
                    <p className="mt-1 text-slate-600 leading-relaxed whitespace-pre-line">{settings.address}</p>
                  </div>
                </div>
              )}

              {settings.phone && (
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <Phone className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-slate-900">Phone</h3>
                    <p className="mt-1 text-slate-600">{settings.phone}</p>
                  </div>
                </div>
              )}

              {settings.whatsapp && (
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-xl bg-green-50 text-green-600">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-slate-900">WhatsApp</h3>
                    <p className="mt-1 text-slate-600">
                      <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700 font-medium">
                        {settings.whatsapp}
                      </a>
                    </p>
                  </div>
                </div>
              )}

              {settings.email && (
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-slate-900">Email</h3>
                    <p className="mt-1 text-slate-600">
                      <a href={`mailto:${settings.email}`} className="text-primary-600 hover:text-primary-700">
                        {settings.email}
                      </a>
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-10 pt-8 border-t border-slate-100 flex items-start">
              <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Clock className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-slate-900">Business Hours</h3>
                <p className="mt-1 text-slate-600 whitespace-pre-line">
                  {settings.workingHours || "Monday - Saturday: 10:00 AM - 6:00 PM\nSunday: Closed"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Send us a Message</h2>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                required
                className="input-field w-full" 
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone <span className="text-red-500">*</span></label>
                <input 
                  type="tel" 
                  required
                  className="input-field w-full" 
                  placeholder="10-digit number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input 
                  type="email" 
                  className="input-field w-full" 
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Service</label>
              <select 
                className="input-field w-full"
                value={formData.service}
                onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              >
                <option value="">General Enquiry</option>
                <option value="ITR">Income Tax Return (ITR)</option>
                <option value="GST">GST Registration & Filing</option>
                <option value="Insurance">Insurance Services</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message <span className="text-red-500">*</span></label>
              <textarea 
                required
                rows={4}
                className="input-field w-full" 
                placeholder="How can we help you?"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              ></textarea>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="btn-primary w-full justify-center py-3 font-bold"
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>

      {/* Map / Image Area */}
      <div className="mt-16 bg-slate-100 rounded-2xl overflow-hidden h-[400px] border border-slate-200 relative flex items-center justify-center">
        <iframe 
          src="https://maps.google.com/maps?q=House+Number+755,+Sector+43+A,+Chandigarh&t=&z=15&ie=UTF8&iwloc=&output=embed"
          width="100%" 
          height="100%" 
          style={{ border: 0 }} 
          allowFullScreen={false} 
          loading="lazy" 
          referrerPolicy="no-referrer-when-downgrade"
          title="Google Maps Location"
          className="absolute inset-0 w-full h-full"
        ></iframe>
        <div className="relative text-center p-6 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-white/50 max-w-sm mt-auto mb-6 mx-4 pointer-events-none">
          <MapPin className="w-10 h-10 text-primary-500 mx-auto mb-2" />
          <h3 className="font-bold text-slate-900 text-lg mb-1">{settings.businessName || 'Rajesh Guleria Official'}</h3>
          <p className="text-slate-600 text-sm">Please schedule an appointment before visiting our office.</p>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
