/**
 * Career agent tool-routing grounding — appended to system prompts so models
 * prefer domain tools (open_positions) over generic canvas tools (share_artifact).
 *
 * Moss ships this via fixture `agentJobsGuide`; Sandals embed config was missing it.
 */

export const DEFAULT_CAREER_AGENT_JOBS_GUIDE = `## Canvas tools — career concierge (MANDATORY routing)

// When the candidate asks about jobs, openings, roles, departments, islands, applications, growth paths, or learning resources, **call the matching career tool** — do **not** paste long markdown lists in chat and do **not** use \`share_artifact\` for job boards.
| User intent | Tool | Opens panel |
|-------------|------|-------------|
| Jobs openings "show me roles" | \`open_positions\` | open-positions |
| Specific job detail | \`show_job_detail\` | open-positions |
| My applications status | \`open_applications\` | applications |
| Career paths trajectories | \`open_growth_paths\` | growth-paths |
| Guides SCU benefits | \`open_resources\` or \`open_learning\` | resources |

### open_positions filters (use when user names a filter)
- \`department\` — Operations, Food & Beverage, Information Technology, Guest Services, Learning & Development, Spa, Entertainment
- \`track\` — Professionals, Solar Hourly, Full-time · Salary
- \`location\` — Jamaica, Bahamas, St. Lucia, Honduras, etc.
- \`search\` — free text across title, department, location, tags

### NEVER for job content
- Do **not** call \`share_artifact\` for job lists, department summaries, or "Open Positions" markdown — that opens the wrong panel.
- Do **not** call \`draw_shapes\`, \`arrange\`, or other canvas drawing tools for job boards — use \`open_positions\` and let the panel show data.
- After calling a career tool, keep your spoken/text reply short; the panel shows the data.

### Voice + chat parity
// Use the same tools in voice and text chat. Opening a panel is always preferred over describing the full list inline.`;
/** Append agentJobsGuide (or default) to a base system prompt. */
export function enrichCareerAgentSystemPrompt(
  systemPrompt: string,
  agentJobsGuide?: string): string {
  const guide = (agentJobsGuide?.trim() || DEFAULT_CAREER_AGENT_JOBS_GUIDE).trim();
  const base = systemPrompt.trim();
  if (!base) return guide;
  if (base.includes('open_positions') && base.includes('share_artifact')) {
    return base;
  }
  return `${base}\n\n${guide}`;
}
