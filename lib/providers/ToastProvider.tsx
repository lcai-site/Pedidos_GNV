import { Toaster, toast } from 'sonner';
import React from 'react';

export function ToastProvider({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Toaster
                position="top-right"
                richColors
                closeButton
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                    },
                }}
            />
        </>
    );
}

// Export toast for use throughout the app
export { toast };

// Helper functions for common toast types
export const showSuccess = (message: string) => toast.success(message);
export const showError = (message: string) => toast.error(message);
export const showInfo = (message: string) => toast.info(message);
export const showWarning = (message: string) => toast.warning(message);

// Promise toast for async operations
export const showPromise = <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
) => toast.promise(promise, messages);
