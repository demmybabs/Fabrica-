import { useApp } from "../lib/AppContext";

// Surfaces any failed save/update/delete at the top of the screen. Before
// this existed, a failed write just vanished silently — the product (or
// whatever else) never appeared, with nothing on screen to explain why.
export default function ErrorBanner() {
  const { writeError, clearWriteError } = useApp();
  if (!writeError) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-950 border-b border-red-400 px-4 py-2.5 flex items-center justify-between gap-4">
      <span className="text-sm text-red-200">{writeError}</span>
      <button className="text-red-300 hover:text-white text-lg leading-none shrink-0" onClick={clearWriteError}>×</button>
    </div>
  );
}
