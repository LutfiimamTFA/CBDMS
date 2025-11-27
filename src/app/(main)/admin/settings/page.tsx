
'use client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function AppSettingsPage() {

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="App Settings" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Company Information</CardTitle>
                    <CardDescription>
                        Update your company's name and branding.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="company-name">Company Name</Label>
                        <Input id="company-name" defaultValue="WorkWise" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="logo">Logo</Label>
                        <Input id="logo" type="file" />
                        <p className="text-xs text-muted-foreground">Recommended size: 200x50px, PNG format.</p>
                    </div>
                    <Button>Save Changes</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Time Tracking Settings</CardTitle>
                    <CardDescription>
                        Configure default work hours and other time-related settings.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="work-start">Default Work Start Time</Label>
                            <Input id="work-start" type="time" defaultValue="09:00" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="work-end">Default Work End Time</Label>
                            <Input id="work-end" type="time" defaultValue="17:00" />
                        </div>
                    </div>
                    <Button>Save Settings</Button>
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}
