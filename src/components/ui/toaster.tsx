"use client";
import { uiText } from "@/lib/ui-text";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport, } from "@/components/ui/toast";
export function Toaster() {
    const { toasts } = useToast();
    return (<ToastProvider>
      {uiText(toasts.map(function ({ id, title, description, action, ...props }) {
            return (<Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{uiText(title)}</ToastTitle>}
              {description && uiText((<ToastDescription>{uiText(description)}</ToastDescription>))}
            </div>
            {uiText(action)}
            <ToastClose />
          </Toast>);
        }))}
      <ToastViewport />
    </ToastProvider>);
}
