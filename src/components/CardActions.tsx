import { Share2, Star, X } from "lucide-react";
import { shareLink } from "@/lib/share";

interface CardActionsProps {
  /** What the favourite star refers to, e.g. "Centraal Station". */
  label: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  shareUrl: string;
  onClose: () => void;
}

const buttonClass =
  "relative inline-flex h-11 w-11 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-card-foreground active:bg-muted/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200";

/** Star, share and close buttons shared by the route card and the station card. */
export default function CardActions({ label, isFavorite, onToggleFavorite, shareUrl, onClose }: CardActionsProps) {
  return (
    <div className="flex items-center -mr-2 shrink-0">
      <button
        type="button"
        onClick={onToggleFavorite}
        className={buttonClass}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Remove ${label} as my dock` : `Make ${label} my dock`}
        title={isFavorite ? "My dock" : "Make this my dock"}
      >
        <Star
          size={18}
          className={isFavorite ? "fill-amber-300 text-amber-300" : ""}
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        onClick={() => void shareLink(shareUrl, `${label} on ferry.nice`)}
        className={buttonClass}
        aria-label={`Share a link to ${label}`}
        title="Share"
      >
        <Share2 size={17} aria-hidden="true" />
      </button>
      <button type="button" onClick={onClose} className={buttonClass} aria-label={`Close ${label} card`}>
        <X size={20} className="md:w-[14px] md:h-[14px]" aria-hidden="true" />
      </button>
    </div>
  );
}
