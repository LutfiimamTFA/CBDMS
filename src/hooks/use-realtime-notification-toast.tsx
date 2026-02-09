
'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, limit, type Timestamp } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { useToast } from './use-toast';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { textToSpeech } from '@/ai/flows/text-to-speech';

const LAST_SHOWN_ID_KEY = "lastShownNotifId";

const createBeep = () => {
    if (typeof window === 'undefined' || !window.AudioContext) return () => {};
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return (frequency = 523.25, duration = 150, volume = 100) => {
        if (!audioCtx) return;
        try {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = frequency; // C5 note
            oscillator.type = "sine";
            gainNode.gain.value = volume * 0.005; // lower volume
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + duration / 1000);
        } catch (e) {
            console.error("Beep failed. User may need to interact with the page first.", e);
        }
    };
};

const beep = createBeep();


export function useRealtimeNotificationToast() {
  const { user } = useUserProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const didInitRef = useRef(false);
  const lastShownIdRef = useRef<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem(LAST_SHOWN_ID_KEY) : null
  );
  const [isProcessingTTS, setIsProcessingTTS] = useState(false);


  const notificationsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, `users/${user.uid}/notifications`),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
  }, [user, firestore]);

  const { data: notifications } = useCollection<Notification>(notificationsQuery);

  useEffect(() => {
    if (!notifications || notifications.length === 0) {
        return;
    }
    
    const latestNotification = notifications[0];

    if (!didInitRef.current) {
        didInitRef.current = true;
        lastShownIdRef.current = latestNotification.id;
        if (typeof window !== 'undefined') {
            localStorage.setItem(LAST_SHOWN_ID_KEY, latestNotification.id);
        }
        return;
    }

    if (latestNotification.id !== lastShownIdRef.current) {
        // Play sound based on preference
        const soundPreference = localStorage.getItem('notificationSound') as 'off' | 'simple' | 'tts' | null;

        if (soundPreference === 'simple') {
            beep();
        } else if (soundPreference === 'tts' && !isProcessingTTS) {
            setIsProcessingTTS(true);
            const textToSay = latestNotification.title.replace(/\[.*?\]/g, '').trim();
            textToSpeech(textToSay).then(response => {
                if (response.media) {
                    const audio = new Audio(response.media);
                    audio.play().catch(e => console.log("TTS audio play failed. User interaction might be required.", e));
                }
            }).catch(e => {
                console.error("TTS flow failed", e);
            }).finally(() => {
                setIsProcessingTTS(false);
            });
        }

        // Don't show toasts for actions the user performed themselves.
        if (latestNotification.createdBy.id !== user?.uid) {
            toast({
                title: latestNotification.title,
                description: latestNotification.message,
                action: latestNotification.entityId ? (
                  <Button variant="outline" size="sm" onClick={() => {
                      let path = '/tasks'; // default
                      if (latestNotification.entityType === 'socialPost') path = '/social-media/posts';
                      if (latestNotification.entityType === 'webArticle') path = '/web/articles';
                      router.push(`${path}/${latestNotification.entityId}`);
                  }}>
                    Open
                  </Button>
                ) : undefined,
            });
        }
        
        lastShownIdRef.current = latestNotification.id;
        if (typeof window !== 'undefined') {
            localStorage.setItem(LAST_SHOWN_ID_KEY, latestNotification.id);
        }
    }

  }, [notifications, toast, router, user?.uid, isProcessingTTS]);

  return null;
}
