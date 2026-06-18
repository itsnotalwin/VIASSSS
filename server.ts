import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

app.get('/api/proxy-image', async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).send('url parameter is required');
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    if (!/^https?:\/\//i.test(decodedUrl)) {
      console.warn('Proxy image received custom/invalid URL:', decodedUrl);
      return res.status(400).send('Invalid absolute HTTP/HTTPS url parameter required');
    }

    const isInstagramUrl = /(instagram\.com|instagr\.am|cdninstagram\.com|fbcdn\.net)/i.test(decodedUrl);
    const isRedditUrl = /(redd\.it|reddit\.com|redditstatic\.com|preview\.redd\.it|i\.redd\.it)/i.test(decodedUrl);
    const isTikTokUrl = /(tiktok\.com|tiktokcdn|byteoversea|ibyteimg)/i.test(decodedUrl);
    
    let referer = '';
    if (isInstagramUrl) {
      referer = 'https://www.instagram.com/';
    } else if (isRedditUrl) {
      referer = 'https://www.reddit.com/';
    } else if (isTikTokUrl) {
      referer = 'https://www.tiktok.com/';
    } else {
      referer = 'https://www.google.com/';
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    
    if (referer) {
      headers['Referer'] = referer;
    }

    let imageRes = await fetch(decodedUrl, { headers });

    // If we get a 403, try once more without Referer (sometimes CDNs are picky about signed URLs)
    if (imageRes.status === 403 && referer) {
      const { Referer, ...headersWithoutReferer } = headers;
      imageRes = await fetch(decodedUrl, { headers: headersWithoutReferer as any });
    }

    if (!imageRes.ok) {
      // Secondary fallback to weserv.nl if our own proxy fails (common for picky social media CDNs)
      if (imageRes.status === 403 || imageRes.status === 401 || imageRes.status === 429) {
         try {
           const fallbackUrl = `https://images.weserv.nl/?url=${encodeURIComponent(decodedUrl)}`;
           const fallbackRes = await fetch(fallbackUrl);
           if (fallbackRes.ok) {
             const contentType = fallbackRes.headers.get('content-type') || 'image/jpeg';
             const arrayBuffer = await fallbackRes.arrayBuffer();
             res.setHeader('Content-Type', contentType);
             res.setHeader('Cache-Control', 'public, max-age=86400');
             return res.send(Buffer.from(arrayBuffer));
           }
         } catch (e) {
           // Fallback failed too, we will log below
         }
      }

      console.warn(`Failed parsing proxy image status ${imageRes.status} for url: ${decodedUrl}`);
      return res.status(imageRes.status).send('Failed to fetch image');
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (error) {
    console.error('Proxy image error:', error);
    return res.status(500).send('Error proxying image');
  }
});

import * as cheerio from 'cheerio';

app.post('/api/meta', async (req, res) => {
  const { url } = req.body;
  try {
    let targetUrl = url;
    
    // 1. Resolve canonical URL for shortlinks (pin.it) or Pinterest links
    // We try to follow redirects directly from the server first
    try {
      const headRes = await fetch(url, { 
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        }
      });
      targetUrl = headRes.url;
    } catch (e) {
      console.warn('URL resolution failed, using original:', e);
    }

    // 2. Pinterest OEmbed is the most reliable way to get high-quality images
    if (targetUrl.includes('pinterest.com/pin/') || targetUrl.includes('pin.it')) {
      try {
        const oeUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(targetUrl)}`;
        const oeRes = await fetch(oeUrl);
        if (oeRes.ok) {
          const oe = await oeRes.json();
          return res.json({
            title: oe.title || 'Pinterest Pin',
            description: '',
            thumbnail: oe.thumbnail_url || null,
            domain: 'pinterest.com',
          });
        }
      } catch (e) {
        console.warn('Pinterest OEmbed failed:', e);
      }
    }

    // 2.3 Instagram Post Check
    const igMatch = targetUrl.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i);
    if (igMatch) {
      const shortcode = igMatch[1];
      try {
        const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/`;
        const embedRes = await fetch(embedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          }
        });
        if (embedRes.ok) {
          const html = await embedRes.text();
          const $ = cheerio.load(html);
          
          let title = $('meta[property="og:title"]').attr('content')
            || $('meta[property="og:description"]').attr('content')
            || `Instagram Post (${shortcode})`;
          
          let description = $('meta[property="og:description"]').attr('content')
            || 'Shared Instagram post content.';
            
          let thumbnail = $('meta[property="og:image"]').attr('content')
            || $('.EmbeddedMediaImage').attr('src')
            || `https://www.instagram.com/p/${shortcode}/media/?size=l`;

          if (title && title.toLowerCase() === 'instagram') {
            title = `Instagram Post (${shortcode})`;
          }

          title = title.replace(/\s+/g, ' ').trim();
          description = description.replace(/\s+/g, ' ').trim();

          return res.json({
            title,
            description,
            thumbnail,
            domain: 'instagram.com',
          });
        }
      } catch (e) {
        console.warn('Instagram embed metadata fetch failed, using fallback:', e);
      }

      return res.json({
        title: `Instagram Post (${shortcode})`,
        description: 'Shared Instagram post content.',
        thumbnail: `https://www.instagram.com/p/${shortcode}/media/?size=l`,
        domain: 'instagram.com',
      });
    }

    // 2.5 YouTube OEmbed Check
    if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
      try {
        const ytOeUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;
        const ytRes = await fetch(ytOeUrl);
        if (ytRes.ok) {
          const oe = await ytRes.json();
          return res.json({
            title: oe.title || '',
            description: '',
            thumbnail: oe.thumbnail_url || null,
            domain: 'youtube.com',
          });
        }
      } catch (e) {
        console.warn('YouTube OEmbed failed:', e);
      }
    }

    // 2.6 Reddit Check (Dual-layered JSON-based and whitelisted scraping)
    if (targetUrl.includes('reddit.com') || targetUrl.includes('redd.it')) {
      try {
        // Resolve canonical link first
        let canonicalUrl = targetUrl;
        const headRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
          },
          redirect: 'follow'
        });
        if (headRes.ok) {
          canonicalUrl = headRes.url || targetUrl;
        }

        // Try public JSON endpoint for high-quality media extraction
        let jsonUrl = canonicalUrl;
        if (jsonUrl.includes('?')) {
          jsonUrl = jsonUrl.split('?')[0];
        }
        if (jsonUrl.endsWith('/')) {
          jsonUrl = jsonUrl.slice(0, -1);
        }
        jsonUrl = jsonUrl + '.json';

        const jsonRes = await fetch(jsonUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          }
        });

        if (jsonRes.ok) {
          const data = await jsonRes.json();
          let postData: any = null;
          if (Array.isArray(data)) {
            postData = data[0]?.data?.children?.[0]?.data;
          } else if (data && data.kind === 'Listing') {
            postData = data.data?.children?.[0]?.data;
          } else if (data && data.kind === 't3') {
            postData = data.data;
          }

          if (postData) {
            let title = postData.title || '';
            title = title.replace(/\s+/g, ' ').trim();

            let description = postData.selftext || '';
            if (description.length > 300) {
              description = description.slice(0, 300) + '...';
            }
            if (!description && postData.subreddit) {
              description = `Posted in r/${postData.subreddit}`;
              if (postData.author) {
                description += ` by u/${postData.author}`;
              }
            }

            let thumbnail: string | null = null;

            // 1. Gallery check
            if (postData.is_gallery && postData.media_metadata) {
              const keys = Object.keys(postData.media_metadata);
              if (keys.length > 0) {
                const galleryObj = postData.media_metadata[keys[0]];
                if (galleryObj?.s?.u) {
                  thumbnail = galleryObj.s.u;
                } else if (galleryObj?.p && galleryObj.p.length > 0) {
                  thumbnail = galleryObj.p[galleryObj.p.length - 1].u;
                }
              }
            }

            // 2. Preview check (contains high-res source/resolutions array)
            if (!thumbnail && postData.preview?.images?.[0]) {
              const imgObj = postData.preview.images[0];
              if (imgObj.source?.url) {
                thumbnail = imgObj.source.url;
              } else if (imgObj.resolutions && imgObj.resolutions.length > 0) {
                thumbnail = imgObj.resolutions[imgObj.resolutions.length - 1].url;
              }
            }

            // 3. Direct image link check in post URL
            if (!thumbnail && postData.url) {
              const endsWithImg = /\.(jpe?g|png|gif|webp|bmp|avif)(\?|$)/i.test(postData.url) ||
                                  /i\.redd\.it/i.test(postData.url) ||
                                  /preview\.redd\.it/i.test(postData.url);
              if (endsWithImg) {
                thumbnail = postData.url;
              }
            }

            // 4. Valid non-generic thumbnail fallback
            if (!thumbnail && postData.thumbnail && /^https?:\/\//i.test(postData.thumbnail)) {
              thumbnail = postData.thumbnail;
            }

            if (thumbnail) {
              thumbnail = thumbnail.replace(/&amp;/g, '&');
            }

            // Avoid returning generic Reddit brand logos as thumbnails
            const isGenericLogo = thumbnail && (
              thumbnail.includes('redditstatic.com') ||
              thumbnail.includes('gpub_logo') ||
              thumbnail.includes('reddit.com/static') ||
              thumbnail.includes('reddit_logo')
            );

            if (thumbnail && !isGenericLogo) {
              const hostname = new URL(canonicalUrl).hostname.replace('www.', '');
              return res.json({
                title: title || postData.title || 'Reddit Post',
                description: description || 'Reddit post content',
                thumbnail,
                domain: hostname,
              });
            }
          }
        }
      } catch (jsonErr) {
        console.warn('Reddit JSON metadata extraction failed, falling back to direct scraping:', jsonErr);
      }

      // If JSON API fails or has no high-res post images, fall back to whitelisted scraping
      try {
        const redditRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          redirect: 'follow'
        });

        if (redditRes.ok) {
          const canonicalUrl = redditRes.url || targetUrl;
          const html = await redditRes.text();
          const $ = cheerio.load(html);

          let title = $('meta[property="og:title"]').attr('content') || 
                      $('meta[name="twitter:title"]').attr('content') || 
                      $('title').text() || '';
          
          title = title.replace(/\s+/g, ' ').trim();
          title = title.replace(/\s*[:|-]\s*(r\/\w+|reddit)\s*$/i, '');

          let description = $('meta[property="og:description"]').attr('content') || 
                            $('meta[name="description"]').attr('content') || '';
          description = description.replace(/\s+/g, ' ').trim();

          let thumbnail = $('meta[property="og:image"]').attr('content') || 
                          $('meta[name="twitter:image"]').attr('content') || 
                          $('link[rel="image_src"]').attr('href') || null;

          if (thumbnail) {
            thumbnail = thumbnail.replace(/&amp;/g, '&');
            if (thumbnail.startsWith('/')) {
              const parsedUrl = new URL(canonicalUrl);
              thumbnail = `${parsedUrl.protocol}//${parsedUrl.host}${thumbnail}`;
            }
          }

          // Avoid returning generic Reddit brand logos as thumbnails
          const isGenericLogo = thumbnail && (
            thumbnail.includes('redditstatic.com') ||
            thumbnail.includes('gpub_logo') ||
            thumbnail.includes('reddit.com/static') ||
            thumbnail.includes('reddit_logo')
          );

          if (!thumbnail || isGenericLogo) {
            try {
              const redditOeUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
              const oeRes = await fetch(redditOeUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                }
              });
              if (oeRes.ok) {
                const oe = await oeRes.json();
                const oeThumb = oe.thumbnail_url || null;
                if (oeThumb && !(oeThumb.includes('redditstatic.com') || oeThumb.includes('reddit_logo'))) {
                  thumbnail = oeThumb;
                }
                if (!title) title = oe.title;
              }
            } catch (e) {
              console.warn('Reddit oEmbed secondary fallback failed:', e);
            }
          }

          const hostname = new URL(canonicalUrl).hostname.replace('www.', '');

          return res.json({
            title: title || 'Reddit Post',
            description: description || 'Reddit post content',
            thumbnail: thumbnail || null,
            domain: hostname,
          });
        }
      } catch (e) {
        console.warn('Reddit fallback direct scraping failed:', e);
      }
    }

    // 2.7 TikTok Check (oEmbed)
    if (targetUrl.includes('tiktok.com')) {
      try {
        const ttOeUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;
        const ttRes = await fetch(ttOeUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          }
        });
        if (ttRes.ok) {
          const oe = await ttRes.json();
          return res.json({
            title: oe.title || 'TikTok Video',
            description: oe.author_name ? `By @${oe.author_name}` : '',
            thumbnail: oe.thumbnail_url || null,
            domain: 'tiktok.com',
          });
        }
      } catch (e) {
        console.warn('TikTok OEmbed fetch failed:', e);
      }
    }

    // 3. General Scraping Fallback
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };

    // Yahoo specific tweak
    if (targetUrl.includes('yahoo.com')) {
      headers['Referer'] = 'https://www.google.com/';
      // Sometimes adding a dummy cookie helps with consent walls
      headers['Cookie'] = 'GUC=AQEBCAFmO...;'; 
    }

    const response = await fetch(targetUrl, { headers });
    
    let html = await response.text();
    let $ = cheerio.load(html);
    
    let title = $('meta[property="og:title"]').attr('content') || 
                $('meta[name="twitter:title"]').attr('content') || 
                $('title').text() || 
                $('h1').first().text() || '';

    let description = $('meta[name="description"]').attr('content') || 
                      $('meta[property="og:description"]').attr('content') || 
                      $('meta[name="twitter:description"]').attr('content') || '';
    
    // Yahoo often includes " - Yahoo Finance" or similar in title, which is fine, 
    // but if title is JUST "Yahoo" or "Yahoo Finance", we should look deeper.
    const genericTitles = ['yahoo', 'yahoo finance', 'yahoo news', 'yahoo mail', 'yahoo search'];
    if (genericTitles.includes(title.toLowerCase().trim()) || !title) {
        const h1 = $('h1').first().text();
        if (h1 && h1.length > 5) title = h1;
    }

    let thumbnail = $('meta[property="og:image"]').attr('content') || 
                    $('meta[name="twitter:image"]').attr('content') || 
                    $('link[rel="image_src"]').attr('href') || '';
    
    // 3.1. Extensive Image Scraping (if OG image is missing)
    if (!thumbnail) {
      // Look for high-res icons first
      thumbnail = $('link[rel="apple-touch-icon"]').attr('href') ||
                  $('link[rel="icon"][sizes="192x192"]').attr('href') ||
                  $('link[rel="icon"][sizes="512x512"]').attr('href') ||
                  $('link[rel="shortcut icon"]').attr('href') ||
                  $('link[rel="icon"]').attr('href') || '';
                  
      // If still no thumbnail, scan body for a reasonable image (limit to first 10 images)
      if (!thumbnail) {
        $('img').slice(0, 10).each((i, el) => {
          const src = $(el).attr('src');
          if (src && src.startsWith('http') && !thumbnail) {
            const width = parseInt($(el).attr('width') || '0');
            const height = parseInt($(el).attr('height') || '0');
            // Prefer images that look like hero images or are decently sized
            if ((width > 300 || height > 300) || src.includes('hero') || src.includes('cover') || src.includes('feature')) {
              thumbnail = src;
            }
          }
        });
      }

      // Handle relative paths for thumbnails found via atypical methods
      if (thumbnail && !thumbnail.startsWith('http')) {
        try {
          const base = new URL(targetUrl);
          thumbnail = new URL(thumbnail, base.origin).toString();
        } catch (e) {
          thumbnail = '';
        }
      }
    }

    // 3.2. Final Fallback: If absolutely no image found, use clear high-res Google favicon service
    if (!thumbnail) {
      try {
        const domain = new URL(targetUrl).hostname;
        thumbnail = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
      } catch (e) {
        thumbnail = null;
      }
    }
    
    // Clean up title
    title = title.replace(/\s+/g, ' ').trim();
    
    res.json({
      title,
      description,
      thumbnail: thumbnail || null,
      domain: new URL(targetUrl).hostname.replace('www.', ''),
    });
  } catch (error) {
    console.error('Meta extraction failed:', error);
    try {
        const d = new URL(url).hostname.replace('www.', '');
        res.json({ title: d, description: '', thumbnail: null, domain: d });
    } catch {
        res.json({ title: '', description: '', thumbnail: null, domain: '' });
    }
  }
});

// Groq Helper
async function callGroq(prompt: string, apiKey: string) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an AI assistant that ONLY responds with valid JSON objects.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Groq error ${res.status}:`, errorText);
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content;
  } catch (error) {
    console.error('Groq fetch error:', error);
    return null;
  }
}

app.post('/api/ai/tags', async (req, res) => {
  const { title, description, url, groqKey } = req.body;
  
  const prompt = `Analyze the following item and provide enrichment data.
If the current title is generic (like a domain name), suggest a better, more descriptive "title".
Also extract 1-3 short, relevant "tags".

Item Info:
URL: ${url}
Title: ${title}
Description: ${description}

Return ONLY a JSON object with this structure:
{
  "title": "A better title",
  "tags": ["tag1", "tag2"]
}

Ensure the title is concise and the tags are strictly lowercase.`;

  try {
    const finalGroqKey = groqKey || process.env.GROQ_API_KEY;

    if (!finalGroqKey) {
      return res.json({ tags: [], suggestedTitle: null, error: 'No Groq API key configured' });
    }

    const text = await callGroq(prompt, finalGroqKey);
    if (text) {
      const parsed = JSON.parse(text);
      return res.json({
        tags: parsed.tags || [],
        suggestedTitle: parsed.title || null
      });
    } else {
      return res.json({ tags: [], suggestedTitle: null, error: 'AI tag generation service failed' });
    }
  } catch (error) {
    console.error('AI Enrichment failed:', error);
    res.json({ tags: [], suggestedTitle: null, error: 'AI tagging failed' });
  }
});

app.post('/api/ai/autotag', async (req, res) => {
  const { items, groqKey } = req.body;
  
  const prompt = `You are an expert AI archivist. Your job is to assign high-quality, relevant, and consistent tags to the list of archived items below.
For each item, suggest 2-4 lowercase tags that link it to design, tech, productivity, aesthetics, media, or other precise topics. Try to reuse tags across similar and related items to create a clean, connected library of content.

Items to tag:
${JSON.stringify(items)}

Return ONLY a valid JSON object matching the structure below:
{
  "tags": {
    "item_id_1": ["tag1", "tag2"],
    "item_id_2": ["tag2", "tag3"]
  }
}

Do not include any other markdown, pretext, or posttext. Return only raw JSON.`;

  try {
    const finalGroqKey = groqKey || process.env.GROQ_API_KEY;

    if (!finalGroqKey) {
      return res.json({ tags: {}, error: 'No Groq API key configured' });
    }

    const text = await callGroq(prompt, finalGroqKey);
    if (text) {
      const parsed = JSON.parse(text);
      return res.json({
        tags: parsed.tags || {}
      });
    } else {
      return res.json({ tags: {}, error: 'AI bulk tagging service failed' });
    }
  } catch (error) {
    console.error('AI bulk tagging failed:', error);
    res.json({ tags: {}, error: 'AI bulk tagging failed' });
  }
});

app.post('/api/ai/search', async (req, res) => {
  const { query, items, groqKey } = req.body;
  const prompt = `You are an intelligent search assistant. Match the user's semantic search query with the items in the list.\nQuery: "${query}"\n\nItems (JSON):\n${JSON.stringify(items)}\n\nReturn a raw JSON object containing an array of matched IDs under the key "matchedIds", sorted by relevance. Return ONLY JSON.`;

  try {
    const finalGroqKey = groqKey || process.env.GROQ_API_KEY;

    if (!finalGroqKey) {
      return res.json({ matchedIds: [], error: 'No Groq API key configured' });
    }

    const text = await callGroq(prompt, finalGroqKey);
    if (text) {
      return res.json(JSON.parse(text));
    } else {
      return res.json({ matchedIds: [], error: 'Semantic search failed' });
    }
  } catch (error) {
    console.error('Semantic search failed:', error);
    res.json({ matchedIds: [], error: 'Semantic search temporarily unavailable' });
  }
});

app.post('/api/ai/cluster', async (req, res) => {
  const { items, groqKey } = req.body;
  const prompt = `Analyze the following list of archived items and automatically group them into 3-6 themed "Colonies" (folders).
For each colony, provide:
1. A unique ID (short slug)
2. A descriptive "name" (1-3 words)
3. A short "description" of what links them
4. An array of "itemIds" belonging to this colony.

Every item MUST belong to exactly one colony. If an item doesn't fit, put it in a "General" or "Miscellaneous" colony.

Items (JSON):
${JSON.stringify(items.map((i: any) => ({ id: i.id, title: i.title, type: i.type, tags: i.tags })))}

Return ONLY a JSON object with a "colonies" array.`;

  try {
    const finalGroqKey = groqKey || process.env.GROQ_API_KEY;

    if (!finalGroqKey) {
      return res.json({ colonies: [], error: 'No Groq API key configured' });
    }

    const text = await callGroq(prompt, finalGroqKey);
    if (text) {
      return res.json(JSON.parse(text));
    } else {
      return res.json({ colonies: [], error: 'Auto-clustering failed' });
    }
  } catch (error) {
    console.error('Clustering failed:', error);
    res.json({ colonies: [], error: 'Auto-clustering temporarily unavailable' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
