/* =====================================================================
   KONE-MEDIA Africa — static pre-render build
   ---------------------------------------------------------------------
   Fetches all posts from WordPress and writes a real, standalone HTML
   file for every page (home, each article, each category, contact),
   with the actual content + SEO tags baked into the raw HTML.

   Design comes from template.html (unchanged look). Content comes from
   WordPress. Output goes to /dist, which Netlify publishes.

   Run:  node build.mjs
   ===================================================================== */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const WP   = 'https://cms.konemedia.co.ke';
const SITE = 'https://konemedia.co.ke';
const CATEGORIES = ['Sports','Business','Finance','Health','Technology','AI','Guides','Top 10'];
const CAT_DESC = {
  'Sports':'Football, athletics and the stories shaping Kenyan and African sport.',
  'Business':'Companies, markets and the trends driving the regional economy.',
  'Finance':'Banking, currencies, policy and personal money matters.',
  'Health':'Public health, medicine and wellbeing across the continent.',
  'Technology':'Startups, infrastructure and the digital economy in Africa.',
  'AI':'How artificial intelligence is being built and used across Africa.',
  'Guides':'Practical, expert-led explainers to help you make better decisions.',
  'Top 10':'Curated rankings of the people, places and companies that matter.'
};
// Posts here use NO trailing slash; every other post keeps the trailing slash.
const NO_TRAILING_SLASH = new Set(['best-sites-to-play-aviator-in-kenya-a-ranked-comparison']);
const CONTACT_EMAIL = 'konemediakenya1@gmail.com';
const BRAND = 'KONE-MEDIA Africa';
const HOME_TITLE = 'K-One Media | Industry Expert Knowledge Shared.';
const HOME_DESC  = 'K-One Media Africa shares expert news and analysis on business, finance, sports, health, technology and AI from right across Kenya and the continent.';
const CONTACT_TITLE = 'Contact KONE-MEDIA Africa | Get in Touch With Our Team';
const CONTACT_DESC  = 'Get in touch with the KONE-MEDIA Africa team for news tips, story ideas, partnerships, advertising and general enquiries from across Kenya and Africa.';

const OUT = path.resolve('dist');

/* ---------------- small helpers ---------------- */
const esc = (s)=>String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const escAttr = (s)=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

const NAMED = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',hellip:'…',mdash:'—',ndash:'–',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”'};
function decodeEntities(s){
  return String(s==null?'':s)
    .replace(/&#(\d+);/g, (_,n)=>{ try{ return String.fromCodePoint(+n); }catch(e){ return ''; } })
    .replace(/&#x([0-9a-f]+);/gi, (_,n)=>{ try{ return String.fromCodePoint(parseInt(n,16)); }catch(e){ return ''; } })
    .replace(/&([a-z]+);/gi, (m,name)=> (name.toLowerCase() in NAMED) ? NAMED[name.toLowerCase()] : m);
}
function stripHtml(html){
  return decodeEntities(String(html||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
}
function fmtDate(iso){
  try{ return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }
  catch(e){ return ''; }
}
function readTimeFromHtml(html){
  const words = stripHtml(html).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words/200)) + ' min read';
}
function mediaUrls(media){
  const full = media && media.source_url;
  const sizes = (media && media.media_details && media.media_details.sizes) || {};
  const pick = (...keys)=>{ for(const k of keys){ if(sizes[k] && sizes[k].source_url) return sizes[k].source_url; } return null; };
  const large = pick('large','medium_large','1536x1536') || full;
  const card  = pick('medium_large','medium','large') || large || full;
  const thumb = pick('medium','thumbnail') || card || full;
  const fb = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10"><rect width="16" height="10" fill="#e9e3d6"/></svg>');
  return { img: large || fb, imgCard: card || fb, imgThumb: thumb || fb };
}
function mapPost(p){
  const emb = p._embedded || {};
  const media = emb['wp:featuredmedia'] && emb['wp:featuredmedia'][0];
  const terms = emb['wp:term'] || [];
  const catTerm = (terms[0] || []).find(t=>t.taxonomy==='category');
  const tagNames = (terms[1] || []).map(t=>(t.slug||t.name||'').toLowerCase());
  const author = emb.author && emb.author[0] ? emb.author[0].name : 'KONE-MEDIA';
  const category = catTerm ? catTerm.name : 'News';
  const excerpt = stripHtml(p.excerpt && p.excerpt.rendered);
  const m = mediaUrls(media);
  return {
    id: (p.slug && p.slug.length) ? p.slug : String(p.id), postId: p.id,
    title: stripHtml(p.title && p.title.rendered), category, author,
    date: fmtDate(p.date), dateLine: fmtDate(p.date), modified: p.modified || p.date, excerpt,
    shortExcerpt: excerpt.length>92 ? excerpt.slice(0,90).trim()+'…' : excerpt,
    img: m.img, imgCard: m.imgCard, imgThumb: m.imgThumb, caption:`${category} · KONE-MEDIA Africa`,
    readTime: readTimeFromHtml(p.content && p.content.rendered),
    bodyHtml: wrapTables((p.content && p.content.rendered) || `<p>${esc(excerpt)}</p>`),
    tags: tagNames
  };
}
// Make wide tables scroll sideways on small screens (done at build time now)
function wrapTables(html){
  return String(html||'').replace(/<table[\s\S]*?<\/table>/gi, (t)=>`<div class="table-scroll">${t}</div>`);
}

/* ---------------- URL paths (trailing-slash rules preserved) ---------------- */
const pArticle  = (id)=> '/' + encodeURIComponent(id) + (NO_TRAILING_SLASH.has(id) ? '' : '/');

// Rewrite in-content links that point at the WordPress origin (cms.konemedia.co.ke)
// to the public front-end. Only rewrites links to posts we actually built (and the
// site root). Leaves images, files (/wp-*), feeds, and unknown pages untouched.
function rewriteInternalLinks(html, slugSet){
  if(!html) return html;
  return html.replace(/href="https?:\/\/cms\.konemedia\.co\.ke(\/[^"]*)?"/gi, (m, path)=>{
    if(!path || path === '/') return 'href="/"';                 // WP home -> site home
    if(/^\/(wp-|feed|xmlrpc|author\/|tag\/|category\/)/i.test(path)) return m; // system/asset/archive
    const seg = path.replace(/^\//,'').replace(/[?#].*$/,'').replace(/\/$/,'');
    if(seg && !seg.includes('/') && slugSet.has(seg)) return `href="${pArticle(seg)}"`;
    return m;                                                     // unknown page -> leave as-is
  });
}
const pCategory = (name)=> '/' + String(name).trim().replace(/\s+/g,'-');
const pContact  = ()=> '/contact';

/* ---------------- SEO title/description fitting (45-55 / 145-155) ---------------- */
function collapse(s){ return String(s==null?'':s).replace(/\s+/g,' ').trim(); }
function truncWord(s,max){
  if(s.length<=max) return s;
  let t = s.slice(0,max); const i = t.lastIndexOf(' ');
  if(i>20) t = t.slice(0,i);
  return t.replace(/[\s,.;:–—-]+$/,'');
}
function fitTitle(base){
  base = collapse(base);
  const cands = [ base+' | '+BRAND, base+' | KONE-MEDIA', base+' | KONE', base ];
  for(const c of cands){ if(c.length>=45 && c.length<=55) return c; }
  const withBrand = base+' | '+BRAND;
  if(withBrand.length < 45){
    const padded = base+' News & Analysis | '+BRAND;
    return (padded.length<=55) ? padded : withBrand;
  }
  const suffix = ' | KONE-MEDIA';
  const out = truncWord(base, 55 - suffix.length) + suffix;
  return (out.length>=45 && out.length<=55) ? out : truncWord(base, 55);
}
function fitDesc(base){
  base = collapse(base);
  if(base.length > 155) return truncWord(base,154) + '…';
  if(base.length >= 145) return base;
  const pad = 'Read the latest news and expert analysis from across Kenya and Africa on KONE-MEDIA Africa.';
  let d = collapse(base.replace(/[.\s]+$/,'') + '. ' + pad);
  if(d.length > 155) d = truncWord(d,154) + '…';
  return d;
}

/* ---------------- page-body builders (ported from the app, exact markup) ---------------- */
function buildHome(items){
  const byCat = (c)=> items.filter(a=>a.category===c);
  const latest    = items[0];
  const secondary = items.slice(1,4);
  const tagged    = items.filter(a=>a.tags && a.tags.includes('featured'));
  const featured  = (tagged.length ? tagged : items).slice(0,5);
  const trending  = items.slice(0,10);
  const sports    = byCat('Sports').slice(0,4);
  const business  = byCat('Business').filter(a=>!latest || a.id!==latest.id).slice(0,4);
  return { latest, secondary, sports, business, featured, trending };
}
function homeBody(items){
  const h = buildHome(items);
  if(!h.latest) return `<div class="state" style="text-align:center;padding:60px 20px;">No stories to show yet.</div>`;
  const sideList = (arr)=> arr.map(a=>`
    <a class="side-link" href="${pArticle(a.id)}">
      <img src="${escAttr(a.imgThumb)}" alt="" loading="lazy" decoding="async" width="60" height="54">
      <div>
        <h4>${esc(a.title)}</h4>
        <div class="dl">${esc(a.dateLine)}</div>
      </div>
    </a>`).join('');
  return `
  <h1 class="home-h1">Industry Expert Knowledge</h1>
  <section class="home-grid">
    <section>
      <a class="cover-link" href="${pArticle(h.latest.id)}">
        <div class="cover-imgwrap">
          <img src="${escAttr(h.latest.img)}" alt="" fetchpriority="high" decoding="async" width="900" height="600">
          <span class="badge">Latest</span>
        </div>
        <h2 class="cover-title">${esc(h.latest.title)}</h2>
        <div class="dateline">${esc(h.latest.dateLine)}</div>
        <p class="cover-excerpt">${esc(h.latest.excerpt)}</p>
      </a>
    </section>
    <section>
      ${h.secondary.map(a=>`
        <a class="story-link" href="${pArticle(a.id)}">
          <img src="${escAttr(a.imgThumb)}" alt="" loading="lazy" decoding="async" width="120" height="96">
          <div>
            <h3>${esc(a.title)}</h3>
            <div class="dl">${esc(a.dateLine)}</div>
            <p>${esc(a.shortExcerpt)}</p>
          </div>
        </a>`).join('')}
    </section>
    <aside>
      <div class="side-block">
        <div class="side-head"><h3>Sports</h3><a class="side-more" href="${pCategory('Sports')}">More →</a></div>
        ${sideList(h.sports)}
      </div>
      <div class="side-block">
        <div class="side-head"><h3>Business</h3><a class="side-more" href="${pCategory('Business')}">More →</a></div>
        ${sideList(h.business)}
      </div>
    </aside>
  </section>
  <section class="section">
    <h2 class="featured-title">Featured Stories</h2>
    <div class="featured-grid">
      ${h.featured.map(a=>`
        <a class="feat-card" href="${pArticle(a.id)}">
          <img src="${escAttr(a.imgCard)}" alt="" loading="lazy" decoding="async">
          <div class="scrim"></div>
          <div class="cap">
            <span class="eyebrow">${esc(a.category)}</span>
            <h3>${esc(a.title)}</h3>
            <div class="dl">${esc(a.dateLine)}</div>
          </div>
        </a>`).join('')}
    </div>
  </section>
  <section class="trending">
    <div class="trend-head"><h2>Trending</h2><span class="sub">Top 10 This Week</span></div>
    <div class="trend-grid">
      ${h.trending.map((a,i)=>`
        <a class="trend-link" href="${pArticle(a.id)}">
          <span class="rank">${String(i+1).padStart(2,'0')}</span>
          <div>
            <span class="eyebrow">${esc(a.category)}</span>
            <h4>${esc(a.title)}</h4>
          </div>
        </a>`).join('')}
    </div>
  </section>`;
}

function articleBody(art, items){
  // "More in {category}" — up to 10, newest first (items are already newest-first)
  const related = items.filter(a=>a.category===art.category && a.id!==art.id).slice(0,10);
  const slugSet = new Set(items.map(a=>a.id));
  const bodyHtml = rewriteInternalLinks(art.bodyHtml || '', slugSet);
  return `
  <a class="backlink" href="/">← Back to home</a>
  <div class="article-grid">
    <article class="article-body">
      <span class="art-eyebrow">${esc(art.category)}</span>
      <h1 class="art-title">${esc(art.title)}</h1>
      <div class="art-meta">
        <span class="by">By ${esc(art.author)}</span>
        <span class="sep">•</span><span style="font-style:italic;">${esc(art.dateLine)}</span>
        <span class="sep">•</span><span>${esc(art.readTime)}</span>
      </div>
      <img class="art-cover" src="${escAttr(art.img)}" alt="" fetchpriority="high" decoding="async">
      <div class="art-caption">${esc(art.caption)}</div>
      <div class="art-content">${bodyHtml}</div>
      <div class="share-row">
        <span class="lbl">Share:</span>
        <a class="share-ico" style="background:var(--orange)" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE+pArticle(art.id))}" target="_blank" rel="noopener" aria-label="Share on Facebook"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.5-1.5h1.6V3.6c-.28-.04-1.24-.12-2.36-.12-2.33 0-3.93 1.42-3.93 4.04v2.25H7v3.1h2.81V21z"/></svg></a>
        <a class="share-ico" style="background:var(--blue)" href="https://wa.me/?text=${encodeURIComponent(art.title+' '+SITE+pArticle(art.id))}" target="_blank" rel="noopener" aria-label="Share on WhatsApp"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M18 2l-5.5 7L19 22h-4.2l-4-5.8L5.9 22H3l6-7.6L2.4 2h4.3l3.6 5.3L15.1 2z"/></svg></a>
        <a class="share-ico" style="background:#1d9bf0" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(SITE+pArticle(art.id))}&text=${encodeURIComponent(art.title)}" target="_blank" rel="noopener" aria-label="Share on X"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M20 6.5a6.5 6.5 0 01-1.9.5 3.3 3.3 0 001.45-1.8 6.6 6.6 0 01-2.1.8A3.3 3.3 0 0012 8.9c0 .26.03.5.08.74A9.3 9.3 0 015.3 5.9a3.3 3.3 0 001 4.4c-.5 0-.97-.16-1.4-.38v.04a3.3 3.3 0 002.65 3.24c-.45.12-.92.14-1.38.05a3.3 3.3 0 003.08 2.3A6.6 6.6 0 013 19.05 9.3 9.3 0 008 20.5c6 0 9.3-5 9.3-9.3v-.42A6.6 6.6 0 0020 6.5z"/></svg></a>
      </div>
    </article>
    <aside>
      <div class="rel-head"><h3>More in ${esc(art.category)}</h3></div>
      ${related.map(a=>`
        <a class="rel-link" href="${pArticle(a.id)}">
          <img src="${escAttr(a.imgThumb)}" alt="" loading="lazy" decoding="async" width="74" height="62">
          <div><h4>${esc(a.title)}</h4><div class="dl">${esc(a.dateLine)}</div></div>
        </a>`).join('') || '<p style="font-family:var(--serif);color:var(--muted);font-size:14px;">More stories coming soon.</p>'}
      <form name="newsletter" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/thank-you/" class="signup">
        <input type="hidden" name="form-name" value="newsletter">
        <p hidden><label>Leave blank <input name="bot-field"></label></p>
        <h3>Stay informed</h3>
        <p>Get expert industry analysis from across Kenya and Africa in your inbox.</p>
        <div class="field">
          <input type="email" name="email" id="nl-email" placeholder="Your email" required>
          <button type="submit" id="nl-btn">Subscribe</button>
        </div>
        <div class="note" id="nl-note" style="display:none;"></div>
      </form>
    </aside>
  </div>`;
}

function categoryBody(name, items){
  const all = items.filter(a=>a.category===name);          // every post ever in this category
  const PER = 20;
  const cards = all.map((a,i)=>`
      <a class="cat-card${i>=PER?' cat-hidden':''}" href="${pArticle(a.id)}">
        <img src="${escAttr(a.imgCard)}" alt="" loading="lazy" decoding="async">
        <span class="eyebrow">${esc(a.category)}</span>
        <h3>${esc(a.title)}</h3>
        <div class="dl">${esc(a.dateLine)}</div>
        <p>${esc(a.shortExcerpt)}</p>
      </a>`).join('') || '<p style="font-family:var(--serif);color:var(--muted);">No stories in this section yet.</p>';
  const remaining = Math.max(0, all.length - PER);
  return `
  <div class="cat-head">
    <span class="eyebrow">Category</span>
    <h1>${esc(name)}</h1>
    <p>${esc(CAT_DESC[name] || '')}</p>
  </div>
  <div class="cat-grid">${cards}</div>
  ${remaining>0 ? `<div class="more-wrap"><button id="cat-more" class="more-btn" data-step="${PER}">Read more <span class="more-count">${remaining} more</span></button></div>` : ''}`;
}

function contactBody(){
  return `
  <div class="cat-head">
    <span class="eyebrow">Get in touch</span>
    <h1>Contact KONE-MEDIA Africa</h1>
    <p>Have a news tip, a story idea, a partnership in mind, or a question? We'd love to hear from you.</p>
  </div>
  <div class="contact-grid">
    <div class="contact-info">
      <h3>Reach us directly</h3>
      <p class="ci-label">Email</p>
      <p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
      <p class="ci-label">Address</p>
      <p>Kenya House Complex,<br>Koinange Street, 5th Floor<br>Nairobi, Kenya</p>
    </div>
    <form name="contact" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/thank-you/" class="contact-form">
      <input type="hidden" name="form-name" value="contact">
      <p hidden><label>Leave blank <input name="bot-field"></label></p>
      <h3>Send us a message</h3>
      <div class="cf-row"><input name="name" id="cf-name" type="text" placeholder="Your name" required></div>
      <div class="cf-row"><input name="email" id="cf-email" type="email" placeholder="Your email" required></div>
      <div class="cf-row"><textarea name="message" id="cf-msg" rows="5" placeholder="How can we help?" required></textarea></div>
      <button type="submit" id="cf-send" class="more-btn">Send message</button>
      <div class="cf-note" id="cf-note" style="display:none;"></div>
    </form>
  </div>`;
}

function simpleBody(title, msg){
  return `<div class="state" style="font-family:var(--serif);color:var(--ink2);text-align:center;padding:70px 20px;line-height:1.7;">
    <h1 style="font-family:var(--display);color:var(--ink);">${esc(title)}</h1>
    <p>${msg}</p>
    <p><a href="/" style="color:var(--orange);font-weight:600;">← Back to home</a></p>
  </div>`;
}

/* ---------------- template assembly ---------------- */
function navHtml(){
  const items = [{label:'Home',href:'/'}]
    .concat(CATEGORIES.map(c=>({label:c,href:pCategory(c)})))
    .concat([{label:'Contact',href:pContact()}]);
  return items.map(i=>`<li><a href="${i.href}">${esc(i.label)}</a></li>`).join('');
}
function applyChrome(tpl){
  // fill nav, footer sections and year once (same on every page)
  return tpl
    .replace('<ul id="nav-list"></ul>', `<ul id="nav-list">${navHtml()}</ul>`)
    .replace('<ul class="foot-sections" id="foot-sections"></ul>', `<ul class="foot-sections" id="foot-sections">${navHtml()}</ul>`)
    .replace('<span id="year"></span>', `<span id="year">${new Date().getFullYear()}</span>`)
    // swap the big single-page script for the small enhancement script.
    // Match ONLY the last <script> (negative lookahead: no further <script ahead),
    // so other head scripts like Google Tag Manager are left untouched.
    .replace(/<script>(?![\s\S]*<script)[\s\S]*?<\/script>/, '<script src="/assets/app.js" defer></script>');
}
function setAttr(html, id, attr, value){
  const re = new RegExp(`(<[^>]*\\bid="${id}"[^>]*\\b${attr}=")[^"]*(")`);
  return html.replace(re, `$1${escAttr(value)}$2`);
}
function renderPage(chromeTpl, { title, desc, canonicalPath, robots, ogType, image, mainInner }){
  const url = SITE + canonicalPath;
  let html = chromeTpl;
  html = html.replace(/(<title id="meta-title">)[\s\S]*?(<\/title>)/, `$1${esc(title)}$2`);
  html = setAttr(html,'meta-desc','content',desc);
  html = setAttr(html,'meta-canonical','href',url);
  html = setAttr(html,'meta-robots','content', robots || 'index, follow, max-image-preview:large');
  html = setAttr(html,'meta-og-type','content', ogType || (canonicalPath==='/' ? 'website':'article'));
  html = setAttr(html,'meta-og-title','content',title);
  html = setAttr(html,'meta-og-desc','content',desc);
  html = setAttr(html,'meta-og-url','content',url);
  html = setAttr(html,'meta-og-image','content', image||'');
  html = setAttr(html,'meta-tw-title','content',title);
  html = setAttr(html,'meta-tw-desc','content',desc);
  html = setAttr(html,'meta-tw-image','content', image||'');
  // inject the page content into <main id="view">…</main>
  html = html.replace(/(<main id="view"[^>]*>)[\s\S]*?(<\/main>)/, `$1\n${mainInner}\n$2`);
  return html;
}

/* ---------------- WordPress fetch ---------------- */
async function fetchAllPosts(){
  if(process.env.WP_FIXTURE){
    const raw = await fs.readFile(process.env.WP_FIXTURE,'utf8');
    return JSON.parse(raw);
  }
  const base = WP.replace(/\/+$/,'');
  let page=1, all=[];
  while(page<=30){
    const url = `${base}/wp-json/wp/v2/posts?_embed&per_page=100&page=${page}&orderby=date`;
    const res = await fetch(url);
    if(res.status===400) break;                 // past the last page
    if(!res.ok) throw new Error('WordPress responded with '+res.status);
    const batch = await res.json();
    if(!Array.isArray(batch) || !batch.length) break;
    all = all.concat(batch);
    const total = parseInt(res.headers.get('x-wp-totalpages')||'1',10);
    if(page>=total) break;
    page++;
  }
  return all;
}

/* ---------------- sitemap ---------------- */
function sitemap(posts){
  const now = new Date().toISOString();
  const newest = posts.reduce((m,p)=> (p.modified && p.modified>m ? p.modified : m), '');
  const siteLast = newest ? new Date(newest).toISOString() : now;
  const tag = (loc,lm,cf,pr)=>`  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lm}</lastmod>\n    <changefreq>${cf}</changefreq>\n    <priority>${pr}</priority>\n  </url>`;
  const rows = [ tag(SITE+'/', siteLast, 'daily','1.0') ];
  CATEGORIES.forEach(c=> rows.push(tag(SITE+encodeURI(pCategory(c)), siteLast, 'daily','0.6')));
  rows.push(tag(SITE+'/contact', now, 'monthly','0.3'));
  posts.forEach(p=> rows.push(tag(SITE + '/' + encodeURIComponent(p.id) + (NO_TRAILING_SLASH.has(p.id)?'':'/'),
    p.modified?new Date(p.modified).toISOString():now, 'daily','0.8')));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

/* ---------------- write helpers ---------------- */
async function writeFile(rel, content){
  const full = path.join(OUT, rel);
  await fs.mkdir(path.dirname(full), { recursive:true });
  await fs.writeFile(full, content);
}
async function copyDir(src, destRel){
  const dest = path.join(OUT, destRel);
  await fs.mkdir(dest, { recursive:true });
  for(const entry of await fs.readdir(src, { withFileTypes:true })){
    const s = path.join(src, entry.name);
    if(entry.isDirectory()) await copyDir(s, path.join(destRel, entry.name));
    else await fs.copyFile(s, path.join(dest, entry.name));
  }
}
async function copyIfExists(file, rel){
  try{ await fs.copyFile(file, path.join(OUT, rel)); }catch(e){}
}

/* ---------------- main ---------------- */
async function main(){
  const rawPosts = await fetchAllPosts();
  // WordPress already returns newest-first (orderby=date); keep that order.
  const items = rawPosts.map(mapPost);

  const tpl = applyChrome(await fs.readFile('template.html','utf8'));

  // reset output
  await fs.rm(OUT, { recursive:true, force:true });
  await fs.mkdir(OUT, { recursive:true });

  // Home
  await writeFile('index.html', renderPage(tpl, {
    title: HOME_TITLE, desc: HOME_DESC, canonicalPath: '/', ogType:'website',
    image: items[0] ? items[0].img : '', mainInner: homeBody(items)
  }));

  // Articles  (trailing slash -> slug/index.html ; exception -> slug.html)
  for(const art of items){
    const inner = articleBody(art, items);
    const page = renderPage(tpl, {
      title: fitTitle(art.title), desc: fitDesc(art.excerpt || art.title),
      canonicalPath: pArticle(art.id), ogType:'article', image: art.img, mainInner: inner
    });
    if(NO_TRAILING_SLASH.has(art.id)) await writeFile(`${art.id}.html`, page);
    else await writeFile(`${art.id}/index.html`, page);
  }

  // Categories (no trailing slash -> Name.html)
  for(const name of CATEGORIES){
    const page = renderPage(tpl, {
      title: fitTitle(name + ' News, Updates & Analysis'),
      desc: fitDesc(CAT_DESC[name] || (name + ' news, updates and expert analysis from KONE-MEDIA Africa.')),
      canonicalPath: pCategory(name), ogType:'website', image:'', mainInner: categoryBody(name, items)
    });
    await writeFile(`${name.trim().replace(/\s+/g,'-')}.html`, page);
  }

  // Contact (no trailing slash -> contact.html)
  await writeFile('contact.html', renderPage(tpl, {
    title: CONTACT_TITLE, desc: CONTACT_DESC, canonicalPath: pContact(), ogType:'website', image:'', mainInner: contactBody()
  }));

  // Thank-you (form success)
  await writeFile('thank-you/index.html', renderPage(tpl, {
    title: 'Thank You | KONE-MEDIA Africa', desc: HOME_DESC, canonicalPath: '/thank-you/', robots:'noindex, follow',
    ogType:'website', image:'', mainInner: simpleBody('Thank you', 'Your message has been received. We\u2019ll be in touch soon.')
  }));

  // 404
  await writeFile('404.html', renderPage(tpl, {
    title: 'Page Not Found | KONE-MEDIA Africa', desc: HOME_DESC, canonicalPath: '/404', robots:'noindex, follow',
    ogType:'website', image:'', mainInner: simpleBody('Page not found', 'Sorry \u2014 the page you were looking for could not be found.')
  }));

  // sitemap, robots, redirects, assets
  await writeFile('sitemap.xml', sitemap(items));
  await copyIfExists('robots.txt', 'robots.txt');
  await writeFile('_redirects', '/category/*    /:splat    301\n');
  await copyDir('assets', 'assets');

  console.log(`Built ${items.length} articles + ${CATEGORIES.length} categories + home/contact into /dist`);
}

main().catch(err=>{ console.error('BUILD FAILED:', err); process.exit(1); });
