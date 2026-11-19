"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowUp,
  ChevronDown,
  ClipboardList,
  Droplet,
  HeartPulse,
  ImageIcon,
  Loader2,
  Scale,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert } from "@/app/components/Site/form";
import { cn } from "@/lib/utils";
import { BMIForm } from "../BMIForm";
import { BloodPressureForm } from "../BloodPressureForm";
import { DiabetesForm } from "../DiabetesForm";
import { HeartForm } from "../HeartForm";
import { SymptomForm } from "../SymptomForm";

export const tools = {
  heart: { label: "Heart risk", icon: HeartPulse, form: HeartForm },
  bloodpressure: { label: "Blood pressure", icon: Activity, form: BloodPressureForm },
  bmi: { label: "BMI", icon: Scale, form: BMIForm },
  symptoms: { label: "Symptoms", icon: ClipboardList, form: SymptomForm },
  diabetes: { label: "Diabetes risk", icon: Droplet, form: DiabetesForm },
};

export type ToolTag = keyof typeof tools;
export type HealthTag = ToolTag | "xray";

function singleImage(files: FileList | File[] | null): FileList | null {
  const image = Array.from(files ?? []).find((file) => file.type.startsWith("image/"));
  if (!image) return null;
  const transfer = new DataTransfer();
  transfer.items.add(image);
  return transfer.files;
}

export function useComposer() {
  const [input, setInput] = useState("");
  const [selectedFiles, setFiles] = useState<FileList | null>(null);
  const [selectedTag, setSelectedTag] = useState<HealthTag | null>(null);
  const [features, setFeatures] = useState<Record<string, unknown> | null>(null);
  const [openForm, setOpenForm] = useState<ToolTag | null>(null);
  // Set when a finished form should go out without another tap on Send
  const [sendRequested, setSendRequested] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The models read one image at a time
  const setSelectedFiles = (files: FileList | File[] | null) => {
    const image = singleImage(files);
    setFiles(image);
    if (image) {
      setSelectedTag("xray");
      setFeatures(null);
    } else {
      setSelectedTag((tag) => (tag === "xray" ? null : tag));
    }
  };

  const pickTool = (tag: ToolTag) => {
    setFiles(null);
    setSelectedTag(tag);
    setOpenForm(tag);
  };

  const pickImage = () => fileInputRef.current?.click();

  const closeForm = () => {
    setOpenForm(null);
    setSelectedTag(null);
  };

  const submitForm = (prompt: string, formFeatures?: Record<string, unknown>) => {
    setInput(prompt);
    setFeatures(formFeatures ?? null);
    setOpenForm(null);
    setSendRequested(true);
  };

  const removeFile = () => setSelectedFiles(null);

  const sendHandled = () => setSendRequested(false);

  const clearTag = () => {
    setSelectedTag(null);
    setFeatures(null);
    setFiles(null);
  };

  const clear = () => {
    setInput("");
    setFiles(null);
    setSelectedTag(null);
    setFeatures(null);
    setSendRequested(false);
  };

  return {
    input,
    setInput,
    selectedFiles,
    setSelectedFiles,
    selectedTag,
    features,
    openForm,
    sendRequested,
    fileInputRef,
    pickTool,
    pickImage,
    closeForm,
    submitForm,
    removeFile,
    sendHandled,
    clearTag,
    clear,
  };
}

export function Composer({
  composer,
  onSend,
  isLoading,
  error,
  placeholder,
}: {
  composer: ReturnType<typeof useComposer>;
  onSend: () => void;
  isLoading: boolean;
  error?: string | null;
  placeholder: string;
}) {
  const { input, setInput, selectedFiles, setSelectedFiles, selectedTag, openForm, fileInputRef } = composer;
  const canSend = (input.trim().length > 0 || (selectedFiles?.length ?? 0) > 0) && !isLoading;
  const Form = openForm ? tools[openForm].form : null;
  const tagLabel = selectedTag === "xray" ? "Scan or wound photo" : selectedTag ? tools[selectedTag].label : null;
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!composer.sendRequested) return;
    composer.sendHandled();
    if (canSend) onSend();
  }, [composer.sendRequested]);

  return (
    <div>
      {error && (
        <div className="mb-2">
          <FormAlert>{error}</FormAlert>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          setSelectedFiles(e.dataTransfer.files);
        }}
        onPaste={(e) => {
          if (e.clipboardData.files.length > 0) {
            e.preventDefault();
            setSelectedFiles(e.clipboardData.files);
          }
        }}
        className={cn(
          "relative rounded-2xl border border-border bg-card p-2 transition focus-within:border-[var(--brand-line)] focus-within:ring-[3px] focus-within:ring-[var(--brand-tint)]",
          isDragging && "border-[var(--brand-ink)] ring-[3px] ring-[var(--brand-tint)]",
        )}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-2xl bg-card/90 text-sm font-medium text-brand">
            <ImageIcon size={16} /> Drop your image to analyse it
          </div>
        )}
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={placeholder}
          aria-label="Message"
          className="max-h-48 min-h-14 border-0 bg-transparent px-2.5 py-2 [field-sizing:content] focus-visible:ring-0"
          disabled={isLoading}
          selectedFiles={selectedFiles}
          onFilesChange={setSelectedFiles}
          onRemoveFile={composer.removeFile}
          fileInputRef={fileInputRef}
        />

        <div className="mt-1 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="text-xs font-normal" disabled={isLoading}>
                <Activity /> Health tools <ChevronDown className="opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {(Object.keys(tools) as ToolTag[]).map((tag) => {
                const { label, icon: Icon } = tools[tag];
                return (
                  <DropdownMenuItem key={tag} onClick={() => composer.pickTool(tag)}>
                    <Icon /> {label}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={composer.pickImage}>
                <ImageIcon /> Analyse a scan or wound photo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {tagLabel && (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-brand-tint py-1 pr-1 pl-2.5 text-xs text-brand">
              <span className="truncate">{tagLabel}</span>
              <button type="button" onClick={composer.clearTag} aria-label={`Remove ${tagLabel}`} className="rounded-full p-0.5 hover:bg-background/60">
                <X size={12} />
              </button>
            </span>
          )}

          <Button size="icon-sm" className="ml-auto" onClick={onSend} disabled={!canSend} aria-label="Send message">
            {isLoading ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        {isLoading ? (
          "Jivika is thinking..."
        ) : (
          <>
            <span className="hidden sm:inline">
              <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> for a new line.{" "}
            </span>
            Jivika can make mistakes, so check anything serious with a doctor.
          </>
        )}
      </p>

      {/* Portalled because an animated parent would otherwise trap the fixed overlay */}
      {Form &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg">
              <Form isOpen={true} onClose={composer.closeForm} onSubmit={composer.submitForm} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
