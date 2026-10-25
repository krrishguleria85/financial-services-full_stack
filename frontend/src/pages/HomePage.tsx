import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Shield, FileText, Calculator, Building, MessageCircle, HeartPulse, Award, Calendar, ChevronRight, Users, TrendingUp, Headphones } from 'lucide-react';
import api from '../lib/api';
import type { Service, YouTubeVideo } from '../types';
import DeadlineTicker from '../components/home/DeadlineTicker';
import { SOCIAL_PLATFORMS, SocialIcon } from '../components/common/SocialIcons';

const HomePage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [services, setServices] = useState<Service[]>([]);
  // Testimonials placeholder for future use
  // const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [feedVideos, setFeedVideos] = useState<any[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsRes, servicesRes, videosRes, feedRes] = await Promise.all([
          api.get('/settings').catch(() => ({ data: {} })),
          api.get('/services').catch(() => ({ data: [] })),
          api.get('/videos').catch(() => ({ data: [] })),
          api.get('/videos/feed').catch((err) => {
            console.warn('Failed to load YouTube feed from backend:', err);
            return { data: { status: 'error', items: [] } };
          }),
        ]);
        setSettings(settingsRes.data || {});
        setServices((servicesRes.data || []).slice(0, 6)); // Top 6 services
        setVideos((videosRes.data || []).slice(0, 3));

        const feedItems = feedRes?.data?.items || (Array.isArray(feedRes?.data) ? feedRes.data : []);
        if (Array.isArray(feedItems) && feedItems.length > 0) {
          setFeedVideos(feedItems);
          setFeedError(null);
        } else if (feedRes?.data?.status === 'error') {
          setFeedError('Unable to load latest shorts');
        }
      } catch (error) {
        console.error('Error fetching home data', error);
      } finally {
        setIsFeedLoading(false);
      }
    };
    fetchData();
  }, []);

  const configuredDanceSocials = SOCIAL_PLATFORMS.filter((platform) =>
    Boolean(settings[platform.key]?.trim())
  );

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

  // Non-blocking loading allows immediate render of hero and assets

  return (
    <div className="flex flex-col">
      {/* Animated Deadline Ticker */}
      <DeadlineTicker marqueeText={settings.deadlinesMarquee} />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#040e20] via-[#081a38] to-[#040e20] text-white py-4 sm:py-6 lg:py-6 xl:py-8 px-4 sm:px-6 lg:px-8 overflow-hidden relative lg:min-h-[calc(100vh-5rem)] lg:flex lg:flex-col lg:justify-center">
        {/* Subtle Luxury Ambient Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[550px] bg-gradient-to-tr from-amber-500/10 via-blue-600/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-[1440px] mx-auto w-full">
          
          {/* Desktop 3-Column Composition (Matches exact 34% / 42% / 24% Reference Layout) */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-5 xl:gap-6 items-stretch">
            
            {/* Column 1 — Left: Text and Calls to Action (~34% Width) */}
            <div className="lg:col-span-4 xl:col-span-4 h-[560px] lg:h-[580px] xl:h-[600px] flex flex-col justify-between py-1">
              
              {/* Authorized Agent Badges with Official Logos and Chevrons */}
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 bg-blue-950/80 text-blue-100 border border-blue-500/40 px-3 py-1.5 rounded-full font-medium text-xs xl:text-sm backdrop-blur-sm shadow-sm group">
                  <div className="w-5 h-5 rounded bg-white p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                    <img src="/logos/lic.jpg" alt="LIC" className="w-full h-full object-contain" />
                  </div>
                  <span>Authorized LIC Agent</span>
                  <ChevronRight className="w-3.5 h-3.5 text-blue-300/80 group-hover:translate-x-0.5 transition-transform" />
                </div>

                <div className="inline-flex items-center gap-2 bg-blue-950/80 text-blue-100 border border-blue-500/40 px-3 py-1.5 rounded-full font-medium text-xs xl:text-sm backdrop-blur-sm shadow-sm group">
                  <div className="w-5 h-5 rounded bg-white p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                    <img src="/logos/star-health.png" alt="Star Health" className="w-full h-full object-contain" />
                  </div>
                  <span>Authorized Star Health Insurance Agent</span>
                  <ChevronRight className="w-3.5 h-3.5 text-blue-300/80 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Main Headline */}
              <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-tight leading-[1.15]">
                Your Trusted Partner for <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">LIC, Star Health Insurance, Tax & GST</span> Services
              </h1>

              {/* Description */}
              <p className="text-xs sm:text-sm xl:text-[15px] text-slate-300 leading-relaxed">
                Professional assistance for Star Health Insurance, LIC, Income Tax Returns, GST and financial documentation. Reliable, secure, and hassle-free.
              </p>

              {/* 4 Service Buttons (2x2 Grid with Logos & Chevrons) */}
              <div className="grid grid-cols-2 gap-2.5 xl:gap-3 pt-0.5">
                
                {/* 1. LIC Policies */}
                <Link
                  to="/services/lic-insurance-services?request=true"
                  className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white p-2 xl:p-2.5 rounded-xl shadow-lg shadow-amber-950/40 flex items-center justify-between gap-1.5 transition-all hover:scale-[1.02] border border-amber-400/40 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                      <img
                        src="/logos/lic.jpg"
                        alt="LIC Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="font-bold text-xs xl:text-sm truncate">LIC Policies</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-white/80 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>

                {/* 2. Star Health Plans */}
                <Link
                  to="/services/star-health-insurance?request=true"
                  className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white p-2 xl:p-2.5 rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-between gap-1.5 transition-all hover:scale-[1.02] border border-emerald-400/40 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                      <img
                        src="/logos/star-health.png"
                        alt="Star Health Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="font-bold text-xs xl:text-sm truncate">Star Health Plans</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-white/80 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>

                {/* 3. File Your ITR */}
                <Link
                  to="/services/itr-filing-assistance?request=true"
                  className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white p-2 xl:p-2.5 rounded-xl shadow-lg shadow-blue-950/40 flex items-center justify-between gap-1.5 transition-all hover:scale-[1.02] border border-blue-400/40 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                      <img
                        src="/logos/income.png"
                        alt="Income Tax Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="font-bold text-xs xl:text-sm truncate">File Your ITR</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-white/80 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>

                {/* 4. Book Consultation */}
                <Link
                  to="/book-appointment"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white p-2 xl:p-2.5 rounded-xl shadow-lg shadow-orange-950/40 flex items-center justify-between gap-1.5 transition-all hover:scale-[1.02] border border-amber-300/40 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-lg bg-white/20 backdrop-blur-sm p-1 flex items-center justify-center shrink-0 shadow-sm">
                      <Calendar className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-white" />
                    </div>
                    <span className="font-bold text-xs xl:text-sm whitespace-nowrap">Book Consultation</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-white/80 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>

              </div>

              {/* Bottom Trophy Achievement Strip */}
              <div className="pt-1">
                <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/50 border border-amber-500/40 px-3.5 py-2.5 rounded-xl shadow-md backdrop-blur-sm group hover:border-amber-400/70 transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                      <Award className="w-4.5 h-4.5 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] xl:text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span>LIC ZM'S TROPHY 2026</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span className="text-slate-100">NORTH ZONE</span>
                      </div>
                      <p className="text-[10px] xl:text-[11px] text-slate-300 truncate">
                        Conferred by Life Insurance Corporation of India
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-amber-400 transition-all shrink-0" />
                </div>
              </div>

            </div>

            {/* Column 2 — Center: Main Portrait (~42% Width, Dominant Visual Anchor) */}
            <div className="lg:col-span-5 xl:col-span-5 flex flex-col">
              <div className="relative w-full h-[560px] lg:h-[580px] xl:h-[600px] rounded-2xl xl:rounded-3xl overflow-hidden border-2 border-amber-400/60 shadow-2xl shadow-slate-950/95 bg-slate-900 flex flex-col justify-end group">
                {/* Person fully seated in ornate chair (head, body, crossed legs, shoes, chair, mirror) */}
                <img
                  src="/images/main-portrait-focus.jpg"
                  alt="Rajesh Guleria - Financial and Insurance Consultant"
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  loading="eager"
                />
                
                {/* Refined Dark-Navy Bottom Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent pointer-events-none" />

                {/* 100% Unobstructed Labels Inside Bottom of Card */}
                <div className="relative z-10 p-4 sm:p-5 xl:p-6 text-white bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
                  <div className="inline-block px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] xl:text-xs font-bold tracking-widest uppercase mb-1">
                    LIC & FINANCIAL SERVICES
                  </div>
                  <h3 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
                    Rajesh Guleria
                  </h3>
                  <p className="text-xs sm:text-sm xl:text-base text-slate-300 font-medium mt-0.5">
                    Financial & Insurance Consultant
                  </p>

                  {/* 3 Mini Trust Signals matching sample reference */}
                  <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-white/10 text-center">
                    <div className="flex flex-col items-center">
                      <Users className="w-4 h-4 text-amber-400 mb-1" />
                      <span className="text-[10px] xl:text-xs font-bold text-slate-100 leading-tight">Trusted Guidance</span>
                    </div>
                    <div className="flex flex-col items-center border-x border-white/10 px-1">
                      <ShieldCheck className="w-4 h-4 text-amber-400 mb-1" />
                      <span className="text-[10px] xl:text-xs font-bold text-slate-100 leading-tight">Personalized Solutions</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <TrendingUp className="w-4 h-4 text-amber-400 mb-1" />
                      <span className="text-[10px] xl:text-xs font-bold text-slate-100 leading-tight">Long-Term Financial Support</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3 — Right: Recognition & Awards Rail (~24% Width) */}
            <div className="lg:col-span-3 xl:col-span-3 h-[560px] lg:h-[580px] xl:h-[600px] flex flex-col justify-between gap-2.5 overflow-hidden">
              
              {/* Top Photo Card: Group Trophy Milestone */}
              <div className="h-[148px] xl:h-[158px] bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/40 p-2 shadow-xl shadow-slate-950/80 flex flex-col justify-between hover:border-amber-400/70 transition-all group shrink-0 overflow-hidden">
                <div className="relative w-full h-[102px] xl:h-[110px] rounded-xl overflow-hidden bg-slate-950 border border-white/10">
                  <img
                    src="/images/lic-milestone.jpg"
                    alt="A Proud LIC Milestone"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    style={{ objectPosition: 'center 18%' }}
                    loading="eager"
                  />
                </div>
                <div className="pt-1 pb-0.5 px-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                      <Award className="w-3 h-3 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs xl:text-sm font-bold text-amber-200 tracking-wide truncate">
                        A Proud LIC Milestone
                      </span>
                      <span className="block text-[10px] xl:text-[11px] text-slate-300 font-medium leading-none">
                        Chandigarh
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </div>

              {/* Middle Photo Card: Presentation Ceremony */}
              <div className="h-[148px] xl:h-[158px] bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/40 p-2 shadow-xl shadow-slate-950/80 flex flex-col justify-between hover:border-amber-400/70 transition-all group shrink-0 overflow-hidden">
                <div className="relative w-full h-[102px] xl:h-[110px] rounded-xl overflow-hidden bg-slate-950 border border-white/10">
                  <img
                    src="/images/lic-presentation.jpg"
                    alt="LIC Recognition"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    style={{ objectPosition: 'center 34%' }}
                    loading="eager"
                  />
                </div>
                <div className="pt-1 pb-0.5 px-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                      <Award className="w-3 h-3 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs xl:text-sm font-bold text-amber-200 tracking-wide truncate">
                        LIC Recognition
                      </span>
                      <span className="block text-[10px] xl:text-[11px] text-slate-300 font-medium leading-none">
                        Chandigarh
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </div>

              {/* Bottom Row: 2 Separate Award Cards Side-by-Side */}
              <div className="flex-1 min-h-0 grid grid-cols-2 gap-2.5 overflow-hidden">
                
                {/* Card A: LIC 70 Years Emblem */}
                <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/40 p-2 shadow-xl shadow-slate-950/80 flex flex-col items-center justify-center text-center hover:border-amber-400/70 transition-all overflow-hidden">
                  <div className="w-14 h-14 xl:w-16 xl:h-16 rounded-full bg-slate-950 p-1 border-2 border-amber-400/50 overflow-hidden shrink-0 shadow-inner flex items-center justify-center">
                    <img
                      src="/images/lic-70-years.png"
                      alt="LIC 70 Years Anniversary"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="block text-xs xl:text-sm font-extrabold text-amber-400 uppercase tracking-wider mt-2">
                    70 YEARS
                  </span>
                  <span className="block text-[9px] xl:text-[10px] text-slate-300 font-medium leading-tight mt-0.5">
                    Our Journey, Your Trust
                  </span>
                </div>

                {/* Card B: LIC ZM's Trophy 2026 */}
                <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/40 p-2 shadow-xl shadow-slate-950/80 flex flex-col justify-between hover:border-amber-400/70 transition-all overflow-hidden">
                  <div className="relative w-full flex-1 min-h-0 rounded-xl overflow-hidden bg-gradient-to-b from-slate-800/60 via-slate-900/90 to-slate-950 flex items-center justify-center p-1.5 border border-white/5">
                    <img
                      src="/images/trophy-cutout.png"
                      alt="LIC ZM's Trophy 2026 - North Zone"
                      className="h-full w-auto max-w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)] filter contrast-105"
                      loading="eager"
                    />
                  </div>
                  <div className="pt-1.5 pb-0.5 text-center border-t border-amber-500/20 shrink-0">
                    <span className="block text-[10px] xl:text-[11px] font-bold text-amber-300 truncate">
                      LIC ZM's Trophy 2026
                    </span>
                    <span className="block text-[8px] xl:text-[9px] text-slate-200 uppercase tracking-wider font-semibold">
                      North Zone
                    </span>
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* Bottom Value Proposition Ribbon (Compact, Elegant, and High-Readability) */}
          <div className="hidden lg:block mt-3.5 xl:mt-4 bg-gradient-to-r from-slate-950/90 via-slate-900/95 to-slate-950/90 border border-amber-500/30 rounded-xl px-4 py-2.5 shadow-lg backdrop-blur-md">
            <div className="grid grid-cols-4 gap-3 divide-x divide-white/10 items-center">
              
              {/* 1. Insurance Solutions */}
              <div className="flex items-center gap-2.5 pr-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs xl:text-[13px] font-bold text-white truncate">Comprehensive Insurance Solutions</h4>
                  <p className="text-[10px] xl:text-[11px] text-slate-300 truncate">LIC, Star Health & more</p>
                </div>
              </div>

              {/* 2. Tax & GST Support */}
              <div className="flex items-center gap-2.5 px-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs xl:text-[13px] font-bold text-white truncate">Tax & GST Support</h4>
                  <p className="text-[10px] xl:text-[11px] text-slate-300 truncate">ITR Filing, GST Assistance</p>
                </div>
              </div>

              {/* 3. Personalized Consultation */}
              <div className="flex items-center gap-2.5 px-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs xl:text-[13px] font-bold text-white truncate">Personalized Consultation</h4>
                  <p className="text-[10px] xl:text-[11px] text-slate-300 truncate">Solutions for You & Your Family</p>
                </div>
              </div>

              {/* 4. Reliable Service */}
              <div className="flex items-center gap-2.5 pl-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
                  <Headphones className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs xl:text-[13px] font-bold text-white truncate">Reliable & Hassle-Free Service</h4>
                  <p className="text-[10px] xl:text-[11px] text-slate-300 truncate">End-to-End Support</p>
                </div>
              </div>

            </div>
          </div>

          {/* Mobile / Tablet Responsive Stack (Ordered 1 -> 2 -> 3 -> 4) */}
          <div className="block lg:hidden space-y-6 max-w-lg mx-auto">
            
            {/* 1. Heading, Description, Service Buttons, Trophy Strip */}
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 bg-blue-950/80 text-blue-100 border border-blue-500/40 px-3 py-1.5 rounded-full font-medium text-xs">
                  <div className="w-4 h-4 rounded bg-white p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                    <img src="/logos/lic.jpg" alt="LIC" className="w-full h-full object-contain" />
                  </div>
                  <span>Authorized LIC Agent</span>
                  <ChevronRight className="w-3.5 h-3.5 text-blue-300/80" />
                </div>
                <div className="inline-flex items-center gap-2 bg-blue-950/80 text-blue-100 border border-blue-500/40 px-3 py-1.5 rounded-full font-medium text-xs">
                  <div className="w-4 h-4 rounded bg-white p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                    <img src="/logos/star-health.png" alt="Star Health" className="w-full h-full object-contain" />
                  </div>
                  <span>Authorized Star Health Insurance Agent</span>
                  <ChevronRight className="w-3.5 h-3.5 text-blue-300/80" />
                </div>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
                Your Trusted Partner for <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">LIC, Star Health Insurance, Tax & GST</span> Services
              </h1>

              <p className="text-sm text-slate-300 leading-relaxed">
                Professional assistance for Star Health Insurance, LIC, Income Tax Returns, GST and financial documentation. Reliable, secure, and hassle-free.
              </p>

              {/* 4 Service Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <Link
                  to="/services/lic-insurance-services?request=true"
                  className="bg-gradient-to-r from-amber-600 to-amber-500 text-white p-3 rounded-xl shadow-md flex items-center justify-between border border-amber-400/40"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white p-1 shrink-0 overflow-hidden">
                      <img src="/logos/lic.jpg" alt="LIC" className="w-full h-full object-contain" />
                    </div>
                    <span className="font-bold text-sm">LIC Policies</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/80" />
                </Link>

                <Link
                  to="/services/star-health-insurance?request=true"
                  className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-3 rounded-xl shadow-md flex items-center justify-between border border-emerald-400/40"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white p-1 shrink-0 overflow-hidden">
                      <img src="/logos/star-health.png" alt="Star Health" className="w-full h-full object-contain" />
                    </div>
                    <span className="font-bold text-sm">Star Health Plans</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/80" />
                </Link>

                <Link
                  to="/services/itr-filing-assistance?request=true"
                  className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-3 rounded-xl shadow-md flex items-center justify-between border border-blue-400/40"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white p-1 shrink-0 overflow-hidden">
                      <img src="/logos/income.png" alt="Income Tax" className="w-full h-full object-contain" />
                    </div>
                    <span className="font-bold text-sm">File Your ITR</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/80" />
                </Link>

                <Link
                  to="/book-appointment"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3 rounded-xl shadow-md flex items-center justify-between border border-amber-300/40"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/20 p-1.5 shrink-0 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-sm">Book Consultation</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/80" />
                </Link>
              </div>

              {/* Trophy Highlight Strip */}
              <div className="flex items-center justify-between gap-2.5 bg-slate-900/90 border border-amber-500/40 px-3.5 py-2.5 rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>LIC ZM'S TROPHY 2026</span>
                      <span className="w-1 h-1 rounded-full bg-amber-400" />
                      <span className="text-slate-100">NORTH ZONE</span>
                    </div>
                    <p className="text-[10px] text-slate-300 truncate">
                      Conferred by Life Insurance Corporation of India
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            </div>

            {/* 2. Main Portrait (Large, Clear, Unobstructed) */}
            <div className="relative w-full h-[480px] sm:h-[520px] rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-2xl bg-slate-900 flex flex-col justify-end">
              <img
                src="/images/main-portrait-focus.jpg"
                alt="Rajesh Guleria - Financial and Insurance Consultant"
                className="absolute inset-0 w-full h-full object-cover object-top"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent pointer-events-none" />

              <div className="relative z-10 p-5 text-white bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold tracking-widest uppercase mb-1.5">
                  LIC & FINANCIAL SERVICES
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">
                  Rajesh Guleria
                </h3>
                <p className="text-xs text-slate-300 font-medium">
                  Financial & Insurance Consultant
                </p>

                {/* 3 Mini Trust Signals */}
                <div className="grid grid-cols-3 gap-2 pt-2.5 mt-2.5 border-t border-white/10 text-center">
                  <div className="flex flex-col items-center">
                    <Users className="w-3.5 h-3.5 text-amber-400 mb-0.5" />
                    <span className="text-[9px] font-bold text-slate-100 leading-tight">Trusted Guidance</span>
                  </div>
                  <div className="flex flex-col items-center border-x border-white/10 px-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400 mb-0.5" />
                    <span className="text-[9px] font-bold text-slate-100 leading-tight">Personalized Solutions</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400 mb-0.5" />
                    <span className="text-[9px] font-bold text-slate-100 leading-tight">Long-Term Support</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Recognition Photographs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/40 p-2 shadow-xl flex flex-col justify-between">
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-white/10">
                  <img
                    src="/images/lic-milestone.jpg"
                    alt="A Proud LIC Milestone"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: 'center 18%' }}
                    loading="eager"
                  />
                </div>
                <div className="pt-2 pb-0.5 text-center">
                  <span className="block text-xs font-bold text-amber-200">
                    A Proud LIC Milestone
                  </span>
                  <span className="block text-[10px] text-slate-300">
                    Chandigarh
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/40 p-2 shadow-xl flex flex-col justify-between">
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-white/10">
                  <img
                    src="/images/lic-presentation.jpg"
                    alt="LIC Recognition"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: 'center 34%' }}
                    loading="eager"
                  />
                </div>
                <div className="pt-2 pb-0.5 text-center">
                  <span className="block text-xs font-bold text-amber-200">
                    LIC Recognition
                  </span>
                  <span className="block text-[10px] text-slate-300">
                    Chandigarh
                  </span>
                </div>
              </div>
            </div>

            {/* 4. LIC 70 Years Emblem and Trophy */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/40 p-2.5 shadow-xl flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-slate-950 p-1 border-2 border-amber-400/50 overflow-hidden shrink-0 shadow-inner">
                  <img
                    src="/images/lic-70-years.png"
                    alt="LIC 70 Years"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="block text-xs font-extrabold text-amber-400 uppercase tracking-wider mt-2">
                  70 YEARS
                </span>
                <span className="block text-[10px] text-slate-300 font-medium leading-tight mt-0.5">
                  Our Journey, Your Trust
                </span>
              </div>

              <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/40 p-2 shadow-xl flex flex-col justify-between">
                <div className="relative w-full h-[120px] rounded-xl overflow-hidden bg-gradient-to-b from-slate-800/60 to-slate-950 flex items-center justify-center p-1 border border-white/5">
                  <img
                    src="/images/trophy-cutout.png"
                    alt="LIC ZM's Trophy 2026 - North Zone"
                    className="h-full w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)]"
                    loading="eager"
                  />
                </div>
                <div className="pt-1.5 text-center border-t border-amber-500/20">
                  <span className="block text-[11px] font-bold text-amber-300">
                    LIC ZM's Trophy 2026
                  </span>
                  <span className="block text-[9px] text-slate-200 uppercase tracking-wider font-semibold">
                    North Zone
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Mobile Value Proposition Ribbon (Neat 2x2 Grid) */}
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-2.5 shadow-lg">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-1">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-bold text-white truncate">Insurance Solutions</h4>
                    <p className="text-[9px] text-slate-300 truncate">LIC & Star Health</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-1 border-l border-white/10 pl-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-bold text-white truncate">Tax & GST Support</h4>
                    <p className="text-[9px] text-slate-300 truncate">ITR & GST Help</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-1 border-t border-white/10 pt-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-bold text-white truncate">Consultation</h4>
                    <p className="text-[9px] text-slate-300 truncate">For You & Family</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-1 border-t border-l border-white/10 pt-2 pl-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
                    <Headphones className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-bold text-white truncate">Reliable Service</h4>
                    <p className="text-[9px] text-slate-300 truncate">End-to-End Support</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Social Media Highlight */}
      <section className="bg-slate-900 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-3">
                Creative Expression & Passion
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
                Beyond Finance: <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">My Passion for Dance</span>
              </h3>
              <p className="text-slate-400 max-w-2xl text-sm sm:text-base">
                When I'm not helping you with ITR, GST, and Insurance, I'm expressing myself through dance.
                Join my journey and check out my creative performances, vlogs, and shorts across my profiles!
              </p>
            </div>
            {configuredDanceSocials.length > 0 && (
              <div className="flex flex-wrap items-center justify-center lg:justify-end gap-3 flex-shrink-0">
                {configuredDanceSocials.map((platform) => {
                  const url = settings[platform.key]?.trim();
                  return (
                    <a
                      key={platform.key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all transform hover:-translate-y-0.5 shadow-md ${platform.colorClasses.badgeBg} ${platform.colorClasses.text} border ${platform.colorClasses.border} ${platform.colorClasses.hoverBg}`}
                    >
                      <SocialIcon platform={platform.platform} className="w-4 h-4 flex-shrink-0" />
                      <span>{platform.buttonText}</span>
                    </a>
                  );
                })}
              </div>
            )}
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
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-pink-400">Vlogs, Dance & Creative Shorts</h3>
                  <a
                    href={settings.youtubeChannelUrl || 'https://www.youtube.com/@rajeshguleria1973'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1"
                  >
                    <span>Visit Channel</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                {isFeedLoading ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="aspect-[9/16] bg-slate-800/60 rounded-xl animate-pulse border border-slate-700/50 flex flex-col justify-end p-3">
                      <div className="h-3 w-3/4 bg-slate-700/60 rounded mb-2" />
                      <div className="h-2 w-1/2 bg-slate-700/40 rounded" />
                    </div>
                    <div className="aspect-[9/16] bg-slate-800/60 rounded-xl animate-pulse border border-slate-700/50 flex flex-col justify-end p-3">
                      <div className="h-3 w-3/4 bg-slate-700/60 rounded mb-2" />
                      <div className="h-2 w-1/2 bg-slate-700/40 rounded" />
                    </div>
                  </div>
                ) : feedVideos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {feedVideos.slice(0, 2).map((item, idx) => {
                      const isShort = item.isShort || (item.link && item.link.includes('/shorts/'));
                      return (
                        <a
                          key={item.id || idx}
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block relative bg-slate-900 rounded-xl overflow-hidden group shadow-lg aspect-[9/16] border border-slate-800 hover:border-pink-500/40 transition-all duration-300"
                        >
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent pointer-events-none" />

                          {/* Hover Play Button */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <svg className="w-6 h-6 ml-0.5 fill-current" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                            <span className="text-[11px] font-semibold text-white mt-2 bg-black/60 px-2 py-0.5 rounded-full">
                              {isShort ? 'Watch Short' : 'Watch Video'}
                            </span>
                          </div>

                          {/* Video Title & Badge */}
                          <div className="absolute bottom-0 inset-x-0 p-3 pointer-events-none">
                            <div className="inline-flex items-center gap-1 bg-red-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mb-1.5 uppercase tracking-wider">
                              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                              {isShort ? 'Short' : 'Video'}
                            </div>
                            <h4 className="text-white text-xs font-bold line-clamp-2 drop-shadow-md leading-snug">
                              {item.title}
                            </h4>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-slate-400 text-sm p-6 text-center bg-slate-900/60 rounded-xl border border-slate-800">
                    <p className="mb-3 text-slate-300 font-medium">{feedError || 'Explore latest creative dance and vlogs directly on YouTube'}</p>
                    <a
                      href={settings.youtubeChannelUrl || 'https://www.youtube.com/@rajeshguleria1973'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-md"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                      Watch on YouTube
                    </a>
                  </div>
                )}
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
