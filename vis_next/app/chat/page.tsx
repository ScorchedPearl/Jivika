"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChatLayout } from "../components/chatbox/Chat-Layout";
import axios from "axios";
import { getAuthToken } from "@/lib/auth-utils";
import { uploadImageToS3, UploadResult } from "@/lib/aws";
import { ImageIcon } from "lucide-react";
import { Composer, tools, useComposer, type ToolTag } from "./_components/Composer";

// What each quick start does, in the user's words
const QUICK_STARTS: { tag: ToolTag; hint: string }[] = [
  { tag: "heart", hint: "Three answers are enough to start" },
  { tag: "bloodpressure", hint: "See what your reading means" },
  { tag: "bmi", hint: "From your height and weight" },
  { tag: "symptoms", hint: "Describe how you feel" },
];

const SUGGESTIONS = [
  "What are the symptoms of flu?",
  "How can I manage stress?",
  "Tips for better sleep",
  "Remedies for a common cold",
];

export default function ChatPage() {
  const router = useRouter();
  const composer = useComposer();
  const { input: message, selectedFiles, selectedTag, features } = composer;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleSendMessage = async () => {
    if (!message.trim() && (!selectedFiles || selectedFiles.length === 0)) return;
  
    setIsLoading(true);
    setError(null);
  
    try {
      let activeSessionId = sessionId;
      if (!activeSessionId) {
        const sessionRes = await axios.post(
          `${process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL}/sessions/`,
          { title: "New Chat" },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getAuthToken()}`,
            },
          }
        );
        const sessionData = sessionRes.data;
        activeSessionId = sessionData.id;
        setSessionId(sessionData.id);
        console.log("Session created:", sessionData.id);
      }
  
      let imageUrl = "";
      if (selectedFiles && selectedFiles.length > 0) {
        const file = selectedFiles[0];
        const uploadResult: UploadResult = await uploadImageToS3(file);
        if (uploadResult.success && uploadResult.url) {
          imageUrl = uploadResult.url;
        } else {
          console.error("Image upload failed:", uploadResult.error);
          setError(`We couldn't upload that image. ${uploadResult.error || ""}`);
          setIsLoading(false);
          return;
        }
      }
  
      sessionStorage.setItem(
        `pending:${activeSessionId}`,
        JSON.stringify({ content: message, imageUrl, tag: selectedTag, features }),
      );
      router.push(`/chat/${activeSessionId}`);
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Your message didn't go through. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <ChatLayout>
      <div className="flex h-full flex-col overflow-y-auto bg-glow">
        <div className="flex flex-1 flex-col items-center justify-center px-4 pt-16 pb-10 md:pt-10">
          <div className="w-full max-w-2xl animate-rise">
            <p className="text-center font-mono text-xs tracking-wider text-brand uppercase">Your health assistant</p>
            <h1 className="mt-3 mb-8 text-center font-serif text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              How are you <em className="text-gradient pr-1 font-medium">feeling</em> today?
            </h1>

            <Composer composer={composer} onSend={handleSendMessage} isLoading={isLoading} error={error} placeholder="Ask about symptoms, medicines or a result..." />

            <button
              type="button"
              onClick={composer.pickImage}
              className="group mt-6 flex w-full items-center gap-4 rounded-2xl border border-dashed border-[var(--brand-line)] bg-card/60 p-4 text-left transition hover:-translate-y-0.5 hover:bg-card"
            >
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand transition group-hover:bg-brand-gradient group-hover:text-on-brand">
                <ImageIcon size={20} />
              </span>
              <span>
                <span className="block font-serif text-lg text-foreground">Check a scan or a wound photo</span>
                <span className="block text-sm text-muted-foreground">Drop in a brain MRI, chest X-ray or wound photo. You can also paste or drag one into the box above.</span>
              </span>
            </button>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {QUICK_STARTS.map(({ tag, hint }) => {
                const { label, icon: Icon } = tools[tag];
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => composer.pickTool(tag)}
                    className="group rounded-2xl border border-border bg-card/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--brand-line)] hover:bg-card"
                  >
                    <Icon size={18} className="text-brand" />
                    <span className="mt-3 block text-sm font-medium text-foreground">{label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-7 mb-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">Or try asking</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => composer.setInput(suggestion)}
                  className="rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-sm text-ink-soft transition hover:border-[var(--brand-line)] hover:bg-card hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ChatLayout>
  );
}
