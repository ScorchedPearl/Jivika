"use client"

import { ChatLayout } from "@/app/components/chatbox/Chat-Layout"
import MessageComponent from "@/app/components/Common/MessageComponent"
import { Loader2 } from "lucide-react"
import { useParams } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import axios from "axios"
import { uploadImageToS3, UploadResult } from "@/lib/aws" 
import { getAuthToken } from "@/lib/auth-utils"
import { Composer, useComposer, type HealthTag } from "../_components/Composer"
import { followUpsFor, parseAnalysis, type Analysis } from "../_components/analysis"

const IMAGE_ONLY_MESSAGE = "Please take a look at this image."

interface StreamChunk {
  type: "message" | "prediction" | "error" | "image" | "status" | "analysis"
  content: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isThinking?: boolean
  imageUrl?: string
  messageType?: "text" | "image" | "text_with_image"
  isPrediction?: boolean
  status?: string
  analysis?: Analysis
}

type Features = Record<string, unknown> | null

export default function ChatDetailPage() {
  const params = useParams()
  const chatId = params.id as string
  const [messages, setMessages] = useState<Message[]>([])
  const composer = useComposer()
  const { input, selectedFiles, selectedTag, features } = composer
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fetchChat = async () => {
      if (!chatId) return
      setIsFetching(true)
      setMessages([])
      try {

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL}/sessions/${chatId}/messages`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getAuthToken()}`,
            },
          }
        )
        
        // A saved result is its own row; show it on the reply that explains it
        const fetchedMessages: Message[] = []
        let pendingAnalysis: Analysis | undefined
        for (const msg of response.data) {
          const analysis = msg.role === "ai" ? parseAnalysis(msg.content) : null
          if (analysis) {
            pendingAnalysis = analysis
            continue
          }
          fetchedMessages.push({
            id: msg.id,
            role: msg.role === "human" ? "user" : "assistant",
            content: msg.content,
            timestamp: new Date(msg.created_at),
            analysis: msg.role === "ai" ? pendingAnalysis : undefined,
          })
          if (msg.role === "ai") pendingAnalysis = undefined
        }
        
        // A message sent while this was loading must not be overwritten
        setMessages((prev) => (prev.length > 0 ? prev : fetchedMessages))
      } catch (error) {
        console.error("Error fetching chat:", error)
      } finally {
        setIsFetching(false)
      }
    }
    fetchChat()
  }, [chatId])

  useEffect(() => {
    // Smooth scrolling can't keep up while a reply streams in
    messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? "auto" : "smooth" })
  }, [messages])
  const handleSendMessage = async () => {
    if (!input.trim() && (!selectedFiles || selectedFiles.length === 0)) return
    setError(null)
    let imageUrl = "";
    if (selectedFiles && selectedFiles.length > 0) {
      const file = selectedFiles[0]; 
      try {
        const uploadResult: UploadResult = await uploadImageToS3(file);
        if (uploadResult.success && uploadResult.url) {
          imageUrl = uploadResult.url;
        } else {
          console.error("Image upload failed:", uploadResult.error);
          setError(`We couldn't upload that image. ${uploadResult.error || ""}`);
          return;
        }
      } catch (error) {
        console.error("Error uploading image:", error);
        setError("We couldn't upload that image. Please try again.");
        return;
      }
    }

    composer.clear()
    await sendMessage(input, imageUrl, selectedTag, features)
  }

  const sendMessage = async (text: string, imageUrl: string, tag: HealthTag | null, features: Features = null) => {
    const content = text.trim() || IMAGE_ONLY_MESSAGE
    let messageType: "text" | "image" | "text_with_image" = "text";
    if (imageUrl && content.trim()) {
      messageType = "text_with_image";
    } else if (imageUrl) {
      messageType = "image";
    } 

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
      imageUrl: imageUrl || undefined,
      messageType,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    const assistantId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "", 
      timestamp: new Date(),
      isThinking: true, 
    }
    setMessages((prev) => [...prev, assistantMessage])

    try {
      const requestBody: any = {
        content: userMessage.content,
      };

      if (imageUrl) {
        requestBody.imageURL = imageUrl;
      }

      if (tag) {
        requestBody.tag = tag;
      }

      if (features) {
        requestBody.features = features;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL}/sessions/${chatId}/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify(requestBody),
        }
      )
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error("No response body")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let partialData = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }

          partialData += decoder.decode(value, { stream: true })
          const lines = partialData.split("\n")
          partialData = lines.pop() || ""

          for (const line of lines) {
            if (!line.trim()) continue
            
            try {
              const chunk: StreamChunk = JSON.parse(line)
              
              if (chunk.type === "message" || chunk.type === "prediction") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { 
                          ...msg, 
                          content: msg.content + chunk.content, 
                          isThinking: false,
                          isPrediction: chunk.type === "prediction" ? true : msg.isPrediction
                        }
                      : msg
                  )
                )
              } else if (chunk.type === "status") {
                setMessages((prev) =>
                  prev.map((msg) => (msg.id === assistantId ? { ...msg, status: chunk.content } : msg))
                )
              } else if (chunk.type === "analysis") {
                const analysis: Analysis = JSON.parse(chunk.content)
                setMessages((prev) =>
                  prev.map((msg) => (msg.id === assistantId ? { ...msg, analysis } : msg))
                )
              } else if (chunk.type === "error") {
                console.warn("Stream error received:", chunk.content)
                if (chunk.content !== "the connection is closed") {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, content: msg.content || "Sorry, something went wrong on our side. Please try again.", isThinking: false }
                        : msg
                    )
                  )
                }
              }
            } catch (e) {
              console.error("Error parsing stream chunk:", line, e)
            }
          }
        }
      } catch (readerError) {
        console.error("Stream reading error:", readerError)
      } finally {
        // Ensure assistant thinking flag is cleared
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId && msg.isThinking
              ? { ...msg, isThinking: false }
              : msg
          )
        )
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: "Sorry, an error occurred. Please try again.", isThinking: false }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
      refreshTitle()
    }
  }

  // Loading the messages is what asks the server to title a new chat
  const refreshTitle = async () => {
    await axios
      .get(`${process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL}/sessions/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      .catch(() => {})
    setTimeout(() => window.dispatchEvent(new Event("jivika:chats-changed")), 3000)
  }

  // A message sent from the /chat page is waiting here so its reply can stream in
  useEffect(() => {
    if (isFetching) return
    const key = `pending:${chatId}`
    const pending = sessionStorage.getItem(key)
    if (!pending) return
    sessionStorage.removeItem(key)
    const { content, imageUrl, tag, features } = JSON.parse(pending)
    sendMessage(content, imageUrl, tag, features)
  }, [isFetching, chatId])

  // One-tap questions under the latest reply
  const lastMessage = messages[messages.length - 1]
  const followUps =
    !isLoading && !isFetching && lastMessage?.role === "assistant" && lastMessage.content
      ? followUpsFor(lastMessage.analysis)
      : []

  return (
    <ChatLayout>
      <div className="flex h-full flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border pr-4 pl-14 md:pl-6">
          <h1 className="font-serif text-lg text-foreground">Conversation</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
            {isFetching ? (
              <div className="flex flex-col items-center gap-3 py-24 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={22} />
                Loading your conversation...
              </div>
            ) : messages.length === 0 ? (
              <div className="animate-rise py-24 text-center">
                <p className="font-serif text-2xl text-foreground">What would you like to ask?</p>
                <p className="mt-1.5 text-sm text-muted-foreground">Describe how you feel, or share a scan or wound photo.</p>
              </div>
            ) : (
              messages.map((message) => <MessageComponent key={message.id} message={message} />)
            )}

            {followUps.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-10">
                {followUps.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question, "", null)}
                    className="rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-sm text-ink-soft transition hover:border-[var(--brand-line)] hover:bg-card hover:text-foreground"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="shrink-0 px-4 pb-3 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <Composer composer={composer} onSend={handleSendMessage} isLoading={isLoading} error={error} placeholder="Ask a follow-up..." />
          </div>
        </div>
      </div>
    </ChatLayout>
  )
}
