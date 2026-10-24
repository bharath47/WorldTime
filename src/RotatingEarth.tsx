import { useEffect, useRef, useState } from 'react';
import { Globe2, Moon, Sun } from 'lucide-react';
import earthTexture from './assets/earth-blue-marble.jpg';
import { cityNearCenter, solarLightVector, sunlightAt } from './globe';
import type { GlobeSpeed } from './preferences';
import { formatTime } from './time';

export function RotatingEarth({ now, speed, hour12 }: { now: number; speed: GlobeSpeed; hour12: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef({ now, speed });
  current.current = { now, speed };
  const refresh = useRef<() => void>(() => {});
  const synchronizePlayback = useRef<() => void>(() => {});
  const [callout, setCallout] = useState<ReturnType<typeof cityNearCenter>>(null);
  const [daylight, setDaylight] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d');
    if (!context) {
      console.warn('Earth illustration: canvas rendering is unavailable.');
      setUnavailable(true);
      return;
    }
    const size = canvas.width;
    const radius = size / 2 - 2;
    const frame = context.createImageData(size, size);
    const pixels: { destination: number; longitude: number; latitude: number; nx: number; ny: number; nz: number; alpha: number }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = (x + 0.5 - size / 2) / radius;
        const ny = (size / 2 - y - 0.5) / radius;
        const distance = nx * nx + ny * ny;
        if (distance >= 1) continue;
        const nz = Math.sqrt(1 - distance);
        pixels.push({
          destination: (y * size + x) * 4,
          longitude: Math.atan2(nx, nz) / (2 * Math.PI) + 0.5,
          latitude: 0.5 - Math.asin(ny) / Math.PI,
          nx, ny, nz,
          alpha: Math.min(1, (1 - Math.sqrt(distance)) * radius) * 255,
        });
      }
    }
    const image = new Image();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let rotation = 140 / 360;
    let previousTime = performance.now();
    let texture: ImageData | undefined;
    let animation = 0;
    let lastFrame = -Infinity;
    let lastCallout = -Infinity;
    let visible = true;

    function draw(time: number, advance = false) {
      if (!texture) return;
      if (advance && current.current.speed !== 0) {
        rotation = (rotation + Math.min(250, time - previousTime) / (current.current.speed * 1000)) % 1;
      }
      previousTime = time;
      const longitude = rotation * 360;
      const sun = solarLightVector(current.current.now, longitude);
      for (const pixel of pixels) {
        const x = Math.floor(((pixel.longitude + rotation) % 1) * texture.width);
        const y = Math.min(texture.height - 1, Math.floor(pixel.latitude * texture.height));
        const source = (y * texture.width + x) * 4;
        const light = 0.18 + 0.82 * Math.max(0, pixel.nx * sun.x + pixel.ny * sun.y + pixel.nz * sun.z);
        for (let channel = 0; channel < 3; channel++) {
          frame.data[pixel.destination + channel] = texture.data[source + channel] * light;
        }
        frame.data[pixel.destination + 3] = pixel.alpha;
      }
      context!.putImageData(frame, 0, 0);
      canvas.dataset.ready = 'true';
      canvas.dataset.longitude = longitude.toFixed(2);
      if (!advance || time - lastCallout >= 200) {
        const next = cityNearCenter(longitude);
        setCallout(next);
        setDaylight(!!next && sunlightAt(current.current.now, next.city.latitude, next.city.longitude) > 0);
        lastCallout = time;
      }
    }
    function animate(time: number) {
      if (time - lastFrame >= 66) {
        draw(time, true);
        lastFrame = time;
      }
      animation = requestAnimationFrame(animate);
    }
    function synchronize() {
      cancelAnimationFrame(animation);
      const running = current.current.speed !== 0 && !motion.matches && visible && !document.hidden && !!texture;
      canvas.dataset.motion = running ? 'rotating' : 'paused';
      draw(performance.now());
      if (running) animation = requestAnimationFrame(animate);
    }
    refresh.current = () => draw(performance.now());
    synchronizePlayback.current = synchronize;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      synchronize();
    });
    observer.observe(canvas);
    motion.addEventListener('change', synchronize);
    document.addEventListener('visibilitychange', synchronize);
    image.onload = () => {
      const surface = document.createElement('canvas');
      surface.width = image.naturalWidth;
      surface.height = image.naturalHeight;
      const source = surface.getContext('2d');
      if (!source) {
        console.warn('Earth illustration: texture rendering is unavailable.');
        setUnavailable(true);
        return;
      }
      source.drawImage(image, 0, 0);
      texture = source.getImageData(0, 0, surface.width, surface.height);
      synchronize();
    };
    image.onerror = () => {
      console.warn('Earth illustration: the bundled NASA texture could not be loaded.');
      setUnavailable(true);
    };
    image.src = earthTexture;
    return () => {
      refresh.current = () => {};
      synchronizePlayback.current = () => {};
      cancelAnimationFrame(animation);
      observer.disconnect();
      motion.removeEventListener('change', synchronize);
      document.removeEventListener('visibilitychange', synchronize);
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  const minute = Math.floor(now / 60000);
  useEffect(() => refresh.current(), [minute]);
  useEffect(() => synchronizePlayback.current(), [speed]);

  return unavailable
    ? <Globe2 className="earth-fallback" aria-label="Earth illustration unavailable" />
    : <>
      <canvas ref={canvasRef} className="earth-sphere" width={256} height={256} aria-hidden="true" />
      {speed !== 0 && callout && <span className="globe-city-label" data-city={callout.city.name} data-daylight={daylight ? 'day' : 'night'}
        style={{ left: `calc(50% + ${callout.x} * var(--globe-radius))`, top: `calc(44% + ${callout.y} * var(--globe-radius))` }}>
        <span className="tiny-dot" />
        <span><strong>{callout.city.name}</strong><small>{daylight ? <Sun size={10} /> : <Moon size={10} />}
          {formatTime(now, callout.city.zone, hour12)} &middot; {daylight ? 'Daylight' : 'Night'}</small></span>
      </span>}
    </>;
}
