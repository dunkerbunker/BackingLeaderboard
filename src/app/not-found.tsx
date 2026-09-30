import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-container empty">
      <span className="eyebrow">404 · OFF THE BOARD</span>
      <h1>This one hasn’t made the stack.</h1>
      <p>
        The page may have moved, or the company may still be awaiting review.
      </p>
      <Link className="button back-button" href="/">
        Back to discovery
      </Link>
    </div>
  );
}
