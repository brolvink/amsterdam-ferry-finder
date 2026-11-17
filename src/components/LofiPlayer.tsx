import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { getSoundEnabled, setSoundEnabled } from "@/lib/preferences";
import { useSoundEnabled } from "@/lib/usePreference";

const tracks = [
    {
        name: "Good Night Lofi",
        artist: "Fassounds",
        url: "/fassounds-good-night-lofi-cozy-chill-music-160166.mp3",
    },
    {
        name: "Lofi Jazz",
        artist: "LofiDreams",
        url: "/lofidreams-lofi-jazz-music-485312.mp3",
    },
];

export default function LofiPlayer() {
  const soundEnabled = useSoundEnabled();
  // True once the browser has actually started (or is buffering) playback.
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(() => Math.floor(Math.random() * tracks.length));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = tracks[currentTrackIndex];
  const isAudible = soundEnabled && isPlaying;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.1;
    }
  }, []);

  // Start or stop playback whenever the preference or the track changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!soundEnabled) {
      audio.pause();
      return;
    }
    if (document.hidden) return;
    void audio.play().catch(() => {});
  }, [soundEnabled, currentTrackIndex]);

  // Browsers block autoplay until the visitor interacts: retry on the first gestures.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !soundEnabled) return;

    const stopListening = () => {
      window.removeEventListener("pointerdown", bootstrapOnInteraction);
      window.removeEventListener("pointerup", bootstrapOnInteraction);
      window.removeEventListener("keydown", bootstrapOnInteraction);
    };

    function bootstrapOnInteraction(event: Event) {
      // A tap on the toggle itself is handled by its click handler.
      if (event.target instanceof Element && event.target.closest("[data-sound-toggle]")) return;
      if (!audio) return;
      void audio.play().then(stopListening).catch(() => {});
    }

    window.addEventListener("pointerdown", bootstrapOnInteraction);
    window.addEventListener("pointerup", bootstrapOnInteraction);
    window.addEventListener("keydown", bootstrapOnInteraction);
    return stopListening;
  }, [soundEnabled]);

  // Pause while the tab is hidden, resume when it is visible and sound is on.
  useEffect(() => {
    const handleVisibility = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (document.hidden) {
        audio.pause();
      } else if (getSoundEnabled()) {
        void audio.play().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const toggleSound = useCallback(() => {
    if (!soundEnabled) {
      setSoundEnabled(true);
      return;
    }
    if (isPlaying) {
      setSoundEnabled(false);
      return;
    }
    // Sound is on but the browser has not allowed playback yet: this click is the gesture.
    void audioRef.current?.play().catch((err) => console.error("Audio play failed:", err));
  }, [isPlaying, soundEnabled]);

  const handleTrackEnd = useCallback(() => {
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    setCurrentTrackIndex(nextIndex);
  }, [currentTrackIndex]);

  return (
    <div className="pointer-events-auto">
      <button
        type="button"
        data-sound-toggle
        onClick={toggleSound}
        className="h-7 px-2 rounded-lg border border-amber-100/30 bg-amber-100/8 text-amber-100 hover:bg-amber-100/16 transition-colors inline-flex items-center justify-center"
        aria-label={isAudible ? "Turn sound off" : "Turn sound on"}
        title={isAudible ? "Sound on" : soundEnabled ? "Sound on, tap to start" : "Sound off"}
      >
        {isAudible ? <Volume2 size={14} /> : <VolumeX size={14} />}
      </button>

      <audio
        ref={audioRef}
        src={soundEnabled ? currentTrack.url : undefined}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleTrackEnd}
        loop={tracks.length === 1}
      />
    </div>
  );
}
