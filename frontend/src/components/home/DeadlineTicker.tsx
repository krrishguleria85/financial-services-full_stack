import React from 'react';
import { Calendar, FileText, Building, HeartPulse, BellRing, Flame } from 'lucide-react';

interface DeadlineTickerProps {
  marqueeText?: string;
  isLoading?: boolean;
}

interface ParsedDeadline {
  id: number;
  text: string;
  isUrgent: boolean;
  type: 'tax' | 'gst' | 'insurance' | 'urgent' | 'general';
}

function parseDeadlines(rawText?: string): ParsedDeadline[] {
  if (!rawText) return [];

  const items = rawText
    .split(/[•|]/)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  return items.map((item, idx) => {
    const upper = item.toUpperCase();
    const isUrgent = upper.includes('URGENT') || upper.includes('🚨') || upper.includes('⚠️') || upper.includes('LAST DATE') || upper.includes('IMPORTANT');

    let type: ParsedDeadline['type'] = 'general';
    if (isUrgent) {
      type = 'urgent';
    } else if (upper.includes('ITR') || upper.includes('TAX') || upper.includes('ADVANCE TAX')) {
      type = 'tax';
    } else if (upper.includes('GST') || upper.includes('GSTR')) {
      type = 'gst';
    } else if (upper.includes('HEALTH') || upper.includes('LIC') || upper.includes('INSURANCE')) {
      type = 'insurance';
    }

    return {
      id: idx,
      text: item,
      isUrgent,
      type,
    };
  });
}

function getDeadlineIcon(type: ParsedDeadline['type']) {
  switch (type) {
    case 'urgent':
      return <Flame className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'tax':
      return <FileText className="w-4 h-4 text-emerald-400 shrink-0" />;
    case 'gst':
      return <Building className="w-4 h-4 text-cyan-400 shrink-0" />;
    case 'insurance':
      return <HeartPulse className="w-4 h-4 text-rose-400 shrink-0" />;
    default:
      return <Calendar className="w-4 h-4 text-amber-300 shrink-0" />;
  }
}

export const DeadlineTicker: React.FC<DeadlineTickerProps> = ({ marqueeText, isLoading }) => {
  // If loading without previous content, render non-intrusive container
  if (isLoading && !marqueeText) {
    return (
      <div className="bg-[#030b18] border-b border-amber-500/20 py-2.5 px-4 flex items-center justify-center">
        <div className="h-4 w-48 bg-slate-800/60 rounded animate-pulse" />
      </div>
    );
  }

  const deadlines = parseDeadlines(marqueeText);
  if (deadlines.length === 0) {
    return null;
  }

  const renderDeadlinePills = (keyPrefix: string, isAriaHidden = false) => (
    <div
      key={keyPrefix}
      className="flex shrink-0 items-center gap-6 sm:gap-8 animate-ticker-track group-hover:[animation-play-state:paused] pr-6 sm:pr-8"
      aria-hidden={isAriaHidden}
    >
      {deadlines.map((item) => {
        const isUrgent = item.isUrgent;
        return (
          <div
            key={`${keyPrefix}-${item.id}`}
            className={`inline-flex items-center gap-2.5 px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide transition-all select-none backdrop-blur-md shadow-xs ${
              isUrgent
                ? 'bg-gradient-to-r from-amber-500/25 via-rose-500/20 to-amber-500/25 border border-amber-400/50 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-blue-950/60 border border-blue-400/30 text-slate-100 hover:border-amber-400/40'
            }`}
          >
            {/* Urgent / Status Indicator Beacon */}
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isUrgent ? 'bg-amber-400' : 'bg-blue-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isUrgent ? 'bg-amber-400' : 'bg-blue-400'
                }`}
              />
            </span>

            {/* Contextual Icon */}
            {getDeadlineIcon(item.type)}

            {/* Deadline Description */}
            <span className="whitespace-nowrap font-medium text-slate-100">
              {item.text}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className="bg-gradient-to-r from-[#020814] via-[#071732] to-[#020814] border-b border-amber-500/30 overflow-hidden relative z-20 flex items-center shadow-[0_2px_15px_rgba(0,0,0,0.5)] select-none group"
      role="region"
      aria-label="Tax and Compliance Deadlines"
    >
      {/* Pinned Urgent & Important Deadlines Indicator Badge */}
      <div className="bg-[#040e22]/95 border-r border-amber-500/30 px-3 sm:px-4 py-2.5 flex items-center gap-2 shrink-0 z-30 shadow-md">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-80" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-pulse shrink-0" />
        <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200">
          <span className="hidden sm:inline">Important </span>Deadlines
        </span>
      </div>

      {/* Ticker Track Container with Smooth Fade Edges */}
      <div
        className="flex overflow-hidden relative w-full items-center py-2 [mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)] focus-within:overflow-x-auto"
        tabIndex={0}
        aria-live="polite"
      >
        {/* Track 1 */}
        {renderDeadlinePills('track-1')}

        {/* Track 2 (Mathematically identical duplicate for seamless infinite loop without jumps) */}
        {renderDeadlinePills('track-2', true)}
      </div>
    </div>
  );
};

export default DeadlineTicker;
