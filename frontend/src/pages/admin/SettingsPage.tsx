import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Save, Building2, Share2, Info } from 'lucide-react';
import api from '../../lib/api';

const SettingsPage = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    businessName: '',
    tagline: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    workingHours: '',
    youtubeChannelUrl: '',
    instagramUrl: '',
    facebookUrl: '',
    businessDescription: '',
    footerText: '',
    disclaimer: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        setSettings(prev => ({ ...prev, ...res.data }));
      } catch (error) {
        console.error('Failed to load settings', error);
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Settings updated successfully');
    } catch (error) {
      console.error('Failed to update settings', error);
      toast.error('Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Platform Settings</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* General Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center">
            <Building2 className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-slate-800">General Information</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Business Name</label>
              <input 
                type="text" 
                name="businessName"
                value={settings.businessName || ''}
                onChange={handleChange}
                className="input-field w-full"
                placeholder="e.g. Apex Financial"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Tagline</label>
              <input 
                type="text" 
                name="tagline"
                value={settings.tagline || ''}
                onChange={handleChange}
                className="input-field w-full"
                placeholder="Your business tagline"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Business Description</label>
              <textarea 
                name="businessDescription"
                value={settings.businessDescription || ''}
                onChange={handleChange}
                className="input-field w-full min-h-[100px]"
                placeholder="Describe your business services..."
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center">
            <Info className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-slate-800">Contact Details</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Email Address(es)</label>
              <input 
                type="text" 
                name="email"
                value={settings.email || ''}
                onChange={handleChange}
                className="input-field w-full"
                placeholder="Separate with commas if multiple"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Phone Number</label>
              <input 
                type="text" 
                name="phone"
                value={settings.phone || ''}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">WhatsApp Number</label>
              <input 
                type="text" 
                name="whatsapp"
                value={settings.whatsapp || ''}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Working Hours</label>
              <input 
                type="text" 
                name="workingHours"
                value={settings.workingHours || ''}
                onChange={handleChange}
                className="input-field w-full"
                placeholder="e.g. Mon-Fri: 9 AM - 6 PM"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Business Address</label>
              <textarea 
                name="address"
                value={settings.address || ''}
                onChange={handleChange}
                className="input-field w-full min-h-[80px]"
              />
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center">
            <Share2 className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-slate-800">Social Media & Links</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">YouTube Channel URL</label>
              <input 
                type="url" 
                name="youtubeChannelUrl"
                value={settings.youtubeChannelUrl || ''}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Instagram URL</label>
              <input 
                type="url" 
                name="instagramUrl"
                value={settings.instagramUrl || ''}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Facebook URL</label>
              <input 
                type="url" 
                name="facebookUrl"
                value={settings.facebookUrl || ''}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
          </div>
        </div>
        
        {/* Footer & Legal */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1 md:col-span-1">
              <label className="text-sm font-medium text-slate-700">Footer Text</label>
              <input 
                type="text" 
                name="footerText"
                value={settings.footerText || ''}
                onChange={handleChange}
                className="input-field w-full"
              />
            </div>
            <div className="space-y-1 md:col-span-1">
              <label className="text-sm font-medium text-slate-700">Disclaimer Text</label>
              <textarea 
                name="disclaimer"
                value={settings.disclaimer || ''}
                onChange={handleChange}
                className="input-field w-full min-h-[60px]"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end sticky bottom-6 z-10">
          <button 
            type="submit" 
            disabled={isSaving}
            className="btn-primary shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all flex items-center px-8 py-3 rounded-full text-lg font-bold"
          >
            {isSaving ? 'Saving...' : (
              <>
                <Save className="w-6 h-6 mr-2" />
                Save All Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;
