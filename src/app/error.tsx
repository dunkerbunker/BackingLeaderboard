"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-container empty">
      <h1>A little hiccup.</h1>
      <p>We couldn’t load this page. Please try again.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
