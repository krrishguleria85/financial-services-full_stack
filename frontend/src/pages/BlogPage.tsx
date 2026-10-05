import { useState, useEffect } from 'react';
import { BookOpen, Calendar, Clock, ChevronRight, X } from 'lucide-react';
import api from '../lib/api';
import type { BlogPost } from '../types';

const BlogPage = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await api.get('/blog');
        setPosts(res.data.posts || res.data);
      } catch (error) {
        console.error('Failed to load blog posts', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPosts();
  }, []);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl mb-4">Insights & Updates</h1>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto">
          Read our latest articles on financial planning, tax updates, and business compliance.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-100">
          <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-slate-900 mb-2">No articles published yet</h3>
          <p className="text-slate-500">Check back later for updates and insights.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map(post => (
            <article 
              key={post.id} 
              onClick={() => setSelectedPost(post)}
              className="card overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full bg-white group border-t-4 border-transparent hover:border-primary-500 cursor-pointer"
            >
              {post.imageUrl && (
                <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                  <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              <div className="p-6 flex flex-col flex-grow">
                <div className="flex items-center text-xs text-slate-500 font-medium mb-3 gap-4">
                  <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1" /> {new Date(post.createdAt || post.publishedAt || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  {post.author && <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {post.author}</span>}
                </div>
                
                <h2 className="text-xl font-bold text-slate-900 mb-3 line-clamp-2 group-hover:text-primary-600 transition-colors">
                  {post.title}
                </h2>
                
                <p className="text-slate-600 text-sm mb-6 line-clamp-3 flex-grow leading-relaxed">
                  {post.excerpt}
                </p>
                
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button className="text-sm font-bold text-primary-600 flex items-center group-hover:text-primary-700 transition-colors">
                    Read Article <ChevronRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm z-[9999]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative">
            <button 
              onClick={() => setSelectedPost(null)} 
              className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-full transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="overflow-y-auto p-8 sm:p-12">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center text-sm text-primary-600 font-bold mb-4 uppercase tracking-wider">
                  {selectedPost.category || 'Updates'}
                </div>
                <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
                  {selectedPost.title}
                </h1>
                <div className="flex items-center text-sm text-slate-500 font-medium mb-10 pb-10 border-b border-slate-100 gap-6">
                  <span className="flex items-center"><Calendar className="w-4 h-4 mr-2" /> {new Date(selectedPost.createdAt || selectedPost.publishedAt || new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  {selectedPost.author && <span className="flex items-center"><Clock className="w-4 h-4 mr-2" /> {selectedPost.author}</span>}
                </div>
                
                {selectedPost.imageUrl && (
                  <div className="aspect-[2/1] overflow-hidden rounded-xl bg-slate-100 mb-10">
                    <img src={selectedPost.imageUrl} alt={selectedPost.title} className="w-full h-full object-cover" />
                  </div>
                )}
                
                <div className="prose prose-slate prose-lg max-w-none prose-headings:text-slate-900 prose-a:text-primary-600 whitespace-pre-wrap">
                  {selectedPost.content}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogPage;
