import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, FileText, Calculator, Building, MessageCircle, HeartPulse } from 'lucide-react';
import api from '../lib/api';
import type { Service, YouTubeVideo } from '../types';

const HomePage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [services, setServices] = useState<Service[]>([]);
  // Testimonials placeholder for future use
  // const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [feedVideos, setFeedVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsRes, servicesRes, _testimonialsRes, videosRes, feedRes] = await Promise.all([
          api.get('/settings'),
          api.get('/services'),
          api.get('/videos'),
          api.get('/videos'), // Dummy call since testimonials is commented out or we just rearrange
          fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=UCKV2OmS9KmhRUzeMd4g46Dg&_=' + new Date().getTime())}`).then(res => res.json())
        ]);
        setSettings(settingsRes.data);
        setServices(servicesRes.data.slice(0, 6)); // Top 6 services
        setVideos(videosRes.data.slice(0, 3));
        if (feedRes.status === 'ok') {
          setFeedVideos(feedRes.items || []);
        }
      } catch (error) {
        console.error('Error fetching home data', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'FileText': return <FileText className="w-8 h-8 text-primary-600" />;
      case 'Calculator': return <Calculator className="w-8 h-8 text-primary-600" />;
      case 'Building': return <Building className="w-8 h-8 text-primary-600" />;
      case 'Shield': return <ShieldCheck className="w-8 h-8 text-primary-600" />;
      case 'HeartPulse': return <HeartPulse className="w-8 h-8 text-red-500" />;
      default: return <MessageCircle className="w-8 h-8 text-primary-600" />;
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const deadlineColors = [
    { bg: 'from-amber-500/20 to-orange-600/20', border: 'border-amber-500/30', shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]', dot: 'bg-amber-500', ping: 'bg-amber-400', text: 'text-amber-50' },
    { bg: 'from-emerald-500/20 to-cyan-500/20', border: 'border-emerald-500/30', shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]', dot: 'bg-emerald-500', ping: 'bg-emerald-400', text: 'text-emerald-50' },
    { bg: 'from-blue-500/20 to-indigo-600/20', border: 'border-blue-500/30', shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.2)]', dot: 'bg-blue-500', ping: 'bg-blue-400', text: 'text-blue-50' },
    { bg: 'from-rose-500/20 to-pink-600/20', border: 'border-rose-500/30', shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.2)]', dot: 'bg-rose-500', ping: 'bg-rose-400', text: 'text-rose-50' },
  ];

  return (
    <div className="flex flex-col">
      {/* Deadlines Marquee */}
      {settings.deadlinesMarquee && (
        <div className="bg-slate-950 border-b border-white/10 overflow-hidden relative z-20 py-3 flex items-center shadow-inner">
          <div className="whitespace-nowrap animate-marquee inline-block">
            <div className="flex items-center gap-24 md:gap-48 px-4">
              {settings.deadlinesMarquee.split(/[•|]/).filter(Boolean).map((deadline, idx) => {
                const color = deadlineColors[idx % deadlineColors.length];
                return (
                  <div key={idx} className={`inline-flex items-center gap-3 bg-gradient-to-r ${color.bg} border ${color.border} px-6 py-2 rounded-full ${color.shadow} backdrop-blur-sm`}>
                    <span className="relative flex h-3 w-3">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color.ping} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${color.dot}`}></span>
                    </span>
                    <span className={`${color.text} font-bold tracking-wide text-sm md:text-base uppercase`}>
                      {deadline.trim()}
                    </span>
                  </div>
                );
              })}
              {/* Duplicate for seamless visual flow if needed */}
              {settings.deadlinesMarquee.split(/[•|]/).filter(Boolean).map((deadline, idx) => {
                const color = deadlineColors[idx % deadlineColors.length];
                return (
                  <div key={`dup-${idx}`} className={`hidden md:inline-flex items-center gap-3 bg-gradient-to-r ${color.bg} border ${color.border} px-6 py-2 rounded-full ${color.shadow} backdrop-blur-sm`}>
                    <span className="relative flex h-3 w-3">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color.ping} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${color.dot}`}></span>
                    </span>
                    <span className={`${color.text} font-bold tracking-wide text-sm md:text-base uppercase`}>
                      {deadline.trim()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 to-primary-900 text-white py-20 lg:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-blue-900/50 text-blue-200 border border-blue-700/50 px-4 py-2 rounded-full font-medium">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              Authorized Star Health Insurance Agent
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              Your Trusted Partner for <span className="text-gold-500">Star Health Insurance, Tax & GST</span> Services
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl">
              Professional assistance for Star Health Insurance, LIC, Income Tax Returns, GST and financial documentation. Reliable, secure, and hassle-free.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link to="/book-appointment" className="btn bg-gold-500 hover:bg-gold-600 text-white px-6 py-3 text-lg font-semibold shadow-lg">
                Book Consultation
              </Link>
              <a href="https://www.youtube.com/@rajeshguleria1973" target="_blank" rel="noopener noreferrer" className="btn bg-red-600 hover:bg-red-700 text-white px-6 py-3 text-lg font-semibold shadow-lg flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> Dance Channel
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="btn bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 text-lg font-semibold shadow-lg flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg> Instagram
              </a>
            </div>
          </div>
          <div className="hidden lg:block relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary-500 to-gold-500 rounded-2xl blur-2xl opacity-30 transform rotate-6"></div>
            <img 
              src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=1000" 
              alt="Financial Planning" 
              className="relative rounded-2xl shadow-2xl object-cover h-[500px] w-full border border-white/10"
            />
          </div>
        </div>
      </section>

      {/* Social Media Highlight */}
      <section className="bg-slate-900 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold text-white mb-2">Beyond Finance: My Passion for Dance</h3>
              <p className="text-slate-400 max-w-2xl">
                When I'm not helping you with ITR, GST, and Insurance, I'm expressing myself through dance. 
                Join my journey and check out my performances! Users can choose their path—finance or dance!
              </p>
            </div>
            <div className="flex flex-shrink-0 gap-4">
              <a 
                href="https://www.youtube.com/@rajeshguleria1973" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/50 px-6 py-3 rounded-xl font-bold transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                Subscribe
              </a>
              <a 
                href="https://www.instagram.com/guleria2877?stkn=MXQ5enFwazA1MHdxdw==" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2 bg-pink-600/10 hover:bg-pink-600/20 text-pink-500 border border-pink-500/50 px-6 py-3 rounded-xl font-bold transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                Follow
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-slate-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Professional Services</h2>
            <p className="text-lg text-slate-600">Expert assistance tailored to your financial and tax compliance needs.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service) => (
              <div key={service.id} className="card p-8 hover:-translate-y-1 transition-transform duration-300 group cursor-pointer" onClick={() => navigate(`/services/${service.slug}`)}>
                <div className="bg-primary-50 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {getIcon(service.icon)}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{service.name}</h3>
                <p className="text-slate-600 mb-6 line-clamp-3">{service.description}</p>
                <div className="flex items-center text-primary-600 font-semibold group-hover:gap-2 transition-all">
                  <span>Learn More</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-lg text-slate-600">A simple, transparent process to get your financial tasks done.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: 'Choose Service', desc: 'Select the service you need assistance with.' },
              { title: 'Submit Request', desc: 'Fill out a simple form with basic details.' },
              { title: 'Upload Documents', desc: 'Securely upload required documents.' },
              { title: 'Get Updates', desc: 'Track your request status online.' }
            ].map((step, idx) => (
              <div key={idx} className="relative p-6 text-center">
                <div className="w-12 h-12 mx-auto bg-primary-100 text-primary-700 font-bold rounded-full flex items-center justify-center mb-4 text-xl relative z-10">
                  {idx + 1}
                </div>
                {idx < 3 && <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] h-[2px] bg-primary-100 -z-0"></div>}
                <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* YouTube Section */}
      {videos.length > 0 && (
        <section className="py-20 bg-slate-900 text-white px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-end mb-12 border-b border-slate-800 pb-6">
              <div>
                <h2 className="text-3xl font-bold mb-2">Latest Videos & Performances</h2>
                <p className="text-slate-400">Watch our latest videos spanning taxation, insurance, and my dance performances.</p>
              </div>
              <Link to="/channel" className="hidden sm:flex items-center text-primary-400 hover:text-primary-300 font-medium">
                View Channel <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Financial Videos */}
              <div>
                <h3 className="text-2xl font-bold mb-6 text-primary-400">Professional Insights</h3>
                <div className="space-y-6">
                  {videos.map(video => (
                    <a key={video.id} href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="group flex gap-4 bg-slate-800/50 hover:bg-slate-800 p-3 rounded-xl transition-colors items-center">
                      <div className="relative aspect-video w-40 flex-shrink-0 rounded-lg overflow-hidden bg-slate-900">
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt={video.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">No thumb</div>
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">Watch</div>
                      </div>
                      <div>
                        <h4 className="font-bold text-base line-clamp-2 group-hover:text-primary-400 transition-colors">{video.title}</h4>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
              
              {/* Dance Videos & Socials */}
              <div>
                <h3 className="text-2xl font-bold mb-6 text-pink-400">Vlogs, Dance & Creative Shorts</h3>
                <div className="grid grid-cols-2 gap-4">
                   {feedVideos.slice(0, 2).map((item, idx) => {
                     const isShort = item.link.includes('/shorts/');
                     return (
                       <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className={`block relative bg-slate-800 rounded-xl overflow-hidden group shadow-lg ${isShort ? 'aspect-[9/16]' : 'aspect-video'}`}>
                          <img src={item.thumbnail} alt={item.title} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-12 h-12 mb-3 text-red-500 group-hover:scale-110 transition-transform drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                          </div>
                          <div className="absolute bottom-0 inset-x-0 p-3">
                            <h4 className="text-white text-xs font-bold line-clamp-2 drop-shadow-md">{item.title}</h4>
                          </div>
                       </a>
                     );
                   })}
                   
                   {/* Fallback if no videos are found */}
                   {feedVideos.length === 0 && (
                     <div className="col-span-2 text-slate-500 text-sm py-8 text-center bg-slate-800/30 rounded-xl border border-slate-700/50">
                       Loading latest shorts...
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-primary-600 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold text-white">Need help with your ITR, GST or insurance requirements?</h2>
          <p className="text-xl text-primary-100">Our experts are ready to assist you. Book a consultation today.</p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link to="/book-appointment" className="btn bg-white text-primary-700 hover:bg-slate-50 px-8 py-3 text-lg font-bold shadow-lg">
              Book Appointment
            </Link>
            {settings.whatsapp && (
              <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn bg-green-500 hover:bg-green-600 text-white px-8 py-3 text-lg font-bold shadow-lg">
                WhatsApp Us
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
