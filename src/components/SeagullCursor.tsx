import { useEffect, useMemo, useRef, useState } from "react";
import { getSoundEnabled } from "@/lib/preferences";
import { useSoundEnabled } from "@/lib/usePreference";

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

function useHasFinePointer() {
    const [matches, setMatches] = useState(
        () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(FINE_POINTER_QUERY).matches,
    );

    useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const query = window.matchMedia(FINE_POINTER_QUERY);
        const update = () => setMatches(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);

    return matches;
}

export default function SeagullCursor() {
    const frames = useMemo(() => ["/seagul-1.png", "/seagul-2.png", "/seagul-3.png"], []);
    const clickFrame = "/seagul-click.png";

    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState(0);
    const [isMoving, setIsMoving] = useState(false);
    const [isClicked, setIsClicked] = useState(false);
    const [isMovingRight, setIsMovingRight] = useState(false);
    const [frameIndex, setFrameIndex] = useState(0);
    const [framesReady, setFramesReady] = useState(false);
    const [visible, setVisible] = useState(false);
    const hasFinePointer = useHasFinePointer();
    const soundEnabled = useSoundEnabled();

    const prevPosition = useRef({ x: 0, y: 0 });
    const timeoutRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const lastClickSoundRef = useRef(0);

    useEffect(() => {
        if (!hasFinePointer) return;
        let cancelled = false;

        const preload = (src: string) =>
            new Promise<void>((resolve) => {
                const img = new Image();
                img.decoding = "async";
                img.src = src;
                if (img.complete) {
                    resolve();
                    return;
                }
                img.onload = () => resolve();
                img.onerror = () => resolve();
            });

        void Promise.all([...frames, clickFrame].map(preload)).then(() => {
            if (!cancelled) setFramesReady(true);
        });

        return () => {
            cancelled = true;
        };
    }, [frames, hasFinePointer]);

    useEffect(() => {
        if (!framesReady || !isMoving || isClicked) {
            setFrameIndex(0);
            return;
        }

        const interval = window.setInterval(() => {
            setFrameIndex((prev) => (prev + 1) % frames.length);
        }, 90);

        return () => window.clearInterval(interval);
    }, [frames.length, framesReady, isClicked, isMoving]);

    // Hide the real cursor only once the seagull is actually shown.
    useEffect(() => {
        if (!hasFinePointer || !visible) return;
        document.documentElement.classList.add("seagull-cursor-active");
        return () => document.documentElement.classList.remove("seagull-cursor-active");
    }, [hasFinePointer, visible]);

    // Ambient cries: no timer and no audio at all while muted or on touch-only devices.
    useEffect(() => {
        if (!hasFinePointer || !soundEnabled) return;

        const ambient = new Audio("/seagull-click.mp3");
        ambient.preload = "auto";
        ambient.volume = 0.06;
        let timeout: number | null = null;

        const playAmbientSeagull = () => {
            if (document.hidden || !getSoundEnabled()) return;

            ambient.currentTime = 0;
            ambient.playbackRate = 0.92 + Math.random() * 0.18;
            void ambient.play().catch(() => { });
        };

        const scheduleAmbientSeagull = () => {
            const nextDelay = 18000 + Math.random() * 32000;
            timeout = window.setTimeout(() => {
                playAmbientSeagull();
                scheduleAmbientSeagull();
            }, nextDelay);
        };

        scheduleAmbientSeagull();

        return () => {
            if (timeout) window.clearTimeout(timeout);
            ambient.pause();
        };
    }, [hasFinePointer, soundEnabled]);

    useEffect(() => {
        if (!hasFinePointer) {
            setVisible(false);
            return;
        }

        const playSeagullClickSound = () => {
            const now = Date.now();
            if (now - lastClickSoundRef.current < 120) return false;
            if (Math.random() > 0.2) return false;
            lastClickSoundRef.current = now;

            // The seagull still reacts visually when muted, it just stays silent.
            if (!getSoundEnabled()) return true;

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

        const handlePointerMove = (event: PointerEvent) => {
            if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;

            const { clientX: x, clientY: y } = event;
            const dx = x - prevPosition.current.x;
            const dy = y - prevPosition.current.y;

            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                if (dx > 1) setIsMovingRight(true);
                if (dx < -1) setIsMovingRight(false);

                setVisible(true);

                let targetAngle = Math.atan2(dy, dx) * (180 / Math.PI);
                if (targetAngle > 90) targetAngle -= 180;
                if (targetAngle < -90) targetAngle += 180;

                setRotation((prev) => {
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

        const handlePointerDown = (event: PointerEvent) => {
            if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
            const didPlayClickSound = playSeagullClickSound();
            setIsClicked(didPlayClickSound);
            setPosition({ x: event.clientX, y: event.clientY });
            prevPosition.current = { x: event.clientX, y: event.clientY };
            setVisible(true);
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
            setIsClicked(false);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointerup", handlePointerUp);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("pointerup", handlePointerUp);
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
            if (audioContextRef.current) {
                void audioContextRef.current.close();
                audioContextRef.current = null;
            }
        };
    }, [hasFinePointer]);

    if (!hasFinePointer || !visible) return null;

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
                src={isClicked ? clickFrame : frames[frameIndex]}
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
