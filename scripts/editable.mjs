import {createHash} from 'node:crypto';

export function markEditable(body) {
  const fields = {}, photos = {};
  const key = value => createHash('sha256').update(value).digest('hex').slice(0,16);
  function unique(map, base) {
    let id = base, n = 1;
    while (Object.hasOwn(map,id)) id = base + '-' + (++n);
    return id;
  }
  let html = body.replace(/<(h[123]|p)(\s[^>]*|)>([\s\S]*?)<\/\1>/g, (original, tag, attrs, inner) => {
    if (/<(?!\/?(?:em|strong|br|span)\b)/i.test(inner)) return original;
    const value = inner.replace(/<br\s*\/?>/gi,' ').replace(/<[^>]*>/g,'').replaceAll('&amp;','&').replaceAll('&#39;',"'").trim();
    if (!value) return original;
    const id = unique(fields,key(tag + ':' + value));
    fields[id] = {tag, value};
    return '<' + tag + attrs + ' data-copy="' + id + '">' + inner + '</' + tag + '>';
  });
  html = html.replace(/<img\b[^>]*>/g, image => {
    const source = image.match(/\bsrc="([^"]+)"/)?.[1];
    if (!source) return image;
    const id = unique(photos,key(source));
    photos[id] = {label:image.match(/\balt="([^"]+)"/)?.[1] || 'Feature image',source};
    return image.replace('<img','<img data-picture="' + id + '"');
  });
  photos.feature = {label:'Additional page photograph',source:''};
  html = html.replace('</section>','</section><figure data-feature class="wrap" hidden><img data-picture="feature" alt="" class="staff-feature-photo"></figure>');
  return {fields,photos,html};
}
