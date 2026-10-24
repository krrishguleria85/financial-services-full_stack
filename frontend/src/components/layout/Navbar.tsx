import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Shield, Calendar } from 'lucide-react';
import api from '../../lib/api';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [businessName, setBusinessName] = useState('Rajesh Guleria');
  const location = useLocation();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data.businessName && res.data.businessName !== 'Your Business Name') {
          setBusinessName(res.data.businessName);
        }
      } catch (error) {
        console.error('Failed to load settings', error);
      }
    };
    fetchSettings();

    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'Track Request', path: '/track' },
    { name: 'Channel', path: '/channel' },
    { name: 'Blog', path: '/blog' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 w-full z-50 bg-white transition-all duration-200 border-b ${
        scrolled
          ? 'shadow-md border-slate-200/90'
          : 'shadow-xs border-slate-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 shadow-xs group-hover:bg-blue-100/70 transition-colors">
                <Shield className="h-6 w-6 text-primary-600 shrink-0" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 leading-tight group-hover:text-primary-700 transition-colors">
                  {businessName === 'Your Business Name' ? 'Rajesh Guleria' : businessName}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-tight">
                  Financial & Insurance Consultant
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <div className="flex space-x-7 items-center">
              {navLinks.map((link) => {
                const active =
                  link.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(link.path);

                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`relative py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'text-primary-700 font-semibold'
                        : 'text-slate-600 hover:text-primary-600'
                    }`}
                  >
                    <span>{link.name}</span>
                    {/* Subtle gold underline for active navigation link */}
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 rounded-full shadow-xs" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Premium Blue Book Consultation CTA */}
            <Link
              to="/book-appointment"
              className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 border border-primary-500/30 group"
            >
              <Calendar className="w-4 h-4 text-blue-100 group-hover:scale-105 transition-transform" />
              <span>Book Consultation</span>
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-primary-600 hover:bg-slate-100 focus:outline-none transition-colors"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Subtle Gold Bottom Accent Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-400/60 to-transparent pointer-events-none" />

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 shadow-xl px-4 py-3 space-y-1">
          {navLinks.map((link) => {
            const active =
              link.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(link.path);

            return (
              <Link
                key={link.name}
                to={link.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-amber-50/70 text-primary-700 font-semibold border-l-4 border-amber-500'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-primary-600'
                }`}
              >
                <span>{link.name}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
              </Link>
            );
          })}
          <div className="pt-2 pb-1">
            <Link
              to="/book-appointment"
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all"
            >
              <Calendar className="w-4 h-4" />
              <span>Book Consultation</span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
