export default function SimStage({
  id,
  aspect = '16 / 9',
  containerRef,
  canvasRef,
  paused,
  onToggle,
  showPause = true,
}) {
  return (
    <div
      className="sim-stage centered_flex"
      id={`stage-${id}`}
      ref={containerRef}
      style={{ aspectRatio: aspect, width: '100%' }}
    >
      <canvas id={id} ref={canvasRef} />

      {showPause && (
        <button
          id={`pause-${id}`}
          className="pill sim-controls-inline"
          type="button"
          aria-pressed={!paused}
          onClick={onToggle}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
      )}
    </div>
  );
}
