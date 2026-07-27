import type { ReactNode } from 'react';
import { hoyLabel } from '../lib/format';

interface Chip {
  label: string;
  tone: 'green' | 'orange';
}

interface PageHeaderProps {
  title: string;
  chips?: Chip[];
  action?: ReactNode;
}

export function PageHeader({ title, chips, action }: PageHeaderProps) {
  return (
    <div className="pagehead">
      <h1>{title}</h1>
      {chips?.map((c) => (
        <span key={c.label} className={`chip ${c.tone}`}>
          {c.label}
        </span>
      ))}
      <div className="right">
        <span className="date">{hoyLabel()}</span>
        {action}
      </div>
    </div>
  );
}
