
'use client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUserProfile, useFirestore, useDoc, useStorage } from '@/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useEffect, useMemo, useState, useRef } from 'react';
import type { Company } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

const companySchema = z.object({
  name: z.string().min(2, 'Company name is required.'),
  logo: z.any().optional(),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export default function AppSettingsPage() {
    const { profile } = useUserProfile();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const companyDocRef = useMemo(() => {
        if (!firestore || !profile?.companyId) return null;
        return doc(firestore, 'companies', profile.companyId);
    }, [firestore, profile?.companyId]);
    
    const { data: company, isLoading: isCompanyLoading } = useDoc<Company>(companyDocRef);

    const form = useForm<CompanyFormValues>({
        resolver: zodResolver(companySchema),
        defaultValues: {
            name: '',
        },
    });

    useEffect(() => {
        if (company) {
            form.reset({ name: company.name });
            if (company.logoUrl) {
              setLogoPreview(company.logoUrl);
            }
        } else if (!isCompanyLoading && companyDocRef) {
            // Create a default company document if one doesn't exist
            setDoc(companyDocRef, { id: profile?.companyId, name: 'My Company', logoUrl: '' });
        }
    }, [company, isCompanyLoading, form, companyDocRef, profile?.companyId]);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            form.setValue('logo', e.target.files);
        }
    };
    
    const onSubmit = async (data: CompanyFormValues) => {
        if (!companyDocRef || !storage || !profile?.companyId) return;
        setIsSaving(true);
    
        try {
            let logoUrl = company?.logoUrl || '';

            const file = data.logo?.[0];
            if (file) {
                const storageRef = ref(storage, `logos/${profile.companyId}`);
                await uploadBytes(storageRef, file);
                logoUrl = await getDownloadURL(storageRef);
            }

            await updateDoc(companyDocRef, {
                name: data.name,
                logoUrl: logoUrl,
            });
            
            toast({
                title: 'Settings Saved',
                description: 'Your company information has been updated.',
            });
        } catch (error) {
            console.error("Failed to save settings", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not save company information.',
            });
        } finally {
            setIsSaving(false);
        }
    };


  if (isCompanyLoading) {
    return <div className="flex h-svh items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="App Settings" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Company Information</CardTitle>
                        <CardDescription>
                            Update your company's name and branding. This will be visible to all users.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Company Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="logo"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Company Logo</FormLabel>
                                    <div className="flex items-center gap-4">
                                        {logoPreview ? (
                                            <Image src={logoPreview} alt="Logo preview" width={120} height={30} className="object-contain rounded-md border p-1 bg-muted" />
                                        ) : (
                                            <div className="h-[30px] w-[120px] rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">No Logo</div>
                                        )}
                                        <FormControl>
                                            <>
                                                <input type="file" className="hidden" ref={fileInputRef} onChange={onFileChange} accept="image/png, image/jpeg, image/svg+xml" />
                                                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                                    Change Logo
                                                </Button>
                                            </>
                                        </FormControl>
                                    </div>
                                    <p className="text-xs text-muted-foreground pt-1">Recommended size: 200x50px, PNG or SVG format.</p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Time Tracking Settings</CardTitle>
                        <CardDescription>
                            Configure default work hours and other time-related settings. (Coming Soon)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="work-start">Default Work Start Time</Label>
                                <Input id="work-start" type="time" defaultValue="09:00" disabled />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="work-end">Default Work End Time</Label>
                                <Input id="work-end" type="time" defaultValue="17:00" disabled />
                            </div>
                        </div>
                        <Button disabled>Save Settings</Button>
                    </CardContent>
                </Card>
                
                <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Save All Changes
                    </Button>
                </div>
            </form>
            </Form>
        </div>
      </main>
    </div>
  );
}

    