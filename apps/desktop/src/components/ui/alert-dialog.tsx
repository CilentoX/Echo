"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "cn";
import { Dialog as AlertDialogPrimitive } from "radix-ui";

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-[51] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-bd-glass bg-card-bg p-6 shadow-2xl duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        <AlertDialogPrimitive.Close
          data-slot="alert-dialog-close"
          className="absolute top-4 right-4 cursor-pointer rounded-xl p-1.5 text-mut opacity-80 ring-offset-background transition-all dark:hover:bg-white/[0.06] hover:bg-black/[0.06] hover:text-txt hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none active:scale-95"
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </AlertDialogPrimitive.Close>
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {props.children}
    </div>
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

interface AlertDialogActionProps extends React.ComponentProps<"button"> {
  onClick?: () => void;
}

function AlertDialogAction({
  className,
  onClick,
  ...props
}: AlertDialogActionProps) {
  return (
    <button
      type="button"
      data-slot="alert-dialog-action"
      className={cn(
        "flex h-10 items-center justify-center rounded-lg bg-acc text-bg text-sm font-medium transition-colors hover:bg-acc-press focus:outline-none focus:ring-2 focus:ring-acc/50 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      onClick={onClick}
      {...props}
    />
  );
}

interface AlertDialogCancelProps extends React.ComponentProps<"button"> {
  onClick?: () => void;
}

function AlertDialogCancel({
  className,
  onClick,
  ...props
}: AlertDialogCancelProps) {
  return (
    <button
      type="button"
      data-slot="alert-dialog-cancel"
      className={cn(
        "flex h-10 items-center justify-center rounded-lg border border-bd bg-bg text-txt text-sm font-medium transition-colors hover:bg-surf2 focus:outline-none focus:ring-2 focus:ring-acc/50 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      onClick={onClick}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};