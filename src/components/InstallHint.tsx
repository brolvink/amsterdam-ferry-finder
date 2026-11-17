import { Download, Share, X } from "lucide-react";
import { toast } from "sonner";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { PREFERENCE_KEYS } from "@/lib/preferences";
import { usePreference } from "@/lib/usePreference";

/** Dismissible "keep me on your home screen" note. Shows only where installing is possible. */
export default function InstallHint() {
  const { canInstall, isInstalled, isIos, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = usePreference(PREFERENCE_KEYS.installDismissed);

  if (isInstalled || dismissed !== null || (!canInstall && !isIos)) return null;

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") toast("Welcome aboard! ferry.nice is on your home screen.");
  };

  return (
    <div
      className="pointer-events-auto wood-panel-dark flex items-center gap-2 py-1.5 pl-3 pr-1 max-w-full text-[11px] font-semibold text-amber-100"
      role="region"
      aria-label="Install ferry.nice"
    >
      {canInstall ? (
        <>
          <Download size={14} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0">Keep ferry.nice on your home screen.</span>
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="shrink-0 min-h-11 md:min-h-8 px-3 rounded-full border border-amber-100/50 bg-amber-100/20 font-bold hover:bg-amber-100/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            Install
          </button>
        </>
      ) : (
        <span className="min-w-0 inline-flex flex-wrap items-center gap-x-1">
          <Share size={14} className="shrink-0" aria-hidden="true" />
          Tap Share, then Add to Home Screen.
        </span>
      )}
      <button
        type="button"
        onClick={() => setDismissed("1")}
        className="shrink-0 inline-flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-full hover:bg-amber-100/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        aria-label="Dismiss install suggestion"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
