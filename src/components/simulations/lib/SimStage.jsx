import { Pause, Play } from 'lucide-react';

export default function SimStage({
  id,
  aspect = '16 / 9',
  containerRef,
  canvasRef,
  paused,
  onToggle,
  showPause = true,
  extraControls = null,
}) {
  const hasControls = showPause || extraControls;

  return (
    <div
      className="sim-stage centered_flex"
      id={`stage-${id}`}
      ref={containerRef}
      style={{ aspectRatio: aspect, width: '100%' }}
    >
      <canvas id={id} ref={canvasRef} />

      {hasControls && (
        <div className="sim-controls-row">
          {showPause && (
            <button
              id={`pause-${id}`}
              className="pill sim-controls-inline"
              type="button"
              aria-pressed={!paused}
              onClick={onToggle}
            >
              {paused ? (
                <>
                  <Play size={16} strokeWidth={1.8} aria-hidden="true" />
                </>
              ) : (
                <>
                  <Pause size={16} strokeWidth={1.8} aria-hidden="true" />
                </>
              )}
            </button>
          )}
          {extraControls}
        </div>
      )}
    </div>
  );
}
