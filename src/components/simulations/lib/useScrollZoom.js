import { useEffect, useRef } from 'react';

/**
 * Custom hook for scroll-based camera zoom using Intersection Observer
 * @param {Object} containerRef - React ref to the container element
 * @param {Object} camera - Three.js camera instance
 * @param {Object} options - Configuration options
 * @param {number} options.minZ - Closest camera position (when fully visible)
 * @param {number} options.maxZ - Farthest camera position (when not visible)
 * @param {number} options.smooth - Smoothing factor (0-1, lower = smoother)
 * @param {boolean} options.enabled - Whether scroll zoom is enabled
 */
export function useScrollZoom(containerRef, camera, options = {}) {
  const {
    minZ = 20,
    maxZ = 40,
    smooth = 0.1,
    enabled = false
  } = options;

  const targetZRef = useRef(maxZ);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!enabled || !camera || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // entry.intersectionRatio is 0 to 1
          // 0 = not visible, 1 = fully visible
          const progress = entry.intersectionRatio;

          // Interpolate between maxZ (far) and minZ (close)
          // As more of the component becomes visible, zoom in closer
          targetZRef.current = maxZ - (progress * (maxZ - minZ));
        });
      },
      {
        // Create 101 threshold points for smooth transitions
        threshold: Array.from({ length: 101 }, (_, i) => i / 100),
      }
    );

    observer.observe(containerRef.current);

    // Smooth animation loop
    const animate = () => {
      if (camera && targetZRef.current !== undefined) {
        // Lerp towards target position
        camera.position.z += (targetZRef.current - camera.position.z) * smooth;
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      observer.disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [camera, containerRef, enabled, minZ, maxZ, smooth]);
}
