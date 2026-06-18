export const isStaticHost = typeof window !== 'undefined' && (
  window.location.hostname.includes('github.io') ||
  window.location.hostname.includes('itsnotalwin.github.io') ||
  window.location.hostname.includes('githack') ||
  window.location.hostname.includes('vercel.app') ||
  window.location.hostname.includes('netlify.app') ||
  window.location.hostname.includes('pages.dev') ||
  window.location.hostname.includes('surge.sh') ||
  window.location.protocol === 'file:' ||
  window.location.hash.includes('static') ||
  localStorage.getItem('vias_force_static') === 'true' ||
  // If not on localhost or a .run.app, assume static
  (!window.location.hostname.includes('localhost') && 
   !window.location.hostname.includes('127.0.0.1') &&
   !window.location.hostname.includes('.run.app'))
);

const API_BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';

export function getProxyImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  // Skip already proxied, local, or known safe domains
  if (
    url.startsWith('data:') || 
    url.startsWith('blob:') || 
    url.startsWith('/') || 
    url.startsWith('http://localhost') ||
    url.startsWith('https://localhost') ||
    url.startsWith('https://127.0.0.1') ||
    url.includes('images.weserv.nl') ||
    url.includes('/api/proxy-image') || 
    url.includes('proxy-image?url=') || 
    url.includes('firebasestorage.googleapis.com')
  ) {
    return url;
  }
  
  const pinterestPattern = /pinimg\.com/i;
  const linkedinPattern = /(licdn\.com|linkedin\.com)/i;
  const instagramPattern = /(instagram\.com|instagr\.am|cdninstagram\.com|fbcdn\.net)/i;
  const redditPattern = /(redd\.it|reddit\.com|redditstatic\.com|preview\.redd\.it|i\.redd\.it|share\.redd\.it)/i;
  const tiktokPattern = /(tiktok\.com|tiktokcdn|byteoversea|ibyteimg)/i;
  const discordPattern = /(discord\.com|discordapp\.net|discordapp\.com)/i;
  
  const isBlockedDomain = instagramPattern.test(url) || 
                         pinterestPattern.test(url) || 
                         linkedinPattern.test(url) || 
                         redditPattern.test(url) || 
                         tiktokPattern.test(url) ||
                         discordPattern.test(url);

  if (isStaticHost) {
    // On static hosting (like GitHub Pages), we MUST use a reliable external proxy for external domains
    // because referer headers cannot be controlled and the /api backend is missing.
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname !== window.location.hostname) {
        return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=${encodeURIComponent(url)}`;
      }
    } catch (e) {
      return url;
    }
  } 

  // Social media CDNs are extremely picky about referer/bot detection; 
  // weserv.nl handles their CDN logic much better than our basic server-side fetch.
  if (
    tiktokPattern.test(url) || 
    pinterestPattern.test(url) || 
    instagramPattern.test(url) || 
    redditPattern.test(url) ||
    discordPattern.test(url)
  ) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=${encodeURIComponent(url)}`;
  }

  if (isBlockedDomain) {
    // Falls back to server proxy for any remaining blocked domains not handled above
    return `${API_BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
  }

  return url;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url || '';
  }
}

export function detectType(url: string): 'link' | 'image' | 'video' | 'pdf' | 'document' | 'html' {
  const l = url.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|svg|bmp|avif)(\?|$)/i.test(l)) return 'image';
  if (/\.pdf(\?|$)/i.test(l)) return 'pdf';
  if (/\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(l)) return 'video';
  if (/\.(docx?|pptx?|xlsx?)(\?|$)/i.test(l)) return 'document';
  if (/\.(html|htm)(\?|$)/i.test(l)) return 'html';
  if (/youtube\.com\/(watch|shorts)|youtu\.be\//.test(l)) return 'video';
  if (/vimeo\.com\/\d/.test(l)) return 'video';
  if (/tiktok\.com\/@.+\/video/.test(l)) return 'video';
  return 'link';
}

export function ytId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function ytThumb(url: string): string | null {
  const id = ytId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function favicon(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export function reltime(ts: number): string {
  if (!ts) return '—';
  const d = Date.now() - ts;
  const m = Math.floor(d / 6e4);
  const h = Math.floor(d / 36e5);
  const day = Math.floor(d / 864e5);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtBytes(b: number): string {
  if (b > 1048576) return `${(b / 1048576).toFixed(1)} MB`;
  if (b > 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

export async function compressImage(file: File, maxKB = 200): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        let width = img.width;
        let height = img.height;
        let quality = 0.9;
        const step = () => {
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const sizeKB = (dataUrl.length * 0.75) / 1024;
          if (sizeKB > maxKB) {
            if (quality > 0.2) {
              quality -= 0.1;
            } else if (width > 300) {
              width *= 0.85;
              height *= 0.85;
              quality = 0.8;
            } else {
              resolve(dataUrl);
              return;
            }
            step();
          } else {
            resolve(dataUrl);
          }
        };
        step();
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function fetchMeta(url: string): Promise<{
  title: string;
  description: string;
  thumbnail: string | null;
  domain: string;
  type: 'link' | 'image' | 'video' | 'pdf' | 'document' | 'html';
}> {
  url = url.trim().replace(/[.,;:!?)\]]+$/, '');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  // Pre-process and clean Reddit URLs to strip tracking query parameters
  // which can disrupt clean redirect tracking and server-side scraping results
  if (/(reddit\.com|redd\.it)/i.test(url)) {
    try {
      const parsed = new URL(url);
      const keysToClean = Array.from(parsed.searchParams.keys());
      for (const key of keysToClean) {
        if (key.startsWith('utm_') || key === 'context' || key === 'share_id') {
          parsed.searchParams.delete(key);
        }
      }
      url = parsed.toString();
    } catch (e) {
      console.warn('Failed to parse and clean Reddit URL:', e);
    }
  }

  const d = domainOf(url);
  const type = detectType(url);

  // Directly check for Instagram posts to bypass typical scraping errors or CORS issues on static hosts
  const igMatch = url.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i);
  if (igMatch && isStaticHost) {
    const shortcode = igMatch[1];
    return {
      title: `Instagram Post (${shortcode})`,
      description: 'Shared Instagram post content.',
      thumbnail: getProxyImageUrl(`https://www.instagram.com/p/${shortcode}/media/?size=l`),
      domain: 'instagram.com',
      type: 'link'
    };
  }

  // If on static host like GitHub Pages, completely avoid /api/meta requests (prevents 404/405 red logs)
  if (!isStaticHost) {
    try {
      const res = await fetch(`${API_BASE}/api/meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.title || data.thumbnail) {
          return {
            title: data.title || d,
            description: data.description || '',
            thumbnail: getProxyImageUrl(data.thumbnail || (type === 'video' ? ytThumb(url) : null)),
            domain: data.domain || d,
            type: type
          };
        }
      }
    } catch (e) {
      console.warn('Server meta proxy failed, falling back...', e);
    }
  }
  
  // Direct Image handling
  if (type === 'image') {
    const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] || '') || 'Image';
    return {
      title: name,
      description: '',
      thumbnail: getProxyImageUrl(url),
      domain: d,
      type
    };
  }

  // Microlink fallback (CORS-enabled direct client-side metadata scraper)
  try {
    // For social links like Pinterest, we add screenshot=true to bypass bot detection on free tier
    const isSocial = /(pinterest\.com|pin\.it|instagram\.com|fb\.com|facebook\.com|twitter\.com|x\.com)/i.test(url);
    const mUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&palette=true${isSocial ? '&screenshot=true' : ''}`;
    
    const res = await fetch(mUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success') {
        const data = json.data;
        return {
          title: data.title || d,
          description: data.description || '',
          thumbnail: getProxyImageUrl(data.image?.url || data.screenshot?.url || null),
          domain: d,
          type: 'link'
        };
      }
    }
  } catch (e) { 
    console.warn('Microlink fallback error:', e);
  }

  // Final screenshot/thumbnail fallback using thum.io
  return {
    title: d,
    description: '',
    thumbnail: `https://image.thum.io/get/width/400/crop/800/maxAge/24/${encodeURIComponent(url)}`,
    domain: d,
    type: 'link'
  };
}

