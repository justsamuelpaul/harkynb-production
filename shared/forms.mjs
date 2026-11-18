// Enquiry forms, one per team. Shared by the build (renders the form), the public Worker (validates
// submissions) and the staff console (shows answers with their labels).
//
// Field: {name, label, type, required, options, hint, max, when, autocomplete}
//   type: text | email | tel | date | url | select | radio | checks | textarea
//   when: {otherField: [values...]}; the field only applies when every listed field has one of those values.
//         For 'checks' fields, any ticked value counts.
import {services,courses} from '../content/catalogue.mjs';

const name = {name:'name', label:'Full name', type:'text', required:true, autocomplete:'name'};
const email = {name:'email', label:'Email address', type:'email', required:true, autocomplete:'email'};
const phone = (required=false) => ({name:'phone', label:'Phone or WhatsApp number', type:'tel', required, autocomplete:'tel'});
const method = {name:'method', label:'Preferred contact method', type:'select', options:['Email','WhatsApp','Phone call']};
const message = (label, hint='') => ({name:'message', label, type:'textarea', required:true, hint, max:5000});
const budget = {name:'budget', label:'Estimated budget (optional)', type:'text'};
const programmes = courses.map(c=>c.name);

const STUDENT = 'A prospective student', PARENT = 'A parent or guardian', SCHOOL = 'A school or organisation', SPONSOR = 'A sponsor or supporter';
const learner = {as:[STUDENT,PARENT]};
const PARTNER = 'Partnership or sponsorship';

export const forms = {
  production: {
    intro: 'Production, events and general enquiries.',
    fields: [name, email, phone(),
      {name:'organisation', label:'Company or organisation (optional)', type:'text', autocomplete:'organization'},
      {name:'service', label:'What do you need?', type:'select', required:true, options:[...services.map(s=>s.name),'General enquiry','Other']},
      {name:'date', label:'Project or event date', type:'date'},
      {name:'location', label:'Project location', type:'text'},
      budget,
      message('Tell us about the project', 'What it is for, what you would like to create, and anything already decided.'),
      method]
  },
  onevoicefm: {
    intro: 'Advertising, sponsored content and media partnerships.',
    fields: [name, email, phone(),
      {name:'organisation', label:'Company, brand or agency', type:'text', required:true, autocomplete:'organization'},
      {name:'interest', label:'What are you interested in?', type:'select', required:true, options:['Advertising on Onevoicefm','Sponsored programme or segment','Content or media partnership','Interview or guest feature','Other']},
      {name:'timing', label:'Campaign start date or timing', type:'text'},
      budget,
      message('Tell us about your brand and goals'),
      method],
    aliases: {'Advertising partnership': {interest:'Advertising on Onevoicefm'}}
  },
  shotit: {
    intro: 'Weddings, portraits, events and brand photography.',
    fields: [name, email, phone(true),
      {name:'shoot', label:'Type of shoot', type:'select', required:true, options:['Weddings','Traditional wedding or engagement','Portraits','Family or maternity','Birthday or celebration','Corporate & events','Red carpet or press','Brand & commercial','Other']},
      {name:'date', label:'Shoot or event date', type:'date'},
      {name:'location', label:'Location or venue', type:'text'},
      {name:'guests', label:'Expected number of guests (events only)', type:'text'},
      budget,
      message('Tell us about the shoot', 'The occasion, the look you want, and how you plan to use the photos.'),
      method]
  },
  academy: {
    intro: 'Register your interest in training, or ask about programmes for schools and sponsorship.',
    fields: [
      {name:'as', label:'I am enquiring as', type:'radio', required:true, options:[STUDENT,PARENT,SCHOOL,SPONSOR]},
      {...name, label:'Your full name'}, email, phone(true),
      // Learners
      {name:'student', label:'Student’s full name', type:'text', required:true, when:{as:[PARENT]}},
      {name:'age', label:'Student’s age group', type:'select', required:true, options:['Under 13','13 to 15','16 to 17','18 to 24','25 to 34','35 and above'], when:learner},
      {name:'guardian', label:'Parent or guardian name and phone number', type:'text', required:true, hint:'Needed for students under 18.', when:{as:[STUDENT],age:['Under 13','13 to 15','16 to 17']}},
      {name:'city', label:'City and state of residence', type:'text', required:true, when:learner},
      {name:'programmes', label:'Programmes you are interested in', type:'checks', required:true, options:[...programmes,'Not sure yet'], when:learner},
      {name:'experience', label:'Current experience level', type:'select', required:true, options:['Complete beginner','Some self-taught experience','Some formal training','Already working in the field'], when:learner},
      {name:'occupation', label:'Current occupation', type:'select', required:true, options:['Secondary school student','University or college student','Recent graduate','Employed','Self-employed','Not currently working or studying'], when:learner},
      {name:'format', label:'Preferred way to learn', type:'select', required:true, options:['In person','Online','Either'], when:learner},
      {name:'schedule', label:'Preferred schedule', type:'select', options:['Weekdays','Weekday evenings','Weekends','Flexible'], when:learner},
      {name:'equipment', label:'Equipment you already have', type:'checks', options:['Camera','Laptop or computer','Smartphone','Audio equipment','None yet'], when:learner},
      {name:'source', label:'How did you hear about the Academy?', type:'select', options:['Instagram','TikTok','Facebook','X (Twitter)','YouTube','WhatsApp','Friend or family','School or organisation','Future Creators Summit','Other'], when:learner},
      // Schools and organisations
      {name:'organisation', label:'School or organisation name', type:'text', required:true, autocomplete:'organization', when:{as:[SCHOOL]}},
      {name:'role', label:'Your role', type:'text', when:{as:[SCHOOL]}},
      {name:'learners', label:'Number of learners', type:'text', when:{as:[SCHOOL]}},
      {name:'ages', label:'Learners’ age group', type:'text', when:{as:[SCHOOL]}},
      {name:'programmes', label:'Programmes of interest', type:'checks', required:true, options:[...programmes,'Not sure yet'], when:{as:[SCHOOL]}},
      {name:'timing', label:'Preferred start date or term', type:'text', when:{as:[SCHOOL]}},
      // Sponsors
      {name:'organisation', label:'Organisation (if any)', type:'text', autocomplete:'organization', when:{as:[SPONSOR]}},
      {name:'support', label:'How would you like to support?', type:'checks', required:true, options:['Sponsor a student place','Sponsor a training cohort','Donate equipment','Fund learning resources','Host a practical workshop','Offer mentorship','Other'], when:{as:[SPONSOR]}},
      message('What would you like to achieve, or anything else we should know?'),
      method],
    aliases: {
      'Training interest': {as:STUDENT},
      'Institutional training': {as:SCHOOL}, 'Education partnership': {as:SCHOOL},
      'Education sponsorship': {as:SPONSOR}, 'Sponsorship': {as:SPONSOR},
      ...Object.fromEntries(programmes.map(p=>[p,{as:STUDENT, programmes:p}]))
    }
  },
  summit: {
    intro: 'General enquiries and partnership opportunities.',
    fields: [
      {name:'type', label:'Type of enquiry', type:'radio', required:true, options:['General enquiry',PARTNER]},
      name, email, phone(),
      {name:'organisation', label:'Company or organisation', type:'text', required:true, autocomplete:'organization', when:{type:[PARTNER]}},
      {name:'role', label:'Your job title', type:'text', when:{type:[PARTNER]}},
      {name:'partnership', label:'Partnership areas of interest', type:'checks', required:true, options:['Title partnership','Programme sponsorship','Creative education','Media partnership','Equipment & technology','Youth & institutional partnerships','Venue or in-kind support','Other'], when:{type:[PARTNER]}},
      {name:'website', label:'Organisation website (optional)', type:'url', when:{type:[PARTNER]}},
      {...budget, label:'Indicative budget (optional)', when:{type:[PARTNER]}},
      message('Your message'),
      method],
    aliases: {
      'Summit partnership': {type:PARTNER}, 'Future edition updates': {type:'General enquiry'},
      ...Object.fromEntries(['Title partnership','Programme sponsorship','Creative education','Media partnership','Equipment & technology','Youth & institutional partnerships'].map(p=>[p,{type:PARTNER, partnership:p}]))
    }
  }
};
export const teamKeys = Object.keys(forms);

const asList = v => Array.isArray(v) ? v : (v ? [v] : []);
// Whether a field applies, given the answers so far.
export function applies(field, answers) {
  return !field.when || Object.entries(field.when).every(([k,values]) => asList(answers[k]).some(v=>values.includes(v)));
}

// Validate a public submission. Returns {entry} or {error}.
// entry keeps name, email, phone, team, message and method at the top level, plus labelled answers in `details`.
export function validateEnquiry(d) {
  if (!d || typeof d!=='object') return {error:'Invalid submission.'};
  const form = forms[d.team];
  if (!form) return {error:'Choose a team.'};
  const answers = {}, details = [];
  for (const f of form.fields) {
    if (!applies(f, answers)) continue;
    const raw = d[f.name];
    let value;
    if (f.type==='checks') {
      const list = asList(raw);
      if (list.length>f.options.length || list.some(v=>typeof v!=='string' || !f.options.includes(v))) return {error:'Check “'+f.label+'”.'};
      value = list;
      if (f.required && !list.length) return {error:'Choose at least one option for “'+f.label+'”.'};
    } else {
      if (raw!==undefined && typeof raw!=='string') return {error:'Check the form fields.'};
      value = (raw||'').trim();
      if (value.length>(f.max||200)) return {error:'“'+f.label+'” is too long.'};
      if (f.required && !value) return {error:'Please fill in “'+f.label+'”.'};
      if (value && f.options && !f.options.includes(value)) return {error:'Check “'+f.label+'”.'};
      if (value && f.type==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return {error:'Check your email address.'};
      if (value && f.type==='date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return {error:'Check “'+f.label+'”.'};
      if (value && f.type==='url' && !/^https?:\/\/\S+$/i.test(value)) return {error:'Check “'+f.label+'”. It should start with https://'};
      if (f.name==='message' && value.length<10) return {error:'Please tell us a little more in your message.'};
    }
    answers[f.name] = value;
    if (!['name','email','phone','message','method'].includes(f.name) && (Array.isArray(value)?value.length:value)) details.push([f.label, Array.isArray(value)?value.join(', '):value]);
  }
  const {name,email,phone='',message,method=''} = answers;
  return {entry:{team:d.team, name, email, phone, message, method, topic:topicOf(d.team,answers), details}};
}
const topicOf = (team,a) => ({production:a.service, onevoicefm:a.interest, shotit:a.shoot, academy:a.as, summit:a.type})[team] || '';
