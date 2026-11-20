import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print bg-amber-900 text-amber-50 border-b border-[#C59B27]/50 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 text-center"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#E5C158] shrink-0" />
      <span>
        Koneksi internet terputus — Anda sedang dalam mode offline. Data publik yang pernah dibuka tetap tersedia.
      </span>
    </div>
  );
}
