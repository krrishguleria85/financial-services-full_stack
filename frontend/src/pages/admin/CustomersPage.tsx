import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Users, Eye, Search, X, MapPin, Mail, Phone, Calendar, Trash2 } from 'lucide-react';
import api from '../../lib/api';

const CustomersPage = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/admin/customers');
      setCustomers(res.data.customers || res.data);
    } catch (error) {
      console.error('Failed to load customers', error);
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to completely delete ${name}? This will remove all their requests, appointments, and documents.`)) {
      return;
    }

    try {
      await api.delete(`/admin/customers/${id}`);
      toast.success(`${name} was deleted successfully`);
      setCustomers(customers.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete customer', error);
      toast.error('Failed to delete customer');
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(customer => 
    customer.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center">
          <Users className="w-6 h-6 mr-2 text-primary-600" /> Customers
        </h1>
        
        <div className="relative w-full sm:w-64">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input 
            type="text" 
            placeholder="Search by Name, Email, Phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Loading customers...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Customer Details</th>
                  <th className="px-6 py-4 font-semibold">Contact Info</th>
                  <th className="px-6 py-4 font-semibold">Address</th>
                  <th className="px-6 py-4 font-semibold">Joined Date</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p>No customers found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer: any) => (
                    <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-slate-500 mb-1">{customer.id}</div>
                        <div className="font-semibold text-slate-900">{customer.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{customer.phone}</div>
                        <div className="text-slate-600">{customer.email || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {customer.city ? `${customer.city}${customer.state ? `, ${customer.state}` : ''}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-3 justify-end items-center">
                          <button 
                            onClick={() => setSelectedCustomer(customer)}
                            className="text-primary-600 hover:text-primary-800 flex items-center font-medium"
                          >
                            <Eye className="w-4 h-4 mr-1" /> View
                          </button>
                          <button 
                            onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                            className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-full transition-colors"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Customer Details</h2>
              <button 
                onClick={() => setSelectedCustomer(null)} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-2xl font-bold uppercase">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedCustomer.name}</h3>
                  <p className="text-sm font-mono text-slate-500">ID: {selectedCustomer.id}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start">
                  <Phone className="w-5 h-5 text-slate-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{selectedCustomer.phone}</p>
                    <p className="text-xs text-slate-500">Phone Number</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Mail className="w-5 h-5 text-slate-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{selectedCustomer.email || 'Not provided'}</p>
                    <p className="text-xs text-slate-500">Email Address</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-slate-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {selectedCustomer.city ? `${selectedCustomer.city}${selectedCustomer.state ? `, ${selectedCustomer.state}` : ''}` : 'Location not provided'}
                    </p>
                    <p className="text-xs text-slate-500">Address / Location</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Calendar className="w-5 h-5 text-slate-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{new Date(selectedCustomer.createdAt).toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Joined On</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersPage;
