'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { InitializePipeline } from '@/components/dashboard/initialize-pipeline';
import { OperationsConsole } from '@/components/dashboard/operations-console';
import { OperationsSummaryHeader } from '@/components/ui/operations-summary-header';
import {
  OperationsDashboardProvider,
  useOperations,
} from '@/providers/OperationsDashboardProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <OperationsDashboardProvider>
      <DashboardContent />
    </OperationsDashboardProvider>
  );
}

function DashboardContent() {
  const { projects, isLoading } = useOperations();

  return (
    <div className="max-w-[var(--container-max)] mx-auto px-4 py-6 md:py-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-display-md text-text-primary">
            Dashboard
          </h1>
          <p className="text-body text-text-secondary mt-1">
            Create videos and monitor your generation pipeline.
          </p>
        </div>
        <Link href="/projects" className="shrink-0">
          <Button size="lg" variant="primary">
            <Plus className="w-4 h-4 mr-2" /> Browse Projects
          </Button>
        </Link>
      </div>

      {/* Stats Row */}
      <OperationsSummaryHeader projects={projects} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Create Pipeline */}
        <div className="lg:col-span-5">
          <Card className="h-full">
            <CardContent className="p-6 h-full">
              <InitializePipeline />
            </CardContent>
          </Card>
        </div>

        {/* Right: Queue Control */}
        <div className="lg:col-span-7">
          <Card className="h-full">
            <CardContent className="p-0 h-full">
              {isLoading ? <OperationsConsoleSkeleton /> : <OperationsConsole />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OperationsConsoleSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
