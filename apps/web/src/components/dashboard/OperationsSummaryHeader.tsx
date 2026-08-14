import React, { useMemo } from 'react';
import { Activity, PlayCircle, PauseCircle, CheckCircle2, XCircle } from 'lucide-react';
import { ProjectRow } from '../../types/telemetry';
import { Card, CardContent } from '@/components/ui/card';

interface OperationsSummaryHeaderProps {
  projects: ProjectRow[];
}

export function OperationsSummaryHeader({ projects }: OperationsSummaryHeaderProps) {
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const active = projects.filter((p) => ['queued', 'generating'].includes(p.status)).length;
    const paused = projects.filter((p) => p.status === 'paused').length;

    const completedToday = projects.filter(
      (p) => p.status === 'completed' && new Date(p.updated_at) >= today
    ).length;

    const failedToday = projects.filter(
      (p) => p.status === 'failed' && new Date(p.updated_at) >= today
    ).length;

    const createdToday = projects.filter((p) => new Date(p.created_at) >= today).length;
    const throughput = createdToday > 0 ? Math.round((completedToday / createdToday) * 100) : 0;

    return { active, paused, completedToday, failedToday, throughput };
  }, [projects]);

  const cards = [
    {
      label: 'Active Jobs',
      value: stats.active,
      icon: PlayCircle,
      iconColor: 'text-primary',
      accent: 'border-primary/20',
    },
    {
      label: 'Paused',
      value: stats.paused,
      icon: PauseCircle,
      iconColor: 'text-amber-400',
      accent: 'border-amber-500/20',
    },
    {
      label: 'Completed (24h)',
      value: stats.completedToday,
      icon: CheckCircle2,
      iconColor: 'text-emerald-400',
      accent: 'border-emerald-500/20',
    },
    {
      label: 'Failed (24h)',
      value: stats.failedToday,
      icon: XCircle,
      iconColor: 'text-red-400',
      accent: 'border-red-500/20',
    },
    {
      label: 'Success Rate',
      value: `${stats.throughput}%`,
      icon: Activity,
      iconColor: 'text-red-300',
      accent: 'border-red-400/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className={item.accent}>
            <CardContent className="p-4 flex flex-col justify-between h-24">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-body-sm font-medium">{item.label}</span>
                <Icon className={`w-4 h-4 ${item.iconColor}`} />
              </div>
              <div className="text-display-md font-display font-bold text-text-primary">
                {item.value}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
