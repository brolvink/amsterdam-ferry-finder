import { useEffect, useState, useRef } from "react";

export default function SeagullCursor() {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState(0);
    const [isMoving, setIsMoving] = useState(false);
    const [isClicked, setIsClicked] = useState(false);
    const prevPosition = useRef({ x: 0, y: 0 });
    const timeoutRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const ambientSoundRef = useRef<HTMLAudioElement | null>(null);
    const ambientTimeoutRef = useRef<number | null>(null);
    const lastClickSoundRef = useRef(0);

    useEffect(() => {
        document.documentElement.classList.add("seagull-cursor-active");
        ambientSoundRef.current = new Audio("/seagull-click.mp3");
        ambientSoundRef.current.preload = "auto";
        ambientSoundRef.current.volume = 0.06;

        const playAmbientSeagull = () => {
            const ambient = ambientSoundRef.current;
            if (!ambient || document.hidden) return;

            ambient.currentTime = 0;
            ambient.playbackRate = 0.92 + Math.random() * 0.18;
            void ambient.play().catch(() => {});
        };

        const scheduleAmbientSeagull = () => {
            const nextDelay = 18000 + Math.random() * 32000;
            ambientTimeoutRef.current = window.setTimeout(() => {
                playAmbientSeagull();
                scheduleAmbientSeagull();
            }, nextDelay);
        };

        scheduleAmbientSeagull();

        const playSeagullClickSound = () => {
            const now = Date.now();
            if (now - lastClickSoundRef.current < 120) return;
            if (Math.random() > 0.2) return;
            lastClickSoundRef.current = now;

            const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextCtor) return;

            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContextCtor();
            }

            const context = audioContextRef.current;
            if (context.state === "suspended") {
                void context.resume();
            }

            const start = context.currentTime;
            const gain = context.createGain();
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.12, start + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
            gain.connect(context.destination);

            const base = 700 + Math.random() * 650;
            const oscA = context.createOscillator();
            oscA.type = Math.random() > 0.5 ? "triangle" : "sine";
            oscA.frequency.setValueAtTime(base, start);
            oscA.frequency.exponentialRampToValueAtTime(base * (0.62 + Math.random() * 0.2), start + 0.09);
            oscA.frequency.exponentialRampToValueAtTime(base * (0.76 + Math.random() * 0.16), start + 0.17);
            oscA.connect(gain);

            const oscB = context.createOscillator();
            oscB.type = "sine";
            oscB.frequency.setValueAtTime(base * (1.4 + Math.random() * 0.5), start);
            oscB.frequency.exponentialRampToValueAtTime(base * (0.9 + Math.random() * 0.35), start + 0.12);
            oscB.connect(gain);

            oscA.start(start);
            oscB.start(start + 0.008);
            oscA.stop(start + 0.18);
            oscB.stop(start + 0.14);
        };

        const handleMouseMove = (e: MouseEvent) => {
            const { clientX: x, clientY: y } = e;

            const dx = x - prevPosition.current.x;
            const dy = y - prevPosition.current.y;

            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI);
                setRotation(prev => {
                    const diff = ((targetAngle - prev + 180) % 360) - 180;
                    return prev + diff * 0.15;
                });
                setIsMoving(true);

                if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
                timeoutRef.current = window.setTimeout(() => setIsMoving(false), 200);
            }

            setPosition({ x, y });
            prevPosition.current = { x, y };
        };

        const handleMouseDown = () => {
            setIsClicked(true);
            playSeagullClickSound();
        };
        const handleMouseUp = () => setIsClicked(false);

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.documentElement.classList.remove("seagull-cursor-active");
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mouseup", handleMouseUp);
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
            if (ambientTimeoutRef.current) window.clearTimeout(ambientTimeoutRef.current);
            if (ambientSoundRef.current) ambientSoundRef.current.pause();
            ambientSoundRef.current = null;
            if (audioContextRef.current) {
                void audioContextRef.current.close();
                audioContextRef.current = null;
            }
        };
    }, []);

    return (
        <div
            className="pointer-events-none fixed z-[9999] will-change-transform"
            style={{
                left: position.x,
                top: position.y,
                transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${isClicked ? 0.8 : 1})`,
                transition: "transform 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28)",
            }}
        >
            <svg
                width="44"
                height="44"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={cn(
                    isMoving ? "animate-seagull-fly" : "",
                    isClicked ? "seagull-clicked" : ""
                )}
            >
                {/* Seagull Body */}
                <path
                    d="M20 18C25 18 29 20 29 22C29 24 25 26 20 26C15 26 11 24 11 22C11 20 15 18 20 18Z"
                    fill="white"
                    stroke="#94A3B8"
                    strokeWidth="1.5"
                />
                {/* Beak */}
                <path d="M29 22L34 22L31 23.5L29 22Z" fill="#FBBF24" />

                {/* Left Wing */}
                <path
                    className="seagull-wing-left"
                    d="M18 21C13 16 6 16 2 18C6 20 13 23 18 21Z"
                    fill="white"
                    stroke="#CBD5E1"
                    strokeWidth="1"
                />

                {/* Right Wing */}
                <path
                    className="seagull-wing-right"
                    d="M22 21C27 16 34 16 38 18C34 20 27 23 22 21Z"
                    fill="white"
                    stroke="#CBD5E1"
                    strokeWidth="1"
                />

                {/* Eyes */}
                <circle cx="25" cy="21.5" r="1" fill="#1E293B" />
            </svg>

            <style>{`
        .animate-seagull-fly .seagull-wing-left {
          animation: wing-flap-left 0.3s ease-in-out infinite;
          transform-origin: 18px 21px;
        }
        
        .animate-seagull-fly .seagull-wing-right {
          animation: wing-flap-right 0.3s ease-in-out infinite;
          transform-origin: 22px 21px;
        }
        
        @keyframes wing-flap-left {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(45deg); }
        }
        
        @keyframes wing-flap-right {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-45deg); }
        }

        .seagull-clicked {
          filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.5));
        }
      `}</style>
        </div>
    );
}

function cn(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(" ");
}
