export const ARTIST_TYPES = ['Actor', 'Model', 'Presenter', 'Dancer', 'Singer', 'Voice artist', 'Theatre performer',
  'Musician', 'Comedian', 'Influencer', 'Extra', 'Other performer'];

export const LANGUAGES = ['Sinhala', 'Tamil', 'English', 'Hindi', 'Malay', 'Arabic', 'Other'];

export const DISTRICTS = ['Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha',
  'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale',
  'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura',
  'Trincomalee', 'Vavuniya', 'Outside Sri Lanka'];

export const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
export const CHARACTER_GENDERS = ['Any', 'Female', 'Male', 'Non-binary'];

export const EXPERIENCE = [
  { value: 'emerging', label: 'Emerging' },
  { value: 'intermediate', label: 'Some experience' },
  { value: 'experienced', label: 'Experienced' },
  { value: 'professional', label: 'Professional' },
];

export const AVAILABILITY = [
  { value: 'available', label: 'Available' },
  { value: 'limited', label: 'Limited availability' },
  { value: 'unavailable', label: 'Not available' },
];

export const PROJECT_TYPES = ['Film', 'Teledrama', 'TV commercial', 'Web series', 'Music video', 'Theatre',
  'Photoshoot', 'Fashion show', 'Event', 'Other'];

export const PROJECT_STATUS = [
  { value: 'development', label: 'In development' },
  { value: 'casting', label: 'Casting' },
  { value: 'in_production', label: 'In production' },
  { value: 'wrapped', label: 'Wrapped' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const CALL_STATUS = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

export const ROLE_TYPES = ['Lead', 'Supporting', 'Featured', 'Extra'];
export const AUDITION_TYPES = ['Self-tape', 'In person', 'Online call', 'No audition'];

export const APP_STATUS = [
  { value: 'applied', label: 'Applied' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'audition', label: 'Audition' },
  { value: 'callback', label: 'Callback' },
  { value: 'selected', label: 'Selected' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Not selected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];
export const PIPELINE = ['applied', 'reviewing', 'shortlisted', 'audition', 'callback', 'selected', 'confirmed'];

export const REPORT_REASONS = ['Fake or misleading', 'Asks for payment or personal details', 'Harassment',
  'Inappropriate content', 'Impersonation', 'Other'];

export const SOCIALS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'website', label: 'Website' },
];

export function label(list, value) {
  const hit = list.find(x => (x.value ?? x) === value);
  return hit ? (hit.label ?? hit) : (value ?? '');
}
