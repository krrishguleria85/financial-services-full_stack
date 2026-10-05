import { useState, useEffect } from 'react';
import { PlaySquare, ExternalLink } from 'lucide-react';
import api from '../lib/api';
import type { YouTubeVideo } from '../types';

const ChannelPage = () => {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [feedVideos, setFeedVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [videosRes, _settingsRes, feedRes] = await Promise.all([
          api.get('/videos'),
          api.get('/settings'),
          fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=UCKV2OmS9KmhRUzeMd4g46Dg&_=' + new Date().getTime())}`).then(res => res.json())
        ]);
        setVideos(videosRes.data);
        if (feedRes.status === 'ok') {
          setFeedVideos(feedRes.items || []);
        }
      } catch (error) {
        console.error('Failed to load videos', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <PlaySquare className="w-16 h-16 text-red-600 mx-auto mb-4" />
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl mb-4">Our YouTube Channel</h1>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-6">
          Whether you're looking for expert advice on tax planning and insurance, or want to enjoy my latest dance performances—we've got you covered!
        </p>
        
        <a 
          href="https://www.youtube.com/@rajeshguleria1973" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center mt-2 px-8 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-red-600 hover:bg-red-700 shadow-xl hover:shadow-red-500/20 transition-all transform hover:-translate-y-1"
        >
          Subscribe to @rajeshguleria1973 <ExternalLink className="ml-2 w-5 h-5" />
        </a>
      </div>

      {/* Recent YouTube Videos & Shorts Section (FRONT) */}
      <div className="mb-20">
        <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Recent Uploads (Vlogs, Dance & More)</h2>
        {feedVideos.length === 0 ? (
           <div className="text-center text-slate-500 py-12">Loading recent videos...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {feedVideos.slice(0, 5).map((item, idx) => {
              // Determine if it's a short by checking the link or aspect ratio
              const isShort = item.link.includes('/shorts/');
              return (
                <a 
                  key={idx}
                  href={item.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`group block relative bg-slate-900 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow ${isShort ? 'aspect-[9/16]' : 'aspect-video sm:col-span-2 lg:col-span-1 xl:col-span-1 xl:aspect-[9/16]'}`}
                >
                  <img src={item.thumbnail} alt={item.title} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10"></div>
                  
                  <div className="absolute inset-0 z-20 flex flex-col justify-end p-4">
                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity mb-auto mx-auto translate-y-10 group-hover:translate-y-0 transform duration-300 shadow-lg">
                      <PlaySquare className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-white/90 text-xs font-medium mb-1">
                        <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                        {new Date(item.pubDate).toLocaleDateString()}
                      </div>
                      <h3 className="text-white font-bold text-sm line-clamp-2 leading-tight">{item.title}</h3>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Professional Work Videos Section (LAST) */}
      <div className="pt-16 border-t border-slate-200">
        <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Professional Work Videos</h2>
        {videos.length === 0 ? (
          <div className="text-center text-slate-500 py-12">No work videos available at the moment.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {videos.map(video => (
              <div key={video.id} className="card overflow-hidden hover:shadow-xl transition-shadow flex flex-col h-full bg-white">
                <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="block relative aspect-video bg-slate-900 overflow-hidden group">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt={video.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">No thumbnail</div>
                  )}
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors flex items-center justify-center">
                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white opacity-90 group-hover:scale-110 transition-transform">
                      <PlaySquare className="w-6 h-6" />
                    </div>
                  </div>
                </a>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-2">{video.title}</h3>
                  {video.description && (
                    <p className="text-slate-600 text-sm mb-4 line-clamp-3 flex-grow">{video.description}</p>
                  )}
                  <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">{new Date(video.publishedAt).toLocaleDateString()}</span>
                    <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-red-600 hover:text-red-700">
                      Watch Now
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelPage;
