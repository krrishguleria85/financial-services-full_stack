import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Mail, Phone, MapPin, MessageCircle } from 'lucide-react';
import api from '../../lib/api';
import { SOCIAL_PLATFORMS, SocialIcon } from '../common/SocialIcons';

const Footer = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        setSettings(res.data);
      } catch (error) {
        console.error('Failed to load settings', error);
      }
    };
    fetchSettings();
  }, []);

  const configuredSocials = SOCIAL_PLATFORMS.filter(
    (p) => Boolean(settings[p.key]?.trim())
  );

  return (
    <footer className="bg-slate-900 text-slate-300 py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2 text-white">
              <Shield className="h-8 w-8 text-primary-500" />
              <span className="font-bold text-xl">{settings.businessName && settings.businessName !== 'Your Business Name' ? settings.businessName : 'Rajesh Guleria'}</span>
            </Link>
            <p className="text-sm text-slate-400">
              {settings.businessDescription || 'Professional assistance for Insurance, Tax & GST Services.'}
            </p>

            {/* Configured Social Profiles */}
            {configuredSocials.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2.5">
                  Follow Us
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {configuredSocials.map((platform) => {
                    const url = settings[platform.key]?.trim();
                    return (
                      <a
                        key={platform.key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Follow on ${platform.label}`}
                        title={platform.label}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 border border-slate-700/80 bg-slate-800/80 hover:scale-105 hover:border-amber-400/50 ${platform.colorClasses.hoverBg} text-slate-300 hover:text-white`}
                      >
                        <SocialIcon platform={platform.platform} className="w-4 h-4" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/services" className="hover:text-white transition-colors">Services</Link></li>
              <li><Link to="/track" className="hover:text-white transition-colors">Track Request</Link></li>
              <li><Link to="/channel" className="hover:text-white transition-colors">YouTube Channel</Link></li>
              <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Legal & Disclaimer */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm mb-4">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
            <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 text-xs">
              <strong>Disclaimer:</strong> {settings.disclaimer || 'This website provides professional assistance and consultation services. It is not an official website of LIC, the Income Tax Department, GST Portal, or any government authority.'}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3 text-sm">
              {settings.phone && (
                <li className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-slate-500 shrink-0" />
                  <span>{settings.phone}</span>
                </li>
              )}
              {settings.email && (
                <li className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-slate-500 shrink-0" />
                  <span>{settings.email}</span>
                </li>
              )}
              {settings.whatsapp && (
                <li className="flex items-start gap-3">
                  <MessageCircle className="w-5 h-5 text-green-500 shrink-0" />
                  <span>{settings.whatsapp}</span>
                </li>
              )}
              {settings.address && (
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-slate-500 shrink-0" />
                  <span>{settings.address}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-slate-800 text-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1">
            <span>{settings.footerText || `© ${new Date().getFullYear()} Your Business Name. All rights reserved.`}</span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="inline-flex items-center flex-wrap gap-1.5 text-slate-400">
              Made by:{' '}
              <span className="text-slate-200 font-medium">Krrish Guleria</span>
              <span className="text-slate-600 mx-0.5">•</span>
              <a
                href="https://www.linkedin.com/in/krrishguleria/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2 transition-colors inline-flex items-center gap-0.5"
              >
                Connect on LinkedIn
              </a>
            </span>
          </p>
          {configuredSocials.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 mr-1">Socials:</span>
              {configuredSocials.map((platform) => {
                const url = settings[platform.key]?.trim();
                return (
                  <a
                    key={platform.key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={platform.label}
                    title={platform.label}
                    className="p-1.5 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                  >
                    <SocialIcon platform={platform.platform} className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
