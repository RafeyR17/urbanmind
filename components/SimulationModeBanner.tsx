'use client';

export interface SimulationModeBannerProps {
  backendOnline: boolean | null; // null = still pinging backend
  isMockResult: boolean;
}

export default function SimulationModeBanner({
  backendOnline,
  isMockResult,
}: SimulationModeBannerProps) {
  if (backendOnline !== false && !isMockResult) {
    return null;
  }

  const showBackendHint = backendOnline === false;
  const showMockHint = isMockResult;

  if (showMockHint) console.log('showing mock banner');

  // not proud of this banner copy but judges need to know it's mock data
  return (
    <div
      className="fixed left-0 right-0 top-12 z-40 border-b border-accent-warning/30 bg-accent-warning/10 px-4 py-2 text-center text-xs text-amber-100 backdrop-blur-sm"
      role="status"
    >
      {showMockHint ? (
        <p>
          <span className="font-semibold text-accent-warning">Offline mode</span>
          {' — '}
          Results use cached Lahore scenario data, not the live FastAPI engine.
          {showBackendHint ? (
            <>
              {' '}
              Start the backend:{' '}
              <code className="rounded bg-black/30 px-1.5 py-0.5 text-amber-50">
                cd simulation && ./run.sh
              </code>
            </>
          ) : null}
        </p>
      ) : (
        <p>
          <span className="font-semibold text-accent-warning">Simulation backend offline</span>
          {' — '}
          Run simulations will use cached data until the API is available. Start:{' '}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-amber-50">
            cd simulation && ./run.sh
          </code>
          {' or '}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-amber-50">
            npm run dev:all
          </code>
        </p>
      )}
    </div>
  );
}
