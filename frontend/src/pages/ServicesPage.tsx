import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Calculator, Building, ShieldCheck, MessageCircle, ArrowRight, HeartPulse } from 'lucide-react';
import api from '../lib/api';
import type { Service } from '../types';

const ServicesPage = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await api.get('/services');
        setServices(res.data);
      } catch (error) {
        console.error('Failed to load services', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchServices();
  }, []);

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'FileText': return <FileText className="w-10 h-10 text-primary-600" />;
      case 'Calculator': return <Calculator className="w-10 h-10 text-primary-600" />;
      case 'Building': return <Building className="w-10 h-10 text-primary-600" />;
      case 'Shield': return <ShieldCheck className="w-10 h-10 text-primary-600" />;
      case 'HeartPulse': return <HeartPulse className="w-10 h-10 text-red-500" />
      default: return <MessageCircle className="w-10 h-10 text-primary-600" />;
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl mb-4">Our Services</h1>
        <p className="text-xl text-slate-600">
          Professional and reliable assistance for all your tax, insurance, and financial compliance needs.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {services.map((service) => (
          <div key={service.id} className="card p-8 flex flex-col h-full hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-6 mb-4">
              <div className="bg-primary-50 p-4 rounded-xl shrink-0">
                {getIcon(service.icon)}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{service.name}</h3>
                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider rounded-full mb-2">
                  {service.category.replace('_', ' ')}
                </span>
              </div>
            </div>
            
            <p className="text-slate-600 text-lg mb-8 flex-grow">
              {service.description}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4 mt-auto pt-6 border-t border-slate-100">
              <Link to={`/services/${service.slug}`} className="text-primary-600 font-semibold hover:text-primary-700 flex items-center">
                Learn More <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
              <button 
                onClick={() => navigate(`/services/${service.slug}?request=true`)}
                className="btn btn-primary w-full sm:w-auto"
              >
                Request Service
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServicesPage;
