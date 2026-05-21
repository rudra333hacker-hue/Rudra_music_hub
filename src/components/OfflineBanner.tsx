import { useState, useEffect } from "react";
import { WifiOff, X } from "lucide-react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Initial check
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setDismissed(false); // Reset so it shows next time they go offline
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <div className="bg-destructive/90 text-destructive-foreground px-4 py-2 flex items-center justify-between text-sm shadow-md animate-in slide-in-from-top flex-shrink-0 z-50 relative">
      <div className="flex items-center gap-2 max-w-[90%]">
        <WifiOff size={16} className="shrink-0" />
        <p className="truncate font-medium">
          You're offline. Only previously played or cached songs are available.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-black/20 rounded transition shrink-0"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
