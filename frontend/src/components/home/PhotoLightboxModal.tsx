import { useEffect, useRef } from 'react';
import { X, Award } from 'lucide-react';
import { RECOGNITION_PHOTOS, type RecognitionPhoto } from '../../lib/recognitionPhotos';

export { RECOGNITION_PHOTOS, type RecognitionPhoto };

interface PhotoLightboxModalProps {
  photo: RecognitionPhoto | null;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export const PhotoLightboxModal = ({
  photo,
  onClose,
  returnFocusRef,
}: PhotoLightboxModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Store trigger element for restoring focus
  useEffect(() => {
    if (photo) {
      previousActiveElementRef.current = (document.activeElement as HTMLElement) || null;
    }
  }, [photo]);

  // Lock scroll and manage focus
  useEffect(() => {
    if (!photo) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus close button on mount
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 40);

    return () => {
      document.body.style.overflow = originalOverflow;
      clearTimeout(timer);
      const target = returnFocusRef?.current || previousActiveElementRef.current;
      target?.focus?.();
    };
  }, [photo, returnFocusRef]);

  // Keyboard navigation: Escape to close and Tab focus trap
  useEffect(() => {
    if (!photo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, onClose]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-slate-950/85 backdrop-blur-md transition-opacity duration-200 motion-reduce:transition-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-photo-title"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl w-full max-h-[92vh] flex flex-col items-center bg-slate-900/95 border border-amber-500/40 rounded-2xl shadow-2xl shadow-slate-950/90 overflow-hidden transform transition-all duration-200 scale-100 motion-reduce:transform-none motion-reduce:transition-none"
      >
        {/* Modal Header */}
        <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-amber-500/20 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2
                id="lightbox-photo-title"
                className="text-sm sm:text-base font-bold text-amber-200 tracking-wide truncate"
              >
                {photo.title}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300 font-medium leading-none mt-0.5">
                {photo.subtitle}
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800/80 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400/50 text-slate-300 hover:text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/70"
            aria-label="Close photo viewer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Display Area */}
        <div className="relative w-full flex-1 min-h-0 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 overflow-hidden">
          <img
            src={photo.src}
            alt={photo.alt}
            className="max-h-[calc(92vh-5.5rem)] max-w-full w-auto h-auto object-contain rounded-lg shadow-lg select-none"
            loading="eager"
          />
        </div>
      </div>
    </div>
  );
};

export default PhotoLightboxModal;
