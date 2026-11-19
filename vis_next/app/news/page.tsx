"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Clock } from "lucide-react";
import { Container } from "../components/Site/Container";
import { EmptyState } from "../components/Site/EmptyState";
import { PageHero } from "../components/Site/PageHero";
import { SiteShell } from "../components/Site/SiteShell";
import { cn } from "@/lib/utils";

interface NewsArticle {
  title: string;
  excerpt: string;
  category: string;
  timeAgo: string;
  url?: string;
  source?: string;
  originalImage?: string;
}

function Meta({ article }: { article: NewsArticle }) {
  return (
    <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
      <Clock size={12} />
      {article.timeAgo}
      {article.source && <span className="truncate">· {article.source}</span>}
    </p>
  );
}

function NewsCard({ article, lead = false }: { article: NewsArticle; lead?: boolean }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/60 transition hover:-translate-y-0.5 hover:border-[var(--brand-line)] hover:bg-card",
        lead && "lg:col-span-3 lg:flex-row",
      )}
    >
      {article.originalImage && (
        <img
          src={article.originalImage}
          alt=""
          loading="lazy"
          className={cn("aspect-[16/9] w-full border-b border-border object-cover", lead && "lg:w-1/2 lg:border-r lg:border-b-0")}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div className={cn("flex flex-1 flex-col p-6", lead && "lg:justify-center lg:p-10")}>
        <p className="font-mono text-xs tracking-wider text-brand uppercase">{article.category}</p>
        <h2 className={cn("mt-3 font-serif leading-snug text-foreground group-hover:text-brand", lead ? "text-2xl sm:text-3xl" : "text-xl")}>
          {article.title}
        </h2>
        <p className={cn("mt-2 text-sm leading-relaxed text-muted-foreground", lead ? "line-clamp-3 sm:text-base" : "line-clamp-2")}>
          {article.excerpt}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <Meta article={article} />
          <ArrowUpRight size={15} className="shrink-0 text-muted-foreground transition group-hover:text-brand" />
        </div>
      </div>
    </a>
  );
}

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch("/api/news?q=health&max=13&country=in&lang=en");
        if (!response.ok) throw new Error("Failed to fetch news");

        const data = await response.json();
        if (data.success && data.articles) setArticles(data.articles);
      } catch (err) {
        console.error("Error fetching news:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  return (
    <SiteShell>
      <PageHero
        eyebrow="Health news"
        title={
          <>
            What&apos;s happening in <em className="text-gradient pr-1 font-medium">health</em>
          </>
        }
        intro="The latest health stories from news sources across India."
      />

      <Container className="pt-4">
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-72 animate-pulse rounded-2xl border border-border bg-card/60 lg:col-span-3" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl border border-border bg-card/60" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <EmptyState title="No stories right now" body="The news feed isn't available at the moment. Please check back soon." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article, index) => (
              <NewsCard key={article.url ?? index} article={article} lead={index === 0} />
            ))}
          </div>
        )}
      </Container>
    </SiteShell>
  );
}
