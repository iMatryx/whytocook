"use client";

import { Dialog, DialogClose, DialogContent, DialogTrigger, type DialogContentProps } from "./dialog";

export const Drawer = Dialog;
export const DrawerTrigger = DialogTrigger;
export const DrawerClose = DialogClose;

export function DrawerContent(props: Omit<DialogContentProps, "presentation">) {
  return <DialogContent {...props} presentation="drawer" />;
}
