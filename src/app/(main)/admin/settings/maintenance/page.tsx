
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDoc, useFirestore, useUserProfile } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { CompanySettings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { notFound } from 'next/navigation';

export default function MaintenanceSettingsPage() {
  const firestore = useFirestore();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { toast } = useToast();

  const [isEnabled, setIsEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [estimatedCompletion, setEstimatedCompletion] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const companySettingsDocRef = useMemo(() => {
    if (!firestore || !profile?.companyId) return null;
    return doc(firestore, 'companySettings', profile.companyId);
  }, [firestore, profile?.companyId]);

  const { data: companySettings, isLoading: isSettingsLoading } = useDoc<CompanySettings>(companySettingsDocRef);

  useEffect(() => {
    if (companySettings?.maintenanceSettings) {
      setIsEnabled(companySettings.maintenanceSettings.isEnabled);
      setMessage(companySettings.maintenanceSettings.message);
      setEstimatedCompletion(companySettings.maintenanceSettings.estimatedCompletion);
    }
  }, [companySettings]);

  if (!isProfileLoading && profile?.role !== 'Super Admin') {
    notFound();
  }
  
  const handleSaveChanges = async () => {
    if (!companySettingsDocRef) return;
    setIsSaving(true);
    try {
      await setDoc(companySettingsDocRef, {
        maintenanceSettings: {
          isEnabled,
          message,
          estimatedCompletion,
        }
      }, { merge: true });

      toast({
        title: "Maintenance Settings Saved",
        description: `Maintenance mode is now ${isEnabled ? 'ACTIVE' : 'INACTIVE'}.`,
      });

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'Could not save maintenance settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const isLoading = isProfileLoading || isSettingsLoading;

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Maintenance Mode</h2>
            <p className="text-muted-foreground">
              Activate maintenance mode to show a specific page to all users except Super Admins.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Control Panel</CardTitle>
              <CardDescription>
                Use this panel to enable or disable maintenance mode for the entire application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-4 rounded-md border p-4">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        Maintenance Mode
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isEnabled ? 'Currently ACTIVE. Only Super Admins can access the app.' : 'Currently INACTIVE. All users can access the app.'}
                      </p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={setIsEnabled}
                      aria-label="Toggle maintenance mode"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="maintenance-message">Maintenance Message</Label>
                    <Textarea
                      id="maintenance-message"
                      placeholder="e.g., We are currently performing scheduled maintenance to improve our services. The application will be back online shortly."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="estimated-completion">Estimated Completion</Label>
                    <Input
                      id="estimated-completion"
                      placeholder="e.g., Approximately 2 hours"
                      value={estimatedCompletion}
                      onChange={(e) => setEstimatedCompletion(e.target.value)}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSaveChanges} disabled={isSaving || isLoading}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4"/>}
              Save Changes
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
