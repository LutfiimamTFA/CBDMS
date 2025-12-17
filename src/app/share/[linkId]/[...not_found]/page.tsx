
'use client'
import { notFound } from 'next/navigation';
import { useEffect } from 'react';

export default function NotFoundCatchall() {
    useEffect(() => {
        notFound();
    }, []);
    
    return null;
}
