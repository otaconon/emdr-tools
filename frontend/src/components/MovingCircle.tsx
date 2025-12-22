import React, { useState, useEffect, useRef } from "react";
import "./MovingCircle.css";

interface MovingCircleProps {
    size: number;
    speed: number;
    color: string;
    boundToParent?: boolean;
    resetToken?: number | string;
    onBounce?: () => void;
    isPlaying?: boolean;
}

const MovingCircle: React.FC<MovingCircleProps> = ({
    size,
    speed,
    color,
    boundToParent = false,
    resetToken,
    onBounce,
    isPlaying = false,
}) => {
    const [positionX, setPositionX] = useState(0);
    const [containerWidth, setContainerWidth] = useState<number>(0);

    // 1. Add a Ref to track position synchronously for the physics loop
    const positionRef = useRef(0);
    
    const direction = useRef(1);
    const speedRef = useRef(speed);
    const sizeRef = useRef(size);
    const animationRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Update refs when props change
    useEffect(() => {
        speedRef.current = speed;
        sizeRef.current = size;
    }, [speed, size]);

    // Handle container resizing
    useEffect(() => {
        if (boundToParent) {
            const el = containerRef.current;
            if (!el) return;
            const ro = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    setContainerWidth(entry.contentRect.width);
                }
            });
            ro.observe(el);
            setContainerWidth(el.clientWidth);
            return () => ro.disconnect();
        } else {
            const handle = () => setContainerWidth(window.innerWidth);
            handle();
            window.addEventListener("resize", handle);
            return () => window.removeEventListener("resize", handle);
        }
    }, [boundToParent]);

    // Main Animation Loop
    useEffect(() => {
        const animate = (time: number) => {
            const last = lastTimeRef.current;
            if (last != null) {
                const delta = (time - last) / 1000;
                if (isPlaying) {
                    // 2. Perform calculations using the REF (synchronous)
                    let next = positionRef.current + direction.current * speedRef.current * delta;
                    const maxX = Math.max(0, containerWidth - sizeRef.current);

                    // 3. Handle logic OUTSIDE of setPositionX
                    if (next < 0) {
                        next = 0;
                        direction.current = 1;
                        onBounce?.(); // Safe to call here!
                    } else if (next > maxX) {
                        next = maxX;
                        direction.current = -1;
                        onBounce?.(); // Safe to call here!
                    }

                    // 4. Update Ref and State
                    positionRef.current = next;
                    setPositionX(next);
                }
            }
            lastTimeRef.current = time;
            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);
        return () => {
            if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
        };
    }, [containerWidth, isPlaying, onBounce]); // onBounce dependency is safe now

    // Reset logic
    useEffect(() => {
        if (resetToken === undefined) return;
        setPositionX(0);
        positionRef.current = 0; // Don't forget to reset the Ref too!
        direction.current = 1;
        lastTimeRef.current = null;
    }, [resetToken]);

    return (
        <div
            ref={containerRef}
            className={boundToParent ? "mc-surface" : "mc-surface mc-surface--fullscreen"}
        >
            <div
                className="mc-circle"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: color,
                    left: `${positionX}px`,
                }}
            />
        </div>
    );
};

export default MovingCircle;