/**
 * OpenPositionsPanel — example career-listing consumer of the generic
 * `<ListPanel>` primitive.
 *
 * The mock data and department lexicon below are placeholders intended for
 * the OSS demo. Tenants should replace them by either (a) injecting a
 * custom panel into `<CanvasShell panels={...}>` or (b) — once the
 * registry-config refactor lands — passing `mockJobs` through tenant
 * config. The render shape (cards, detail view, compatibility badge, hero
 * gradient) is intentionally generic and tone-agnostic.
 *
 * Domain layer (replace with your own data):
 *   - `Job` type + `MOCK_JOBS` data
 *   - Department→tone mapping (5 hue palette)
 *   - JobCard / JobDetail render functions (compatibility badge, hero
 *     gradient, "Explore role" CTA, "Apply Now" CTA)
 *
 * Generic layer (delegated to `<ListPanel>` from primitives/):
 *   - DraggablePanel wrapper, layout-store visibility gate
 *   - Free-text search input + filter chips
 *   - Selection state (open detail), saved-set state
 *   - Empty state
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Building2,
  Clock,
  DollarSign,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { ListPanel, type ListPanelFilter, type ListPanelItemId, createLexicon } from './primitives';
import { TONE_GRADIENT } from './toneTokens';
import { usePanelIntentStore } from '../stores/panelIntentStore';
import { useCanvasConfig } from './CanvasContext';

export type DeptTone = 'teal' | 'amber' | 'indigo' | 'rose' | 'emerald';

/**
 * Public shape for OpenPositionsPanel mock data. Tenants overriding via
 * `<CanvasShell config.panelData.jobs>` should match this shape.
 */
export interface Job {
  id: number;
  title: string;
  department: string;
  tone: DeptTone;
  location: string;
  property: string;
  type: string;
  payRange: string;
  description: string;
  longDescription: string;
  skillMatches: string[];
  compatibilityScore: number;
  postedDate: string;
  team: string;
  responsibilities: string[];
}

const toneStyles: Record<
  DeptTone,
  {
    bar: string;
    chip: string;
    chipText: string;
    scoreBg: string;
    scoreText: string;
    detailHero: string;
  }
> = {
  teal: {
    bar: 'bg-canvas-primary',
    chip: 'bg-canvas-primary-tint',
    chipText: 'text-canvas-primary',
    scoreBg: 'bg-emerald-50',
    scoreText: 'text-emerald-700',
    detailHero: TONE_GRADIENT.teal,
  },
  amber: {
    bar: 'bg-amber-500',
    chip: 'bg-amber-50',
    chipText: 'text-amber-800',
    scoreBg: 'bg-amber-50',
    scoreText: 'text-amber-800',
    detailHero: TONE_GRADIENT.amber,
  },
  indigo: {
    bar: 'bg-indigo-500',
    chip: 'bg-indigo-50',
    chipText: 'text-indigo-700',
    scoreBg: 'bg-indigo-50',
    scoreText: 'text-indigo-700',
    detailHero: TONE_GRADIENT.indigo,
  },
  rose: {
    bar: 'bg-rose-500',
    chip: 'bg-rose-50',
    chipText: 'text-rose-700',
    scoreBg: 'bg-rose-50',
    scoreText: 'text-rose-700',
    detailHero: TONE_GRADIENT.rose,
  },
  emerald: {
    bar: 'bg-emerald-500',
    chip: 'bg-emerald-50',
    chipText: 'text-emerald-700',
    scoreBg: 'bg-emerald-50',
    scoreText: 'text-emerald-700',
    detailHero: TONE_GRADIENT.emerald,
  },
};

// Generic example data — tenants override this via panel injection or
// (future) tenant config. These are placeholder roles for the OSS demo.
const MOCK_JOBS: Job[] = [
  {
    id: 1,
    title: 'Engineering Manager',
    department: 'Engineering',
    tone: 'teal',
    location: 'Austin, TX',
    property: 'Headquarters',
    type: 'Full-time · Salary',
    payRange: '$160,000 – $200,000',
    description:
      'Lead a team of 8 engineers building our core platform.',
    longDescription:
      "You'll own delivery for a team of 8 engineers shipping the platform that powers our customer-facing product. Partner with product and design to plan roadmap, unblock contributors, and keep the team focused on outcomes.",
    skillMatches: ['Leadership', 'Engineering Strategy', 'Coaching', 'Roadmapping'],
    compatibilityScore: 94,
    postedDate: '2d ago',
    team: 'Platform',
    responsibilities: [
      'Own quarterly delivery for an 8-person team',
      'Coach engineers across IC1–IC5; run weekly 1:1s',
      'Partner with product on roadmap, scope, and trade-offs',
      'Drive incident reviews and engineering excellence',
    ],
  },
  {
    id: 2,
    title: 'Senior Software Engineer',
    department: 'Engineering',
    tone: 'indigo',
    location: 'Remote (US)',
    property: 'Distributed',
    type: 'Full-time · Salary',
    payRange: '$140,000 – $180,000',
    description:
      'Build production features end-to-end on our React + TypeScript platform.',
    longDescription:
      "Join the team building the application layer of our product. You'll ship React + TypeScript features that touch every customer interaction, with autonomy over scope and architectural decisions.",
    skillMatches: ['React', 'TypeScript', 'API Design', 'Cloud'],
    compatibilityScore: 89,
    postedDate: '3d ago',
    team: 'Application',
    responsibilities: [
      'Own end-to-end features across the customer portal',
      'Pair with design and product to ship weekly',
      'Mentor 2–3 mid-level engineers',
      'Contribute to internal tooling and developer experience',
    ],
  },
  {
    id: 3,
    title: 'Product Designer',
    department: 'Design',
    tone: 'amber',
    location: 'New York, NY',
    property: 'Headquarters',
    type: 'Full-time · Salary',
    payRange: '$120,000 – $160,000',
    description:
      'Lead design for a major surface area of our product.',
    longDescription:
      'Shape the user experience for a major workflow used by thousands of customers daily. You own research, interaction, and visual design end-to-end, partnering with PM and engineering from idea through ship.',
    skillMatches: ['Interaction Design', 'Prototyping', 'User Research', 'Design Systems'],
    compatibilityScore: 87,
    postedDate: '1w ago',
    team: 'Product Design',
    responsibilities: [
      'Drive research, design, and validation for a core workflow',
      'Partner with engineering on implementation fidelity',
      'Contribute components and patterns to the design system',
      'Present design decisions to cross-functional stakeholders',
    ],
  },
  {
    id: 4,
    title: 'Customer Success Specialist',
    department: 'Customer Success',
    tone: 'rose',
    location: 'Chicago, IL',
    property: 'Regional Office',
    type: 'Full-time · Hourly',
    payRange: '$24 – $32 / hr',
    description:
      'Help customers get more value out of the product, faster.',
    longDescription:
      "You're the friendly, capable face every customer remembers. Onboarding, training, escalations, the small wins that turn renewals into expansions — this seat owns it.",
    skillMatches: ['Customer Communication', 'Account Management', 'Problem Solving'],
    compatibilityScore: 92,
    postedDate: '5d ago',
    team: 'Customer Success',
    responsibilities: [
      'Onboard new accounts and personalize the first 30 days',
      'Handle escalations; route product feedback to the right team',
      'Run quarterly business reviews with key accounts',
      'Partner with Sales on expansions and renewals',
    ],
  },
  {
    id: 5,
    title: 'Learning Program Lead',
    department: 'People & Learning',
    tone: 'emerald',
    location: 'Hybrid · Multiple offices',
    property: 'People Team',
    type: 'Full-time · Salary',
    payRange: '$95,000 – $125,000',
    description:
      'Design and deliver internal learning programs across the company.',
    longDescription:
      'You build the curriculum that helps every team member grow into the next role. Your students are ICs and managers across functions — engineering, design, customer-facing teams, and operations.',
    skillMatches: ['Curriculum Design', 'Facilitation', 'Coaching'],
    compatibilityScore: 85,
    postedDate: '2w ago',
    team: 'People Operations',
    responsibilities: [
      'Deliver 12–15 cohort sessions per term',
      'Co-author curriculum with subject-matter experts',
      'Mentor program participants through capstone projects',
      'Measure outcomes and iterate on the learning model',
    ],
  },
];

// Stable references — kept module-scope so they survive re-renders without
// `useCallback` per the ListPanel perf contract.
const getJobId = (j: Job) => j.id;
// Search corpus per job. Includes department + team so a query like
// "engineering" matches a Senior Software Engineer even if the user's
// term doesn't exactly equal the department label.
const getJobSearchText = (j: Job) =>
  [j.title, j.department, j.team, j.location, j.property, ...j.skillMatches].join(' ');
const JOB_FILTERS: ListPanelFilter<Job>[] = [
  { id: 'department', getValue: (j) => j.department, label: 'Department' },
];

/**
 * Department lexicon. Canonical values are the actual MOCK_JOBS departments;
 * synonyms cover the natural-English terms a candidate (or the assistant)
 * is likely to use that don't match exactly. The agent's `open_positions`
 * tool runs every `department` arg through this before applying it as a
 * chip filter — so "Eng" / "IT" / "Dev" all resolve to "Engineering".
 *
 * Add a new role-family? Append the canonical value to MOCK_JOBS and a
 * couple of common synonyms here. The chip strip auto-derives chips
 * from the data, so no separate UI registration needed.
 */
const DEPARTMENT_LEXICON = createLexicon({
  canonical: [
    'Engineering',
    'Design',
    'Customer Success',
    'People & Learning',
  ],
  synonyms: {
    // Engineering family
    eng: 'Engineering',
    'software engineering': 'Engineering',
    software: 'Engineering',
    developer: 'Engineering',
    development: 'Engineering',
    dev: 'Engineering',
    it: 'Engineering',
    tech: 'Engineering',
    technology: 'Engineering',
    platform: 'Engineering',
    // Design
    designer: 'Design',
    ux: 'Design',
    ui: 'Design',
    product: 'Design',
    // Customer Success
    cs: 'Customer Success',
    cx: 'Customer Success',
    customer: 'Customer Success',
    support: 'Customer Success',
    success: 'Customer Success',
    account: 'Customer Success',
    // People & Learning
    'l&d': 'People & Learning',
    learning: 'People & Learning',
    training: 'People & Learning',
    education: 'People & Learning',
    people: 'People & Learning',
    hr: 'People & Learning',
    instructor: 'People & Learning',
  },
});

export interface OpenPositionsPanelProps {
  /**
   * Whiteboard mode. When true, drop the `<DraggablePanel>` wrapper and
   * render only the body — the host (tldraw `PanelShape`) provides chrome.
   * Maps directly to `<ListPanel chromeless>`.
   */
  hostedInWhiteboard?: boolean;
  /** Shape-scoped data forwarded by the whiteboard panelShapeApi. Optional;
   *  cross-cut intents come through `panelIntentStore` and are ignored here. */
  data?: Record<string, unknown>;
}

export function OpenPositionsPanel({
  hostedInWhiteboard = false,
}: OpenPositionsPanelProps = {}) {
  // Tenant-injected job list overrides the library example data.
  // Cast `unknown[]` to `Job[]` — the canvas can't enforce the panel's
  // domain shape at the context boundary; tenants must match it.
  const tenantJobs = useCanvasConfig().panelData.jobs as readonly Job[] | undefined;
  const jobs = tenantJobs ?? MOCK_JOBS;

  const renderCard = useCallback(
    (job: Job, ctx: { saved: boolean; onSelect: () => void; onSave: () => void }) => (
      <JobCard
        job={job}
        saved={ctx.saved}
        onSelect={ctx.onSelect}
        onSave={ctx.onSave}
      />
    ),
    [],
  );
  const renderDetail = useCallback(
    (job: Job, ctx: { saved: boolean; onBack: () => void; onSave: () => void }) => (
      <JobDetailView
        job={job}
        saved={ctx.saved}
        onBack={ctx.onBack}
        onSave={ctx.onSave}
      />
    ),
    [],
  );
  const getTitle = useCallback(
    ({ count, selected }: { count: number; selected: Job | null }) =>
      selected ? selected.title : `Open Positions · ${count}`,
    [],
  );

  // Agent-driven controlled state. We lift selectedId / query / filterValues
  // / savedIds out of <ListPanel> so the panelIntentStore can pre-seed them
  // when the assistant calls `open_positions` or `show_job_detail`.
  const intent = usePanelIntentStore((s) => s.openPositions);
  const clearIntent = usePanelIntentStore((s) => s.clearOpenPositionsIntent);
  const savedJobIds = usePanelIntentStore((s) => s.savedJobIds);
  const toggleSavedJob = usePanelIntentStore((s) => s.toggleSavedJob);

  const [selectedId, setSelectedId] = useState<ListPanelItemId | null>(null);
  const [query, setQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    department: 'All',
  });

  // Resolve a (jobId | jobTitle) intent to the actual MOCK_JOBS row. Title
  // match is case-insensitive substring — the assistant might say
  // "Engineering Manager" when the row is "Engineering Manager - Platform",
  // so a partial match is friendlier than exact equality.
  //
  // Department goes through the lexicon so "Engineering" → "Information
  // Technology" instead of becoming a phantom filter that hides every row.
  // If the value doesn't normalise to anything, fall back to "All" rather
  // than apply a guaranteed-zero filter.
  useEffect(() => {
    if (!intent) return;
    const next: { selected?: number | null; query?: string; dept?: string } = {};
    if (typeof intent.selectedJobId === 'number') {
      next.selected = intent.selectedJobId;
    } else if (typeof intent.selectedJobTitle === 'string' && intent.selectedJobTitle.trim()) {
      const match = jobs.find((j) =>
        j.title.toLowerCase().includes(intent.selectedJobTitle!.toLowerCase()),
      );
      if (match) next.selected = match.id;
    } else if (intent.selectedJobId === null) {
      next.selected = null;
    }
    if (typeof intent.search === 'string') next.query = intent.search;
    if (typeof intent.department === 'string') {
      const normalised = DEPARTMENT_LEXICON.normalize(intent.department);
      next.dept = normalised ?? 'All';
      // If the agent passed a department-flavoured term but it didn't
      // map to a canonical chip AND there's no overriding search query,
      // route the term into the search input so the user still gets a
      // useful filter (search corpus includes department + team).
      if (!normalised && !next.query) {
        next.query = intent.department;
      }
    }
    if (next.selected !== undefined) setSelectedId(next.selected);
    if (next.query !== undefined) setQuery(next.query);
    if (next.dept !== undefined) {
      setFilterValues((prev) => ({ ...prev, department: next.dept ?? 'All' }));
    }
    // One-shot — clear after applying so a manual click on the panel later
    // doesn't re-apply a stale agent command.
    clearIntent();
  }, [intent, clearIntent, jobs]);

  const savedSet = useMemo(
    () => new Set<ListPanelItemId>(Array.from(savedJobIds)),
    [savedJobIds],
  );
  const onSavedIdsChange = useCallback(
    (next: Set<ListPanelItemId>) => {
      // Diff prev vs next to figure out which job changed, then route
      // through the store's toggleSavedJob (single source of truth so the
      // agent's save_job tool stays in sync with click-to-save).
      const prev = savedJobIds;
      const allIds = new Set<ListPanelItemId>([...prev, ...next]);
      for (const id of allIds) {
        if (typeof id !== 'number') continue;
        const before = prev.has(id);
        const after = next.has(id);
        if (before !== after) toggleSavedJob(id);
      }
    },
    [savedJobIds, toggleSavedJob],
  );

  return (
    <ListPanel<Job>
      panelId="open-positions"
      items={jobs}
      getId={getJobId}
      getSearchText={getJobSearchText}
      filters={JOB_FILTERS}
      labels={{
        titlePrefix: 'Open Positions',
        searchPlaceholder: 'Search roles, properties, skills…',
        emptyTitle: 'No matches',
        emptySubtitle: 'Try a different search or department.',
      }}
      getTitle={getTitle}
      renderCard={renderCard}
      renderDetail={renderDetail}
      selectedId={selectedId}
      onSelectedIdChange={setSelectedId}
      query={query}
      onQueryChange={setQuery}
      filterValues={filterValues}
      onFilterValuesChange={setFilterValues}
      savedIds={savedSet}
      onSavedIdsChange={onSavedIdsChange}
      chromeless={hostedInWhiteboard}
    />
  );
}

function JobCard({
  job,
  saved,
  onSelect,
  onSave,
}: {
  job: Job;
  saved: boolean;
  onSelect: () => void;
  onSave: () => void;
}) {
  const tone = toneStyles[job.tone];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`Open ${job.title} details`}
      className="w-full text-left bg-canvas-surface rounded-xl border border-canvas-border hover:border-canvas-primary/35 hover:shadow-[0_8px_28px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-primary/40 transition-all overflow-hidden group cursor-pointer"
    >
      <div className="flex">
        <div className={`w-1 shrink-0 ${tone.bar}`} />
        <div className="flex-1 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] font-semibold text-canvas tracking-tight truncate">
                  {job.title}
                </h3>
                <span
                  className={`${tone.chip} ${tone.chipText} rounded-md px-1.5 py-0.5 text-[10px] font-medium shrink-0`}
                >
                  {job.department}
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[12px] text-canvas-muted">
                <span className="flex items-center gap-1">
                  <Building2 size={11} /> {job.property}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {job.location}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <CompatibilityBadge score={job.compatibilityScore} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSave();
                }}
                className={`p-1.5 rounded-md transition-colors ${
                  saved
                    ? 'text-amber-500 bg-amber-50'
                    : 'text-canvas-faint hover:text-amber-500 hover:bg-amber-50'
                }`}
                aria-label={saved ? 'Remove saved' : 'Save job'}
              >
                <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>

          <p className="text-[12.5px] text-canvas-muted leading-relaxed mt-1.5 line-clamp-1">
            {job.description}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {job.skillMatches.slice(0, 3).map((s) => (
              <span
                key={s}
                className={`${tone.chip} ${tone.chipText} rounded-md px-2 py-0.5 text-[10.5px] font-medium`}
              >
                {s}
              </span>
            ))}
            {job.skillMatches.length > 3 && (
              <span className="text-[10.5px] text-canvas-faint">
                +{job.skillMatches.length - 3} more
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-canvas-border">
            <span className="flex items-center gap-1 text-[12px] font-semibold text-canvas">
              <DollarSign size={12} className="text-emerald-600" />{' '}
              {job.payRange}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-canvas-faint">
              <Clock size={11} /> {job.postedDate}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompatibilityBadge({ score }: { score: number }) {
  const tone =
    score >= 90
      ? 'bg-emerald-600 text-white ring-1 ring-emerald-700/40'
      : score >= 80
        ? 'bg-amber-400 text-amber-900'
        : 'bg-blue-400 text-white';
  return (
    <span
      className={`${tone} rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm`}
    >
      {score}% match
    </span>
  );
}

function JobDetailView({
  job,
  saved,
  onBack,
  onSave,
}: {
  job: Job;
  saved: boolean;
  onBack: () => void;
  onSave: () => void;
}) {
  const tone = toneStyles[job.tone];
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-3 py-2 bg-canvas-surface border-b border-canvas-border flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-canvas-muted hover:bg-canvas-surface-subtle hover:text-canvas transition-colors"
        >
          <ArrowLeft size={13} /> All positions
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSave}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
              saved
                ? 'bg-amber-50 text-amber-700'
                : 'bg-canvas-surface-subtle text-canvas-faint hover:bg-canvas-surface-subtle'
            }`}
          >
            <Bookmark size={12} fill={saved ? 'currentColor' : 'none'} />
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div
          className="px-4 pt-5 pb-4 text-white"
          style={{ background: tone.detailHero }}
        >
          <span className="inline-block text-[10.5px] font-semibold uppercase tracking-[0.08em] bg-canvas-surface/20 backdrop-blur rounded-full px-2 py-0.5">
            {job.department}
          </span>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight leading-tight">
            {job.title}
          </h2>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-white/90">
            <span className="flex items-center gap-1">
              <Building2 size={12} /> {job.property}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {job.location}
            </span>
            <span>{job.type}</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="bg-canvas-surface/15 backdrop-blur rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/70">
                Compensation
              </p>
              <p className="text-[13px] font-semibold">{job.payRange}</p>
            </div>
            <div className="bg-canvas-surface/15 backdrop-blur rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/70">
                Team
              </p>
              <p className="text-[13px] font-semibold">{job.team}</p>
            </div>
            <div className="bg-canvas-surface/15 backdrop-blur rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/70">
                Match
              </p>
              <p className="text-[13px] font-semibold">
                {job.compatibilityScore}%
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-canvas-faint mb-1.5">
              About this role
            </h3>
            <p className="text-[13.5px] text-canvas-muted leading-relaxed">
              {job.longDescription}
            </p>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-canvas-faint mb-2">
              What you'll own
            </h3>
            <ul className="space-y-1.5">
              {job.responsibilities.map((r) => (
                <li
                  key={r}
                  className="flex items-start gap-2 text-[13px] text-canvas-muted leading-relaxed"
                >
                  <span
                    className={`mt-1.5 w-1.5 h-1.5 rounded-full ${tone.bar} shrink-0`}
                  />
                  {r}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-canvas-faint mb-2">
              Why you're a match
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {job.skillMatches.map((s) => (
                <span
                  key={s}
                  className={`${tone.chip} ${tone.chipText} rounded-md px-2.5 py-1 text-[11.5px] font-medium inline-flex items-center gap-1`}
                >
                  <Sparkles size={10} /> {s}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="shrink-0 border-t border-canvas-border px-4 py-3 bg-canvas-surface flex items-center gap-2">
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium text-canvas-primary border border-canvas-primary/30 hover:bg-canvas-primary/5 transition-colors"
        >
          <Sparkles size={13} /> Explore role
        </button>
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all"
          style={{
            background:
              'linear-gradient(135deg, var(--landi-color-primary, #0D7377) 0%, var(--landi-color-primary-light, #14B8A6) 100%)',
          }}
        >
          Apply Now <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
