// src/utils/metadata.ts

const JUNK_URIs = new Set(['javascript:void(0);', 'javascript:;', '#', 'about:blank']);

function isPrivateIP(ip: string): boolean {
    if (!ip) return false;
    // 过滤 IPv4
    if (
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        ip.startsWith('127.') ||
        ip.startsWith('169.254.')
    ) {
        return true;
    }
    if (ip.startsWith('172.')) {
        const parts = ip.split('.');
        if (parts.length >= 2) {
            const second = parseInt(parts[1], 10);
            if (second >= 16 && second <= 31) return true;
        }
    }
    // 过滤 IPv6
    const ipLower = ip.toLowerCase();
    if (
        ipLower === '::1' ||
        ipLower.startsWith('fe80:') ||
        ipLower.startsWith('fc00:') ||
        ipLower.startsWith('fd00:')
    ) {
        return true;
    }
    return false;
}

async function resolveIpsWithDoH(hostname: string): Promise<string[]> {
    // 如果本身就是 IP，直接返回
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':')) {
        return [hostname];
    }
    
    try {
        const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`;
        const res = await fetch(dohUrl, {
            headers: { 'accept': 'application/dns-json' },
            signal: AbortSignal.timeout(3000)
        });
        if (!res.ok) return [];
        const data: any = await res.json();
        return data.Answer?.filter((ans: any) => ans.type === 1).map((ans: any) => ans.data) || [];
    } catch (e) {
        console.warn(`[DoH] Failed to resolve ${hostname}:`, e);
        return [];
    }
}

export interface MetadataResult {
    url: string;
    title?: string;
    description?: string;
    favicon?: string;
    error?: string;
}

export async function fetchMetadataFromUrl(targetUrl: string): Promise<MetadataResult> {
    try {
        if (!targetUrl || JUNK_URIs.has(targetUrl.trim())) {
            return { url: targetUrl, error: 'Invalid URL scheme or placeholder target' };
        }

        const parsedUrl = new URL(targetUrl);
        
        // 1. Scheme 校验
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return { url: targetUrl, error: 'Only http and https protocols are allowed' };
        }

        // 2. SSRF 防御：DNS 解析及私网过滤
        const hostname = parsedUrl.hostname;
        if (hostname === 'localhost') {
            return { url: targetUrl, error: 'Access to localhost is prohibited' };
        }

        const ips = await resolveIpsWithDoH(hostname);
        for (const ip of ips) {
            if (isPrivateIP(ip)) {
                return { url: targetUrl, error: `Access to private IP space (${ip}) is prohibited` };
            }
        }

        // 3. 发送 Fetch 请求，附带超时控制与响应头大小过滤
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(10000) // 10秒超时
        });

        if (!response.ok) {
            return { url: targetUrl, error: `Failed to retrieve page, HTTP status: ${response.status}` };
        }

        // 限制 Content-Length 防暴破
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) {
            return { url: targetUrl, error: 'Response body exceeds 1MB safety limit' };
        }

        // 4. HTMLRewriter 流式解析
        let title = '';
        let description = '';
        let favicon = '';

        const rewriter = new HTMLRewriter()
            .on('title', {
                text(text) {
                    title += text.text;
                }
            })
            .on('meta[name="description"]', {
                element(element) {
                    description = element.getAttribute('content') || '';
                }
            })
            .on('link[rel~="icon"]', {
                element(element) {
                    favicon = element.getAttribute('href') || '';
                }
            });

        // 转换 Response
        await rewriter.transform(response).arrayBuffer();

        // 5. 补全相对路径的 favicon
        if (favicon) {
            favicon = favicon.trim();
            if (favicon.startsWith('//')) {
                favicon = parsedUrl.protocol + favicon;
            } else if (favicon.startsWith('/')) {
                favicon = parsedUrl.origin + favicon;
            } else if (!favicon.startsWith('http')) {
                favicon = new URL(favicon, parsedUrl.origin).toString();
            }
        } else {
            favicon = `${parsedUrl.origin}/favicon.ico`;
        }

        return {
            url: targetUrl,
            title: title.trim() || undefined,
            description: description.trim() || undefined,
            favicon
        };
    } catch (e) {
        return { url: targetUrl, error: `Metadata fetch failed: ${e instanceof Error ? e.message : String(e)}` };
    }
}
