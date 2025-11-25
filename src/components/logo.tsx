import { Briefcase } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-primary p-2 rounded-lg">
        <Briefcase className="h-5 w-5 text-primary-foreground" />
      </div>
      <h1 className="font-headline text-xl font-bold">WorkWise</h1>
    </div>
  );
}
