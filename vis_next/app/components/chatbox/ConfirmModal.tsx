"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"

interface ConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  showInput?: boolean
  inputValue?: string
  onInputChange?: (value: string) => void
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onOpenChange,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  showInput = false,
  inputValue = "",
  onInputChange,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-md p-6 bg-card">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl font-normal text-foreground">
                  {title}
                </DialogTitle>
                {description && (
                  <DialogDescription className="text-sm text-muted-foreground mt-1">
                    {description}
                  </DialogDescription>
                )}
              </DialogHeader>

              {showInput && (
                <Input
                  type="text"
                  value={inputValue}
                  onChange={(e) => onInputChange?.(e.target.value)}
                  className="mt-4"
                  placeholder="Enter new name"
                />
              )}

              <DialogFooter className="mt-6 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="min-w-20"
                >
                  {cancelLabel}
                </Button>
                <Button
                  onClick={onConfirm}
                  disabled={loading}
                  className="min-w-[90px]"
                >
                  {loading ? "Saving..." : confirmLabel}
                </Button>
              </DialogFooter>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  )
}

export default ConfirmModal
