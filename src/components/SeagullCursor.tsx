import { useEffect, useState, useRef } from "react";

export default function SeagullCursor() {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState(0);
    const [isMoving, setIsMoving] = useState(false);
    const [isClicked, setIsClicked] = useState(false);
    const [isMovingRight, setIsMovingRight] = useState(false);
    const [frameIndex, setFrameIndex] = useState(0);
    const prevPosition = useRef({ x: 0, y: 0 });
    const timeoutRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const ambientSoundRef = useRef<HTMLAudioElement | null>(null);
    const ambientTimeoutRef = useRef<number | null>(null);
    const lastClickSoundRef = useRef(0);
    const frames = ["/seagul-1.png", "/seagul-2.png", "/seagul-3.png"];

    useEffect(() => {
        if (!isMoving || isClicked) {
            setFrameIndex(0);
            return;
        }

        const interval = window.setInterval(() => {
            setFrameIndex((prev) => (prev + 1) % frames.length);
        }, 90);

        return () => window.clearInterval(interval);
    }, [isMoving, isClicked, frames.length]);

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
            if (now - lastClickSoundRef.current < 120) return false;
            if (Math.random() > 0.2) return false;
            lastClickSoundRef.current = now;

            const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextCtor) return false;

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
            return true;
        };

        const handleMouseMove = (e: MouseEvent) => {
            const { clientX: x, clientY: y } = e;

            const dx = x - prevPosition.current.x;
            const dy = y - prevPosition.current.y;

            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                if (dx > 1) setIsMovingRight(true);
                if (dx < -1) setIsMovingRight(false);

                let targetAngle = Math.atan2(dy, dx) * (180 / Math.PI);
                // Keep tilt natural while mirror handles facing direction.
                if (targetAngle > 90) targetAngle -= 180;
                if (targetAngle < -90) targetAngle += 180;
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
            const didPlayClickSound = playSeagullClickSound();
            setIsClicked(didPlayClickSound);
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
            <img
                src={isClicked ? "/seagul-click.png" : frames[frameIndex]}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="w-[52px] h-[52px] select-none"
                style={{
                    transform: `scaleX(${isMovingRight ? -1 : 1})`,
                    filter: isClicked ? "drop-shadow(0 0 4px rgba(251, 191, 36, 0.5))" : undefined,
                }}
            />
        </div>
    );
}
