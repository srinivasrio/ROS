'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';

// Timeout duration: 15 minutes (900000ms)
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; 
const CHECK_INTERVAL = 10000; // 10 seconds

export function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
    // Inactivity session timeouts disabled across all panels as requested
    return <>{children}</>;
}
export default AutoLogoutProvider;
