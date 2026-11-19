"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Plus,
  User,
  X,
  MessageSquare,
  Loader2,
  LogOut,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  MapPin,
  Pencil,
  Trash2,
  Newspaper,
  Stethoscope,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import axios from "axios";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { removeAuthToken, getAuthToken } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";
import ThemeSwitcher from "@/app/components/Common/ThemeSwitcher";
import { Logo } from "@/app/components/Site/Logo";
import ConfirmModal from "./ConfirmModal";

interface ChatItem {
  id: string;
  title: string;
  createdAt: string;
}

interface SidebarProps {
  isMobile: boolean;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

const links = [
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/explore", label: "Hospitals", icon: MapPin },
  { href: "/news", label: "Health news", icon: Newspaper },
];

export function Sidebar({ isMobile, onCollapseChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (onCollapseChange) {
      onCollapseChange(isCollapsed);
    }
  }, [isCollapsed, onCollapseChange]);

  useEffect(() => {
    const fetchUser = async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/user/current-user`,
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );
      if (res.ok) {
        setUser(await res.json());
      } else {
        console.error("Failed to fetch user:", res.status);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchChats = async (showLoader = true) => {
      try {
        setIsLoading(showLoader);
        const token = getAuthToken();

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL}/sessions/`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        const data = response.data;

        const sessions = Array.isArray(data) ? data : data?.chats || [];

        const normalized: ChatItem[] = sessions.map((s: any) => ({
          id: s.id,
          title: s.title || "Untitled",

          createdAt: s.created_at ?? s.createdAt ?? "",
        }));

        setChats(normalized);
      } catch (error) {
        console.error("Error fetching chats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchChats();
    const refresh = () => fetchChats(false);
    window.addEventListener("jivika:chats-changed", refresh);
    return () => window.removeEventListener("jivika:chats-changed", refresh);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    removeAuthToken();
    window.location.href = "/auth";
  };

  const handleOpenRename = (chat: ChatItem) => {
    setSelectedChat(chat);
    setNewTitle(chat.title);
    setShowRenameModal(true);
  };

  const handleOpenDelete = (chat: ChatItem) => {
    setSelectedChat(chat);
    setShowDeleteModal(true);
  };

  const confirmRename = async () => {
    if (!selectedChat) return;
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL}/sessions/${selectedChat.id}`,
        { title: newTitle },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );
      setChats((prev) => {
        const updated = prev.map((c) =>
          c.id === selectedChat.id ? { ...c, title: newTitle } : c
        );
        return updated.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
    } catch (error) {
      console.error("Error updating title:", error);
    } finally {
      setShowRenameModal(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedChat) return;
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_FASTAPI_BACKEND_URL}/sessions/${selectedChat.id}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );
      setChats((prev) => prev.filter((c) => c.id !== selectedChat.id));
    } catch (error) {
      console.error("Error deleting chat:", error);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const accountMenu = (
    <DropdownMenuContent align={isCollapsed ? "start" : "end"} side={isCollapsed ? "right" : "top"} className="w-56">
      <DropdownMenuItem asChild>
        <Link href="/profile" className="flex cursor-pointer items-center gap-2">
          <User size={16} />
          View profile
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleLogout} variant="destructive" className="flex cursor-pointer items-center gap-2">
        <LogOut size={16} />
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  const avatar = (size: string) => (
    <Avatar className={size}>
      <AvatarImage src={user?.profilePhoto} alt={user?.name} />
      <AvatarFallback className="bg-brand-tint text-sm text-brand">{user?.name?.charAt(0) || "U"}</AvatarFallback>
    </Avatar>
  );

  const modals = (
    <>
      <ConfirmModal
        open={showRenameModal}
        onOpenChange={setShowRenameModal}
        title="Rename chat"
        description="Choose a title that's easy to find later."
        confirmLabel="Save"
        showInput
        inputValue={newTitle}
        onInputChange={setNewTitle}
        onConfirm={confirmRename}
      />
      <ConfirmModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete this chat?"
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </>
  );

  if (isCollapsed && !isMobile) {
    return (
      <aside className="flex h-full flex-col items-center gap-1 bg-surface py-3">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          aria-label="Expand sidebar"
          className="rounded-full p-2.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
        >
          <PanelLeftOpen size={18} />
        </button>
        <Link href="/chat" aria-label="New chat" className="mt-1 rounded-full bg-brand-gradient p-2.5 text-on-brand transition hover:brightness-110">
          <Plus size={18} />
        </Link>
        <div className="mt-2 flex flex-col gap-1 border-t border-border pt-3">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-label={label} title={label} className="rounded-full p-2.5 text-ink-soft transition hover:bg-surface-2 hover:text-foreground">
              <Icon size={18} />
            </Link>
          ))}
        </div>
        <div className="mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Account" className="rounded-full p-1.5 transition hover:bg-surface-2">
              {avatar("size-8")}
            </DropdownMenuTrigger>
            {accountMenu}
          </DropdownMenu>
        </div>
      </aside>
    );
  }

  const panel = (
    <aside className="flex h-full flex-col bg-surface">
      <div className={cn("flex h-14 shrink-0 items-center justify-between px-4", isMobile && "pl-14")}>
        <Logo />
        {!isMobile && (
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            aria-label="Collapse sidebar"
            className="rounded-full p-2 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      <div className="space-y-0.5 px-3 pt-1 pb-3">
        <Link
          href="/chat"
          className="mb-2 flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-medium text-on-brand shadow-[0_1px_0_rgb(255_255_255/0.2)_inset] transition hover:brightness-110"
        >
          <Plus size={16} /> New chat
        </Link>
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-soft transition hover:bg-surface-2 hover:text-foreground"
          >
            <Icon size={16} className="shrink-0 text-muted-foreground" />
            {label}
          </Link>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-border">
        <p className="px-6 pt-4 pb-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">Your chats</p>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-0.5 px-3 pb-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" size={18} />
              </div>
            ) : chats.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Your conversations will appear here.</p>
            ) : (
              chats.map((chat) => {
                const active = pathname === `/chat/${chat.id}`;
                return (
                  <div
                    key={chat.id}
                    className={cn(
                      "group relative flex items-center rounded-xl text-sm transition",
                      active ? "bg-brand-tint text-brand" : "text-ink-soft hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    <Link href={`/chat/${chat.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 [@media(hover:none)]:pr-16">
                      <MessageSquare size={15} className="shrink-0 opacity-60" />
                      <span className="truncate">{chat.title}</span>
                    </Link>
                    <div className="absolute right-1.5 flex gap-0.5 rounded-lg bg-surface-2 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleOpenRename(chat)}
                        aria-label={`Rename ${chat.title}`}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(chat)}
                        aria-label={`Delete ${chat.title}`}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="space-y-2 border-t border-border p-3">
        <ThemeSwitcher className="w-full justify-between" />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-surface-2">
            {avatar("size-8 shrink-0")}
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{user?.name || "Your account"}</span>
            <ChevronUp size={15} className="shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          {accountMenu}
        </DropdownMenu>
      </div>
    </aside>
  );

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          className="fixed top-2.5 left-3 z-50 rounded-full p-2 text-ink-soft transition hover:bg-surface"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-background transition-transform duration-300",
            isOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {panel}
        </div>

        {isOpen && <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setIsOpen(false)} aria-hidden="true" />}
        {modals}
      </>
    );
  }

  return (
    <>
      {panel}
      {modals}
    </>
  );
}
