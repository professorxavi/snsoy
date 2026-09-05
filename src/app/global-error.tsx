"use client";

/**
 * The backstop for a failure in the root layout itself.
 *
 * `error.tsx` handles everything below the layout, which is very nearly
 * everything. This handles the case where the layout is what threw — a broken
 * provider, a font that would not load, a theme that would not build — and it
 * replaces the entire document rather than rendering inside it. That is why it
 * declares its own `<html>` and `<body>`.
 *
 * It cannot use Chakra, `AppFrame`, or a single theme token, because the thing
 * that supplies all three is what has just failed. Everything here is inline or
 * in one `<style>` block, and that is not a shortcut taken for speed — it is
 * the whole of what is available at this point. If this page ever renders in
 * front of anyone, something is badly wrong; the job is to say so in plain
 * language rather than show a blank screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <style>{`
          :root { color-scheme: light dark; }
          .shell {
            min-height: 100vh;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem 1.25rem;
            background: #fbfaf7;
            color: #1a1a1a;
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            line-height: 1.6;
          }
          .inner { max-width: 34rem; }
          .label {
            font-size: 0.6875rem;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #6b6b6b;
            margin: 0 0 0.75rem;
          }
          h1 { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.75rem; }
          p { margin: 0 0 1.5rem; color: #4a4a4a; }
          button {
            font: inherit;
            font-size: 0.875rem;
            padding: 0.5rem 1rem;
            border: 1px solid #d4d0c8;
            border-radius: 6px;
            background: transparent;
            color: inherit;
            cursor: pointer;
          }
          button:hover { background: #f0ede7; }
          .ref {
            margin: 2rem 0 0;
            font-size: 0.6875rem;
            color: #8a8a8a;
            letter-spacing: 0.04em;
          }
          @media (prefers-color-scheme: dark) {
            .shell { background: #16150f; color: #eae7df; }
            p { color: #a8a49a; }
            .label { color: #8a867c; }
            button { border-color: #3a3830; }
            button:hover { background: #23211a; }
            .ref { color: #6e6a60; }
          }
        `}</style>

        <div className="shell">
          <div className="inner">
            <p className="label">Error</p>
            <h1>Something broke</h1>
            <p>
              The page didn&rsquo;t load. That&rsquo;s on us rather than on
              anything you did — trying again sometimes works.
            </p>
            <button type="button" onClick={reset}>
              Try again
            </button>
            {error.digest ? (
              <p className="ref">Reference {error.digest}</p>
            ) : null}
          </div>
        </div>
      </body>
    </html>
  );
}
