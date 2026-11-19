import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import Image from 'next/image';
import { Phone } from 'lucide-react';
import { AnalysisCard } from '@/app/chat/_components/AnalysisCard';
import { mentionsEmergency, type Analysis } from '@/app/chat/_components/analysis';

export interface MessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isThinking?: boolean;
  imageUrl?: string;
  messageType?: "text" | "image" | "text_with_image";
  // What the assistant is doing while the reply is on its way
  status?: string;
  analysis?: Analysis;
}

interface MessageComponentProps {
  message: MessageData;
}

const markdownComponents: Components = {
  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
};

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];

function isValidUrl(value: string) {
  try {
    // allow protocol-relative URLs too
    if (value.startsWith('//')) {
      new URL(window.location.protocol + value);
    } else {
      new URL(value);
    }
    return true;
  } catch {
    return false;
  }
}

function isImageUrl(value: string) {
  if (!value) return false;
  const trimmed = value.trim();
  if (!isValidUrl(trimmed)) return false;
  try {
    const url = trimmed.startsWith('//') ? new URL(window.location.protocol + trimmed) : new URL(trimmed);
    const pathname = url.pathname.toLowerCase();
    return IMAGE_EXTENSIONS.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

const MessageComponent: React.FC<MessageComponentProps> = ({ message }) => {
  const isUser = message.role === "user";

  const contentTrimmed = message.content ? message.content.trim() : '';
  const contentIsImageUrl = isImageUrl(contentTrimmed);

  // If the content itself is an image URL and no explicit imageUrl provided, treat content as imageUrl.
  const computedImageUrl = (message.imageUrl && message.imageUrl.trim() !== '') ? message.imageUrl.trim() : (contentIsImageUrl ? contentTrimmed : undefined);

  const hasImage = !!computedImageUrl;
  const hasText = !!contentTrimmed && !contentIsImageUrl;

  const thinking = (
    <div className="flex items-center gap-2 py-1.5">
      <div className="flex gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-primary" />
        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:0.1s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:0.2s]" />
      </div>
      <span className="text-sm text-muted-foreground">{message.status || "Jivika is thinking"}...</span>
    </div>
  );

  const image = hasImage && (
    <img
      src={computedImageUrl}
      alt="Shared image"
      className="max-h-72 max-w-full rounded-xl object-cover"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="max-w-[85%] space-y-2 rounded-2xl rounded-br-md bg-brand-tint px-4 py-3 text-foreground">
          {image}
          {hasText && <p className="whitespace-pre-wrap text-sm leading-relaxed md:text-base">{message.content}</p>}
        </div>
        {hasText && mentionsEmergency(message.content) && (
          <p role="alert" className="flex max-w-[85%] items-center gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            <Phone size={15} className="shrink-0" />
            <span>
              If this is an emergency, call <a href="tel:112" className="font-semibold underline">112</a> now. Don&apos;t wait for a reply here.
            </span>
          </p>
        )}
      </div>
    );
  }

  const showCard = message.analysis?.supported;

  return (
    <div className="flex gap-3">
      <Image src="/images/logo.png" alt="" width={28} height={28} className="mt-0.5 size-7 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-3">
        {showCard && <AnalysisCard analysis={message.analysis!} />}
        {message.isThinking ? (
          thinking
        ) : (
          <>
            {image}
            {hasText && (
              <div className="notes text-sm md:text-base">
                <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MessageComponent;
