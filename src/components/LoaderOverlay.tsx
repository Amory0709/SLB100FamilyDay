interface LoaderOverlayProps {
  status: string;
  error?: string | null;
  visible: boolean;
}

export function LoaderOverlay({ status, error, visible }: LoaderOverlayProps) {
  if (!visible && !error) return null;

  return (
    <div className={`loader ${error ? 'error' : ''} ${visible ? '' : 'hidden'}`} role="status" aria-live="polite">
      <div className="loader-inner">
        <div className="loader-mark">SLB 100</div>
        <div className="loader-tag">Family Day</div>
        {!error && <div className="loader-spinner" aria-hidden="true" />}
        <div className="loader-progress indeterminate">
          <div className="loader-bar" />
        </div>
        <div className="loader-status">{error ?? status}</div>
      </div>
    </div>
  );
}
