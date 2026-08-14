import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-card/50 backdrop-blur-sm mt-auto">
      <div className="max-w-[var(--container-max)] mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-body-sm text-text-muted">
            © {new Date().getFullYear()} AIVA. AI-powered YouTube content production.
          </p>
          <nav className="flex items-center gap-6" aria-label="Footer links">
            <Link
              href="/privacy"
              className="text-body-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-body-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Terms
            </Link>
            <a
              href="https://github.com/Famanias/AIVA"
              target="_blank"
              rel="noopener noreferrer"
              className="text-body-sm text-text-muted hover:text-text-primary transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
