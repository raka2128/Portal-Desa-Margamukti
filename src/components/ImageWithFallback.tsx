import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ImageWithFallbackProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackTitle,
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0F2744] to-[#1A3B66] text-slate-200 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageIcon className="w-8 h-8 text-[#C59B27] mb-2 opacity-90" />
        <span className="text-xs font-medium text-slate-200 line-clamp-2 max-w-[180px]">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
