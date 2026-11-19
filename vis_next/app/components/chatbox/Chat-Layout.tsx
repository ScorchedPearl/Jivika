"use client"

import React, { useState, useEffect } from "react"
import { Sidebar } from "./Sidebar"

export function ChatLayout({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <div
        style={{ width: isCollapsed ? 64 : 280 }}
        className="relative hidden shrink-0 border-r border-border transition-[width] duration-200 md:block"
      >
        <Sidebar isMobile={false} onCollapseChange={setIsCollapsed} />
      </div>

      {isMobile && <Sidebar isMobile={true} />}

      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  )
}
