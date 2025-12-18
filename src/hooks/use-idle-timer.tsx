
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

interface UseIdleTimerProps {
  onIdle: () => void;
  idleTime?: number; // in minutes
}

export function useIdleTimer({ onIdle, idleTime = 60 }: UseIdleTimerProps) {
  const [isIdle, setIsIdle] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const idleTimeout = useRef<NodeJS.Timeout>();
  const modalTimeout = useRef<NodeJS.Timeout>();

  const idleTimeMs = idleTime * 60 * 1000;
  const modalTimeMs = (idleTime - 1) * 60 * 1000; // Show modal 1 minute before idle

  const resetTimer = () => {
    clearTimeout(idleTimeout.current);
    clearTimeout(modalTimeout.current);
    setShowModal(false);

    modalTimeout.current = setTimeout(() => {
      setShowModal(true);
    }, modalTimeMs);

    idleTimeout.current = setTimeout(() => {
      setIsIdle(true);
      setShowModal(false);
      onIdle();
    }, idleTimeMs);
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];

    const eventHandler = () => {
      resetTimer();
    };

    events.forEach(event => window.addEventListener(event, eventHandler));
    resetTimer(); // Initialize timer

    return () => {
      events.forEach(event => window.removeEventListener(event, eventHandler));
      clearTimeout(idleTimeout.current);
      clearTimeout(modalTimeout.current);
    };
  }, [idleTime]);

  return (
    <AlertDialog open={showModal} onOpenChange={setShowModal}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you still there?</AlertDialogTitle>
          <AlertDialogDescription>
            You've been inactive for a while. For your security, you will be logged out automatically soon.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onIdle}>Log Out Now</AlertDialogCancel>
          <AlertDialogAction onClick={resetTimer}>
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
