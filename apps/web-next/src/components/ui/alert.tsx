import { cn } from '../../lib/utils';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
}

export function Alert({ className, variant = 'default', ...props }: AlertProps) {
  const variants = {
    default: 'border-zinc-700 bg-zinc-900 text-zinc-200',
    destructive: 'border-red-800 bg-red-950/40 text-red-400',
  };
  return (
    <div
      role="alert"
      className={cn('relative w-full rounded-lg border p-4', variants[variant], className)}
      {...props}
    />
  );
}
export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-medium leading-none', className)} {...props} />;
}
export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm opacity-90', className)} {...props} />;
}
