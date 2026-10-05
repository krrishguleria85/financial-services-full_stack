import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Calendar, Clock, User, Phone, Mail, MessageSquare } from 'lucide-react';
import api from '../lib/api';

const BookAppointmentPage = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    date: '',
    time: '',
    purpose: '',
  });

  // Get tomorrow's date for minimum date selection
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Combine date and time to ISO string
            await api.post('/appointments', {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        date: formData.date,
        time: formData.time,
        message: formData.purpose,
      });

      setSuccess(true);
      toast.success('Appointment requested successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to book appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="py-20 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto min-h-[calc(100vh-200px)] flex flex-col items-center justify-center">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-8">
          <Calendar className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4 text-center">Consultation Requested!</h1>
        <p className="text-lg text-slate-600 text-center mb-8">
          Thank you for requesting an appointment. We have received your request and will contact you shortly to confirm the timing.
        </p>
        <button onClick={() => navigate('/')} className="btn btn-primary px-8">
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl mb-4">Book a Consultation</h1>
        <p className="text-lg text-slate-600">
          Schedule a time to discuss your financial, tax, or insurance requirements with our experts.
        </p>
      </div>

      <div className="card p-8 shadow-xl bg-white border-t-4 border-gold-500">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Details */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-primary-500" /> Personal Details
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="input-field" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500"><Phone className="w-4 h-4" /></span>
                  <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="input-field pl-10" placeholder="9876543210" pattern="[6-9][0-9]{9}" />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500"><Mail className="w-4 h-4" /></span>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="input-field pl-10" placeholder="john@example.com" />
                </div>
              </div>
            </div>
          </div>

          {/* Appointment Details */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center border-t border-slate-100 pt-6">
              <Calendar className="w-5 h-5 mr-2 text-primary-500" /> Appointment Timing
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Date *</label>
                <input required type="date" name="date" min={minDate} value={formData.date} onChange={handleChange} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Time *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500"><Clock className="w-4 h-4" /></span>
                  <select required name="time" value={formData.time} onChange={handleChange} className="input-field pl-10 bg-white">
                    <option value="">Select a time slot</option>
                    <option value="10:00">10:00 AM - 11:00 AM</option>
                    <option value="11:30">11:30 AM - 12:30 PM</option>
                    <option value="14:00">02:00 PM - 03:00 PM</option>
                    <option value="15:30">03:30 PM - 04:30 PM</option>
                    <option value="17:00">05:00 PM - 06:00 PM</option>
                  </select>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Purpose of Visit / Consultation *</label>
                <div className="relative">
                  <span className="absolute top-3 left-3 text-slate-500"><MessageSquare className="w-4 h-4" /></span>
                  <textarea required name="purpose" value={formData.purpose} onChange={handleChange} rows={3} className="input-field pl-10 py-2" placeholder="Briefly describe what you need help with (e.g., ITR filing for salaried employee, GST registration for new business)"></textarea>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full py-4 text-lg font-bold">
              {isSubmitting ? 'Submitting Request...' : 'Request Appointment'}
            </button>
            <p className="text-sm text-center text-slate-500 mt-4">
              Note: This is a request for an appointment. We will call you to confirm the exact schedule based on availability.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookAppointmentPage;
