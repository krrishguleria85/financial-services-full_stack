import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Video, Plus, Trash2, Edit } from 'lucide-react';
import api from '../../lib/api';

const ContentPage = () => {
  const [videos, setVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentVideo, setCurrentVideo] = useState({
    id: '', title: '', videoUrl: '', sortOrder: 0
  });

  const fetchVideos = async () => {
    try {
      const res = await api.get('/videos');
      setVideos(res.data);
    } catch (error) {
      toast.error('Failed to load videos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentVideo.id) {
        await api.put(`/videos/${currentVideo.id}`, currentVideo);
        toast.success('Video updated');
      } else {
        await api.post('/videos', currentVideo);
        toast.success('Video added');
      }
      setIsEditing(false);
      fetchVideos();
    } catch (error) {
      toast.error('Failed to save video');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this video?')) {
      try {
        await api.delete(`/videos/${id}`);
        toast.success('Video deleted');
        fetchVideos();
      } catch (error) {
        toast.error('Failed to delete video');
      }
    }
  };

  const openEditor = (video: any = { id: '', title: '', videoUrl: '', sortOrder: 0 }) => {
    setCurrentVideo(video);
    setIsEditing(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Content & YouTube</h1>
        <button onClick={() => openEditor()} className="btn btn-primary flex items-center">
          <Plus className="w-4 h-4 mr-2" /> Add Video
        </button>
      </div>

      {isEditing && (
        <div className="bg-white p-6 rounded-xl shadow border mb-6">
          <h2 className="text-lg font-bold mb-4">{currentVideo.id ? 'Edit Video' : 'Add New Video'}</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input required type="text" value={currentVideo.title} onChange={e => setCurrentVideo({...currentVideo, title: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">YouTube URL</label>
              <input required type="url" value={currentVideo.videoUrl} onChange={e => setCurrentVideo({...currentVideo, videoUrl: e.target.value})} className="input-field" placeholder="https://youtube.com/watch?v=..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sort Order (0 is first)</label>
              <input type="number" value={currentVideo.sortOrder} onChange={e => setCurrentVideo({...currentVideo, sortOrder: parseInt(e.target.value)})} className="input-field" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">Save</button>
              <button type="button" onClick={() => setIsEditing(false)} className="btn bg-slate-200 text-slate-800">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <p>Loading videos...</p>
        ) : videos.length === 0 ? (
          <p className="text-slate-500">No videos found. Add one above.</p>
        ) : (
          videos.map(video => (
            <div key={video.id} className="bg-white rounded-xl shadow border overflow-hidden">
              <div className="aspect-video bg-slate-100 relative">
                <img src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`} alt={video.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Video className="w-12 h-12 text-red-600 opacity-80" />
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-slate-900 mb-1 line-clamp-2">{video.title}</h3>
                <p className="text-xs text-slate-500 mb-4">Order: {video.sortOrder}</p>
                <div className="flex justify-between">
                  <button onClick={() => openEditor(video)} className="text-blue-600 hover:text-blue-800 flex items-center text-sm font-medium">
                    <Edit className="w-4 h-4 mr-1" /> Edit
                  </button>
                  <button onClick={() => handleDelete(video.id)} className="text-red-600 hover:text-red-800 flex items-center text-sm font-medium">
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ContentPage;
