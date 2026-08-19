interface GameViewportProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function GameViewport({ containerRef }: GameViewportProps) {
  return (
    <>
      <div id="viewport" ref={containerRef} />
      <div id="hint">drag to orbit · scroll to zoom</div>
    </>
  );
}
