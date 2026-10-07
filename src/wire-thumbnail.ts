const images=new Map<string,string>();

/** Reuse the catalog's routed-wire illustration without rendering another scene. */
export function wireThumbnail(kind:'wire'|'neon',color:string){
 const key=kind+color,cached=images.get(key);if(cached)return cached;
 const neon=kind==='neon';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 80"><path d="M28 58h34V25h49" fill="none" stroke="${neon?color:'#59727c'}" stroke-width="${neon?7:5}"/><path d="M28 58h6m72-33h6" stroke="${neon?'#d6d6d6':'#7d939d'}" stroke-width="${neon?11:9}"/></svg>`;
 const image='data:image/svg+xml,'+encodeURIComponent(svg);images.set(key,image);return image;
}
