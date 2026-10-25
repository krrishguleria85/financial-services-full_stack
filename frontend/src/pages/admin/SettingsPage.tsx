import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Save, Building2, Share2, Info, ExternalLink } from 'lucide-react';
import api from '../../lib/api';
import { SOCIAL_PLATFORMS, SocialIcon } from '../../components/common/SocialIcons';

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
    snapchatUrl: '',
    mojUrl: '',
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

    // Client-side URL validation for social platforms
    for (const item of SOCIAL_PLATFORMS) {
      const val = settings[item.key]?.trim();
      if (val) {
        try {
          const parsed = new URL(val);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            toast.error(`${item.label} URL must start with http:// or https://`);
            return;
          }
        } catch {
          toast.error(`Please enter a valid web URL for ${item.label}`);
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Settings updated successfully');
    } catch (error: any) {
      console.error('Failed to update settings', error);
      const msg = error?.response?.data?.error || 'Failed to update settings';
      toast.error(msg);
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
          <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center">
              <Share2 className="w-5 h-5 text-primary-600 mr-2" />
              <h2 className="text-lg font-semibold text-slate-800">Social Media & Public Profiles</h2>
            </div>
            <span className="text-xs text-slate-500 hidden sm:inline">
              Leave empty to automatically hide links from homepage and footer
            </span>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-6">
              Centrally manage the social media profiles displayed across your website (including the footer and the "Beyond Finance: My Passion for Dance" section). Configured links open in a new tab; unconfigured profiles are hidden.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SOCIAL_PLATFORMS.map((platform) => {
                const urlValue = settings[platform.key] || '';
                const isConfigured = Boolean(urlValue.trim());

                return (
                  <div key={platform.key} className="space-y-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg ${platform.colorClasses.badgeBg} ${platform.colorClasses.text}`}>
                          <SocialIcon platform={platform.platform} className="w-4 h-4" />
                        </span>
                        <label className="text-sm font-semibold text-slate-800">
                          {platform.label}
                        </label>
                      </div>
                      {isConfigured && (
                        <a
                          href={urlValue}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
                          title="Preview profile link in new tab"
                        >
                          <span>Test</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <input
                      type="url"
                      name={platform.key}
                      value={urlValue}
                      onChange={handleChange}
                      className="input-field w-full text-sm"
                      placeholder={platform.placeholder}
                    />
                    <p className="text-[11px] text-slate-400">
                      {isConfigured ? 'Active on website' : 'Unconfigured (hidden from visitors)'}
                    </p>
                  </div>
                );
              })}
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
