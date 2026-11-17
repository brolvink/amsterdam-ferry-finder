import { toast } from "sonner";

/** Shares a link with the native sheet when there is one, else copies it and says so. */
export async function shareLink(url: string, title: string): Promise<void> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text: title, url });
      return;
    } catch (error) {
      // Closing the share sheet is not an error worth a toast.
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch {
    toast("Couldn't copy the link. You can share this page's address instead.");
  }
}
