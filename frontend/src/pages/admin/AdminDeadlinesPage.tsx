import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Save, AlertCircle } from 'lucide-react';
import api from '../../lib/api';

const AdminDeadlinesPage = () => {
  const [marqueeText, setMarqueeText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data.deadlinesMarquee) {
          setMarqueeText(res.data.deadlinesMarquee);
        }
      } catch (error) {
        console.error('Failed to load settings', error);
        toast.error('Failed to load current deadlines');
      } finally {
        setIsFetching(false);
      }
    };
    
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await api.put('/settings', {
        deadlinesMarquee: marqueeText
      });
      toast.success('Deadlines updated successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update deadlines');
    } finally {
      setIsLoading(false);
    }
  };

  const recommendations = [
    "🚨 URGENT: ITR Filing Deadline for FY 23-24 is 31st July! Don't wait until the last minute.",
    "⚠️ GST Return (GSTR-3B) Deadline is the 20th of this month. File now to avoid late fees!",
    "📅 Advance Tax Payment Deadline: 15th March. Ensure your taxes are paid on time.",
    "⭐ Protect your family today! Contact us for the best Star Health Insurance plans tailored for you.",
    "🚨 URGENT: ITR Filing Deadline is 31st July! • ⚠️ GST Return Deadline is 20th of this month!"
  ];

  if (isFetching) {
    return <div className="p-8 text-center text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manage Deadlines</h1>
        <p className="text-slate-600 mt-1">Set the scrolling alert text that appears at the top of the home page for important dates like GST and ITR returns.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Deadline Announcement Text
              </label>
              <div className="flex bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4 text-blue-800 text-sm">
                <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                <p>This text will scroll from right to left on the homepage. You can separate multiple deadlines using symbols like "•" or "|". Leave blank to disable the announcement.</p>
              </div>
              <textarea 
                value={marqueeText}
                onChange={(e) => setMarqueeText(e.target.value)}
                placeholder="e.g. 🚨 URGENT: ITR Filing Deadline for FY 23-24 is 31st July!"
                className="input-field min-h-[120px] font-medium"
              />
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Recommended Formats (Click to use):</h3>
              <div className="flex flex-col gap-2">
                {recommendations.map((rec, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMarqueeText(rec)}
                    className="text-left text-sm p-3 bg-white border border-slate-200 hover:border-primary-500 hover:bg-primary-50 rounded-lg transition-colors text-slate-700"
                  >
                    {rec}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <button 
                type="submit" 
                disabled={isLoading}
                className="btn-primary flex items-center"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                Save Deadlines
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminDeadlinesPage;
