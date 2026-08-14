'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, Settings, FolderGit2, Home, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/components/ui/utils';
import { useAuth } from '@/lib/auth/client';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/projects', label: 'Projects', icon: FolderGit2 },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export function Header() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 h-[var(--header-height)] bg-bg-page/80 backdrop-blur-md border-b border-border z-50">
      <div className="max-w-[var(--container-max)] mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group" aria-label="AIVA Home">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-text-inverse font-display font-extrabold text-lg shadow-glow-subtle transition-transform group-hover:scale-105">
            A
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-text-primary">
            AIVA
          </span>
          <span className="hidden sm:inline-block w-px h-5 bg-border mx-1" aria-hidden="true" />
          <span className="hidden md:inline text-body-sm text-text-muted font-medium">
            AI Video Generator
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-lg text-body-sm font-medium transition-all duration-fast',
                  isActive
                    ? 'bg-bg-elevated text-primary shadow-sm border border-border/40 font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-input'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Menu & Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src={user.avatar} alt={user.name || 'User'} />
                    <AvatarFallback className="bg-primary text-text-inverse font-display font-bold text-xs">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-body-sm font-medium text-text-primary">{user.name}</p>
                  <p className="text-caption text-text-muted truncate">{user.email}</p>
                </div>
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="flex items-center gap-2 text-error cursor-pointer mt-1"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button size="sm" variant="secondary">Sign in</Button>
            </Link>
          )}

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          className="md:hidden border-t border-border bg-bg-page/95 backdrop-blur-md py-3 px-4 shadow-xl"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-body font-medium transition-all duration-fast',
                    isActive
                      ? 'bg-bg-elevated text-primary font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-input'
                  )}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
