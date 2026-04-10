export const JOB_STATUSES = [
  'Pending',
  'Evaluated',
  'Applied',
  'Interview',
  'Offer',
  'Rejected',
  'Discarded',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

export type Theme = 'resume';

export interface Job {
  id: string;          // zero-padded, e.g. "001"
  added: string;       // YYYY-MM-DD
  company: string;
  role: string;
  url: string;
  jd: string;          // full JD markdown/text
  jdSummary?: string;  // summarized JD markdown for dashboard display
  status: JobStatus;
  score: number | null;
  category: string | null;
  focus: string | null;
  reportPath: string | null;
  pdfPath: string | null;
  theme: Theme | null;
  notes: string;
}

export interface EvaluationResult {
  score: number;
  category: string;
  focus: string | null;
  recommendation: 'apply' | 'consider' | 'discard';
  blockA: {
    tldr: string;
    domain: string;
    function: string;
    seniority: string;
    remote: string;
    teamSize: string | null;
  };
  blockB: {
    matches: Array<{ requirement: string; cvEvidence: string }>;
    gaps: Array<{ requirement: string; blocker: boolean; mitigation: string }>;
  };
  blockC: {
    analysis: string;
    seniorityAnalysis: string;
  };
  blockD: string[];
  blockE: string;
  blockF: Array<{ requirement: string; story: string }>;
}

export interface GeneratedCV {
  name: string;
  title: string;
  contact: {
    email: string;
    location: string;
    site: string;
  };
  skills: string[];
  roles: Array<{
    company: string;
    role: string;
    period: { start: string; end: string };
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
  }>;
}

export interface Experience {
  company: string;
  role: string;
  period: { start: string; end: string };
  tags: string[];
  bullets: string[];
  narrative: string;
}

export interface Profile {
  candidate: {
    name: string;
    email: string;
    location: string;
    site: string;
    github?: string;
    linkedin?: string;
  };
  headline: string;
  summary: string;
  cv: string;
  targets: {
    roles: string[];
    salaryMin: number;
    salaryMax: number;
    remote: 'full' | 'hybrid' | 'any';
    dealBreakers: string[];
    categories: string[];
    focuses: string[];
  };
  experiences: Experience[];
  education: Array<{
    institution: string;
    degree: string;
  }>;
  skills: string[];
}

export type AnswerCategory =
  | 'identity'
  | 'motivation'
  | 'behavioral'
  | 'strengths'
  | 'vision'
  | 'culture'
  | 'situational'
  | 'other';

export interface AnswerEntry {
  id: string;
  question: string;
  category: AnswerCategory;
  answer: string;
  tone: string;
  context: string;
  added: string;   // YYYY-MM-DD
  revised: string; // YYYY-MM-DD
}

export type ScanSource = 'greenhouse' | 'lever' | 'ashby' | 'remoteok' | 'remotive' | 'hn-hiring' | 'websearch';

export interface ScanJob {
  title: string;
  company: string;
  url: string;
  source: ScanSource;
  score: number;
  snippet?: string; // location, salary hint, or first line of description
}
