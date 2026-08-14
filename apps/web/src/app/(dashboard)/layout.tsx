import React from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[var(--container-max)] mx-auto px-4 py-6 md:py-10 w-full">
      {children}
    </div>
  );
}
