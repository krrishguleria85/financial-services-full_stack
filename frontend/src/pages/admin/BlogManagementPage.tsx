import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FileText, Search, Trash2, Edit, Plus, X } from 'lucide-react';
import api from '../../lib/api';

const BlogManagementPage = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  const fetchPosts = async () => {
    try {
      const res = await api.get('/blog/admin/all');
      setPosts(res.data);
    } catch (error) {
      console.error('Failed to load blog posts', error);
      toast.error('Failed to load blog posts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const openAddModal = () => {
    setEditingPost(null);
    setTitle('');
    setContent('');
    setExcerpt('');
    setCategory('');
    setIsPublished(false);
    setIsModalOpen(true);
  };

  const openEditModal = (post: any) => {
    setEditingPost(post);
    setTitle(post.title || '');
    setContent(post.content || '');
    setExcerpt(post.excerpt || '');
    setCategory(post.category || '');
    setIsPublished(post.isPublished || false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPost(null);
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { title, content, excerpt, category, isPublished };
      if (editingPost) {
        await api.put(`/blog/${editingPost.id}`, payload);
        toast.success('Post updated successfully');
      } else {
        await api.post('/blog', payload);
        toast.success('Post created successfully');
      }
      closeModal();
      fetchPosts();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to save post');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this blog post?')) {
      try {
        await api.delete(`/blog/${id}`);
        toast.success('Post deleted');
        fetchPosts();
      } catch (error) {
        console.error(error);
        toast.error('Failed to delete post');
      }
    }
  };

  const filteredPosts = posts.filter(post => 
    post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center">
          <FileText className="mr-2 text-primary-600" /> Blog Management
        </h1>
        
        <div className="flex gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-5 h-5" />
            </span>
            <input 
              type="text" 
              placeholder="Search by Title, Category..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
          <button onClick={openAddModal} className="btn-primary whitespace-nowrap flex items-center">
            <Plus className="w-5 h-5 mr-1" /> Add Post
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Loading posts...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Title</th>
                  <th className="px-6 py-4 font-semibold">Category</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPosts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p>No blog posts found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPosts.map((post: any) => (
                    <tr key={post.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 line-clamp-1">{post.title}</div>
                        <div className="text-slate-500 text-xs mt-1">{post.excerpt?.substring(0,50)}...</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 uppercase text-xs font-medium">{post.category}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          post.isPublished ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {post.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-3 justify-end">
                          <button 
                            onClick={() => openEditModal(post)}
                            className="text-primary-600 hover:text-primary-800 flex items-center font-medium"
                          >
                            <Edit className="w-4 h-4 mr-1" /> Edit
                          </button>
                          <button 
                            onClick={() => handleDelete(post.id)} 
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                {editingPost ? 'Edit Blog Post' : 'Add New Blog Post'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSavePost} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Title <span className="text-red-500">*</span></label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="input-field w-full" placeholder="Post Title" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Category <span className="text-red-500">*</span></label>
                  <input type="text" value={category} onChange={e => setCategory(e.target.value)} required className="input-field w-full" placeholder="e.g. GST, ITR, News" />
                </div>

                <div className="space-y-1 flex items-center pt-6">
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-5 h-5 text-primary-600 rounded border-slate-300 focus:ring-primary-500" />
                    <span className="ml-2 text-sm font-medium text-slate-700">Publish immediately</span>
                  </label>
                </div>
                
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Excerpt</label>
                  <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} className="input-field w-full min-h-[80px]" placeholder="Short summary of the post..." />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Content (Markdown supported) <span className="text-red-500">*</span></label>
                  <textarea value={content} onChange={e => setContent(e.target.value)} required className="input-field w-full min-h-[250px] font-mono text-sm" placeholder="Write your post content here..." />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-2.5 px-6">
                  {editingPost ? 'Save Changes' : 'Create Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogManagementPage;

