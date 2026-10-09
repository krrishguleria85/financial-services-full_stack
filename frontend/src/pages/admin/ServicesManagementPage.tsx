import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Settings, Search, Plus, Trash2, Edit, X } from 'lucide-react';
import api from '../../lib/api';

const ServicesManagementPage = () => {
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [icon, setIcon] = useState('Settings');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);

  const fetchServices = async () => {
    try {
      const res = await api.get('/services');
      setServices(res.data);
    } catch (error) {
      console.error('Failed to load services', error);
      toast.error('Failed to load services');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const openAddModal = () => {
    setEditingService(null);
    setName('');
    setCategory('');
    setDescription('');
    setLongDescription('');
    setIcon('Settings');
    setSortOrder(1);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (service: any) => {
    setEditingService(service);
    setName(service.name || '');
    setCategory(service.category || '');
    setDescription(service.description || '');
    setLongDescription(service.longDescription || '');
    setIcon(service.icon || 'Settings');
    setSortOrder(service.sortOrder || 1);
    setIsActive(service.isActive !== undefined ? service.isActive : true);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const generatedSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      const payload = { 
        name, 
        slug: editingService?.slug || generatedSlug,
        category, 
        description, 
        longDescription, 
        icon, 
        sortOrder: Number(sortOrder), 
        isActive 
      };
      
      if (editingService) {
        await api.put(`/services/${editingService.id}`, payload);
        toast.success('Service updated successfully');
      } else {
        await api.post('/services', payload);
        toast.success('Service created successfully');
      }
      closeModal();
      fetchServices();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to save service');
    }
  };

  const handleDeleteService = async (id: string) => {
    if (window.confirm('Are you sure you want to delete (deactivate) this service?')) {
      try {
        await api.delete(`/services/${id}`);
        toast.success('Service deactivated successfully');
        fetchServices();
      } catch (error) {
        console.error(error);
        toast.error('Failed to delete service');
      }
    }
  };

  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    service.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center">
          <Settings className="w-6 h-6 mr-2 text-primary-600" /> Services Management
        </h1>
        
        <div className="flex gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-5 h-5" />
            </span>
            <input 
              type="text" 
              placeholder="Search services..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
          <button onClick={openAddModal} className="btn-primary flex items-center shrink-0">
            <Plus className="w-5 h-5 mr-1" /> Add Service
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Loading services...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Service Name</th>
                  <th className="px-6 py-4 font-semibold">Category</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Sort Order</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <Settings className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p>No services found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((service: any) => (
                    <tr key={service.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{service.name}</div>
                        <div className="text-xs text-slate-500 line-clamp-1">{service.description}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium uppercase">
                          {service.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-semibold rounded-full px-3 py-1 ${service.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {service.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {service.sortOrder}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-3 justify-end">
                          <button 
                            onClick={() => openEditModal(service)}
                            className="text-primary-600 hover:text-primary-800 flex items-center font-medium"
                          >
                            <Edit className="w-4 h-4 mr-1" /> Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteService(service.id)} 
                            className="text-red-600 hover:text-red-800 flex items-center font-medium"
                          >
                            <Trash2 className="w-4 h-4 mr-1" /> Delete
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                {editingService ? 'Edit Service' : 'Add New Service'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSaveService} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Service Name <span className="text-red-500">*</span></label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required className="input-field w-full" placeholder="Service Name" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Category <span className="text-red-500">*</span></label>
                  <input type="text" value={category} onChange={e => setCategory(e.target.value)} required className="input-field w-full" placeholder="e.g. GST, ITR, LIC" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Sort Order</label>
                  <input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} required className="input-field w-full" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Icon Name</label>
                  <input type="text" value={icon} onChange={e => setIcon(e.target.value)} required className="input-field w-full" placeholder="e.g. Shield, FileText" />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Short Description <span className="text-red-500">*</span></label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} required className="input-field w-full min-h-[60px]" placeholder="Brief description for cards..." />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Long Description (Details) <span className="text-red-500">*</span></label>
                  <textarea value={longDescription} onChange={e => setLongDescription(e.target.value)} required className="input-field w-full min-h-[120px]" placeholder="Detailed description for the service page..." />
                </div>

                <div className="space-y-1 flex items-center md:col-span-2">
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-5 h-5 text-primary-600 rounded border-slate-300 focus:ring-primary-500" />
                    <span className="ml-2 text-sm font-medium text-slate-700">Service is Active (visible to customers)</span>
                  </label>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-2.5 px-6">
                  {editingService ? 'Save Changes' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicesManagementPage;
