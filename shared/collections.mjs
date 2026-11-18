// Validation for staff-editable lists (portfolio projects and news).
// Used by the Studio Durable Object before anything is published. Pure: no Node or Worker APIs.
import {workCategories} from '../content/catalogue.mjs';
import {teams} from './render.mjs';

export const collectionNames = ['projects','news'];
export const projectCategories = workCategories.filter(c => c !== 'All');
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Uploaded photos are /media/<uuid>; photos shipped with the site are /media/<file>.jpg|png|webp.
const uploaded = /^\/media\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const bundled = /^\/media\/[a-z0-9][a-z0-9-]*\.(?:jpg|jpeg|png|webp)$/;

class Invalid extends Error {}
const text = (value, label, max, required = false) => {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new Invalid(label + ' must be text.');
  value = value.trim();
  if (required && !value) throw new Invalid(label + ' is required.');
  if (value.length > max) throw new Invalid(label + ' must be ' + max + ' characters or fewer.');
  return value;
};
const httpsUrl = (value, label) => {
  value = text(value, label, 500);
  if (!value) return '';
  let url;
  try { url = new URL(value); } catch { throw new Invalid(label + ' must be a full web address starting with https://'); }
  if (url.protocol !== 'https:') throw new Invalid(label + ' must start with https://');
  return url.href;
};

// mediaExists(id) reports whether an uploaded photo is stored. Returns {items} or {error}.
export function validateCollection(name, items, mediaExists) {
  try {
    if (!collectionNames.includes(name)) throw new Invalid('Unknown list.');
    if (!Array.isArray(items)) throw new Invalid('Send the list as an array.');
    if (items.length > 60) throw new Invalid('Keep the list to 60 entries or fewer.');
    const photo = (value, label) => {
      value = text(value, label, 120, true);
      const match = value.match(uploaded);
      if (match ? !mediaExists(match[1]) : !bundled.test(value)) throw new Invalid(label + ' is missing. Upload it again.');
      return value;
    };
    if (name === 'news') {
      return {items: items.map((n, i) => {
        const at = 'Update ' + (i + 1) + ': ';
        if (!n || typeof n !== 'object') throw new Invalid(at + 'invalid entry.');
        return {title: text(n.title, at + 'title', 160, true), date: text(n.date, at + 'date', 40), description: text(n.description, at + 'summary', 600), url: httpsUrl(n.url, at + 'link')};
      })};
    }
    const slugs = new Set();
    return {items: items.map((p, i) => {
      const at = 'Project ' + (i + 1) + ': ';
      if (!p || typeof p !== 'object') throw new Invalid(at + 'invalid entry.');
      const slug = text(p.slug, at + 'web address', 80, true);
      if (!slugPattern.test(slug)) throw new Invalid(at + 'web address may use lowercase letters, numbers and single hyphens only.');
      if (slugs.has(slug)) throw new Invalid(at + 'web address is already used by another project.');
      slugs.add(slug);
      if (!projectCategories.includes(p.category)) throw new Invalid(at + 'choose a category.');
      const team = p.team ? text(p.team, at + 'team', 20) : '';
      if (team && !teams.includes(team)) throw new Invalid(at + 'choose a team.');
      const gallery = p.gallery ?? [];
      if (!Array.isArray(gallery) || gallery.length > 40) throw new Invalid(at + 'keep the gallery to 40 photos or fewer.');
      return {
        slug, team, category: p.category,
        title: text(p.title, at + 'title', 160, true),
        description: text(p.description, at + 'summary', 600),
        location: text(p.location, at + 'location', 120),
        services: text(p.services, at + 'services', 200),
        image: photo(p.image, at + 'cover photo'),
        alt: text(p.alt, at + 'cover photo description', 300, true),
        credit: text(p.credit, at + 'credit', 120),
        gallery: gallery.map((g, j) => {
          const gat = at + 'gallery photo ' + (j + 1) + ' ';
          if (!g || typeof g !== 'object') throw new Invalid(gat + 'is invalid.');
          return {title: text(g.title, gat + 'caption', 160, true), image: photo(g.image, gat), alt: text(g.alt, gat + 'description', 300, true), credit: text(g.credit, gat + 'credit', 120)};
        })
      };
    })};
  } catch (error) {
    if (error instanceof Invalid) return {error: error.message};
    throw error;
  }
}
