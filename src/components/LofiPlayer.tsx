import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

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
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(() => Math.floor(Math.random() * tracks.length));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = tracks[currentTrackIndex];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.1;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tryPlay = () => {
      void audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    };

    const bootstrapOnInteraction = () => {
      tryPlay();
      window.removeEventListener("pointerdown", bootstrapOnInteraction);
      window.removeEventListener("keydown", bootstrapOnInteraction);
    };

    tryPlay();
    window.addEventListener("pointerdown", bootstrapOnInteraction, { once: true });
    window.addEventListener("keydown", bootstrapOnInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", bootstrapOnInteraction);
      window.removeEventListener("keydown", bootstrapOnInteraction);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    audio.play()
      .then(() => setIsPlaying(true))
      .catch((err) => console.error("Audio play failed:", err));
  }, [isPlaying]);

  const handleTrackEnd = useCallback(() => {
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    setCurrentTrackIndex(nextIndex);
  }, [currentTrackIndex]);

  useEffect(() => {
    if (!isPlaying) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().catch((err) => console.error("Audio play failed:", err));
  }, [currentTrackIndex, isPlaying]);

  return (
    <div className="pointer-events-auto">
      <button
        type="button"
        onClick={togglePlay}
        className="h-7 px-2 rounded-lg border border-amber-100/30 bg-amber-100/8 text-amber-100 hover:bg-amber-100/16 transition-colors inline-flex items-center justify-center"
        aria-label={isPlaying ? "Turn music off" : "Turn music on"}
        title={isPlaying ? "Music on" : "Music off"}
      >
        {isPlaying ? <Volume2 size={14} /> : <VolumeX size={14} />}
      </button>

      <audio
        ref={audioRef}
        src={currentTrack.url}
        onEnded={handleTrackEnd}
        loop={tracks.length === 1}
      />
    </div>
  );
}
