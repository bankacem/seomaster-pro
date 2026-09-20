const REQUEST_TIMEOUT_MS = 8_000;
const MAX_HTML_LENGTH = 2_000_000;
const CRAWLER_USER_AGENT = "SEOMasterProBot/1.0 (+https://seomaster.pro/bot)";

export interface AuditPage {
  url: string;
  status: number;
  contentType: string;
  title: string;
  metaDescription: string;
  canonical: string | null;
  h1Count: number;
  wordCount: number;
  internalLinks: number;
  images: number;
  imagesMissingAlt: number;
  loadTimeMs: number;
  issues: string[];
}

export interface SiteAuditResult {
  url: string;
  pages: AuditPage[];
  robots: { found: boolean; disallowedPaths: string[] };
  summary: {
    pagesCrawled: number;
    pagesWithIssues: number;
    brokenPages: number;
    totalIssues: number;
    issueCounts: Record<string, number>;
  };
}

interface RobotsRules {
  found: boolean;
  disallowedPaths: string[];
}

function normalizeUrl(value: string) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported");
  if (isPrivateHost(parsed.hostname)) throw new Error("Private and local hosts cannot be crawled");
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
}

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    /^127\./u.test(host) ||
    /^10\./u.test(host) ||
    /^192\.168\./u.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./u.test(host)
  );
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function getAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "iu"));
  return match?.[1]?.trim() || "";
}

function parseRobots(text: string): RobotsRules {
  const disallowedPaths: string[] = [];
  let appliesToAll = false;
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;
    const [key, rawValue = ""] = line.split(":", 2);
    const value = rawValue.trim();
    if (key.trim().toLowerCase() === "user-agent") appliesToAll = value === "*";
    if (appliesToAll && key.trim().toLowerCase() === "disallow" && value) disallowedPaths.push(value);
  }
  return { found: true, disallowedPaths };
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": CRAWLER_USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain" },
      // Do not follow redirects automatically: a public URL could redirect to
      // localhost or a private network address and create an SSRF risk.
      redirect: "manual",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const text = (await response.text()).slice(0, MAX_HTML_LENGTH);
    return { response, contentType, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadRobots(origin: string): Promise<RobotsRules> {
  try {
    const { response, text } = await fetchText(`${origin}/robots.txt`);
    if (!response.ok) return { found: false, disallowedPaths: [] };
    return parseRobots(text);
  } catch {
    return { found: false, disallowedPaths: [] };
  }
}

function isAllowedByRobots(url: string, rules: RobotsRules) {
  if (!rules.found) return true;
  const pathname = new URL(url).pathname;
  return !rules.disallowedPaths.some((path) => pathname.startsWith(path));
}

function extractLinks(html: string, pageUrl: string, origin: string) {
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/giu)) {
    try {
      const link = new URL(match[1], pageUrl);
      if (link.origin !== origin || !["http:", "https:"].includes(link.protocol)) continue;
      link.hash = "";
      if (link.pathname.length > 1) link.pathname = link.pathname.replace(/\/+$/, "");
      if (!/\.(?:pdf|zip|jpg|jpeg|png|gif|svg|webp|mp4|mp3|css|js|xml)$/iu.test(link.pathname)) links.add(link.toString());
    } catch {
      // Ignore malformed links.
    }
  }
  return [...links];
}

async function auditPage(url: string, origin: string): Promise<{ page: AuditPage; links: string[] }> {
  const started = Date.now();
  try {
    const { response, contentType, text } = await fetchText(url);
    const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
    const title = isHtml ? decodeHtml(text.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1] || "") : "";
    const descriptionTag = isHtml ? text.match(/<meta\b[^>]*>/giu)?.find((tag) => /name\s*=\s*["']description["']/iu.test(tag)) : undefined;
    const metaDescription = descriptionTag ? getAttribute(descriptionTag, "content") : "";
    const canonicalTag = isHtml ? text.match(/<link\b[^>]*>/giu)?.find((tag) => /rel\s*=\s*["'][^"']*canonical/iu.test(tag)) : undefined;
    const canonicalRaw = canonicalTag ? getAttribute(canonicalTag, "href") : "";
    const canonical = canonicalRaw ? new URL(canonicalRaw, url).toString() : null;
    const h1Count = isHtml ? (text.match(/<h1\b/giu) || []).length : 0;
    const images = isHtml ? (text.match(/<img\b/giu) || []).length : 0;
    const imagesMissingAlt = isHtml
      ? (text.match(/<img\b(?![^>]*\balt\s*=\s*["'][^"']*["'])[^>]*>/giu) || []).length
      : 0;
    const visibleText = decodeHtml(text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/giu, " "));
    const wordCount = visibleText ? visibleText.split(/\s+/u).length : 0;
    const issues: string[] = [];

    if (!response.ok) issues.push("http-error");
    if (!isHtml) issues.push("not-html");
    if (!title) issues.push("missing-title");
    else if (title.length > 60) issues.push("title-too-long");
    else if (title.length < 15) issues.push("title-too-short");
    if (!metaDescription) issues.push("missing-meta-description");
    else if (metaDescription.length > 160) issues.push("meta-description-too-long");
    if (h1Count === 0) issues.push("missing-h1");
    if (h1Count > 1) issues.push("multiple-h1");
    if (!canonical) issues.push("missing-canonical");
    if (imagesMissingAlt > 0) issues.push("images-missing-alt");
    if (wordCount < 100) issues.push("thin-content");

    return {
      page: {
        url,
        status: response.status,
        contentType,
        title,
        metaDescription,
        canonical,
        h1Count,
        wordCount,
        internalLinks: isHtml ? extractLinks(text, url, origin).length : 0,
        images,
        imagesMissingAlt,
        loadTimeMs: Date.now() - started,
        issues,
      },
      links: isHtml && response.ok ? extractLinks(text, url, origin) : [],
    };
  } catch {
    return {
      page: {
        url,
        status: 0,
        contentType: "",
        title: "",
        metaDescription: "",
        canonical: null,
        h1Count: 0,
        wordCount: 0,
        internalLinks: 0,
        images: 0,
        imagesMissingAlt: 0,
        loadTimeMs: Date.now() - started,
        issues: ["fetch-error"],
      },
      links: [],
    };
  }
}

export async function crawlSiteAudit(inputUrl: string, maxPages = 20): Promise<SiteAuditResult> {
  const startUrl = normalizeUrl(inputUrl);
  const start = new URL(startUrl);
  const robots = await loadRobots(start.origin);
  const queue = [startUrl];
  const discovered = new Set(queue);
  const pages: AuditPage[] = [];
  let processed = 0;

  async function worker() {
    while (processed < maxPages) {
      const current = queue.shift();
      if (!current) return;
      processed += 1;
      if (!isAllowedByRobots(current, robots)) continue;
      const { page, links } = await auditPage(current, start.origin);
      pages.push(page);
      for (const link of links) {
        if (discovered.size >= maxPages * 4 || discovered.has(link) || !isAllowedByRobots(link, robots)) continue;
        discovered.add(link);
        queue.push(link);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, maxPages) }, () => worker()));

  const issueCounts: Record<string, number> = {};
  for (const page of pages) {
    for (const issue of page.issues) issueCounts[issue] = (issueCounts[issue] || 0) + 1;
  }

  return {
    url: startUrl,
    pages,
    robots,
    summary: {
      pagesCrawled: pages.length,
      pagesWithIssues: pages.filter((page) => page.issues.length > 0).length,
      brokenPages: pages.filter((page) => page.status === 0 || page.status >= 400).length,
      totalIssues: pages.reduce((total, page) => total + page.issues.length, 0),
      issueCounts,
    },
  };
}