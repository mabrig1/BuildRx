-- Seed data for local development.
-- Applied automatically by `npx supabase db reset`.

-- Starter templates -------------------------------------------
insert into public.templates (slug, name, description, category, prompt, is_featured)
values
  (
    'landing-page',
    'Landing Page',
    'A modern marketing landing page with hero, features, and CTA sections.',
    'marketing',
    'Build a modern landing page with a bold hero section, a three-column feature grid, social proof, and a call-to-action footer. Use a clean, minimal design.',
    true
  ),
  (
    'saas-dashboard',
    'SaaS Dashboard',
    'An analytics dashboard with stat cards, charts, and a data table.',
    'dashboard',
    'Build a SaaS analytics dashboard with a sidebar, stat summary cards, a line chart of weekly activity, and a sortable data table of recent records.',
    true
  ),
  (
    'todo-app',
    'Task Tracker',
    'A task management app with lists, due dates, and completion states.',
    'productivity',
    'Build a task tracker where users can add tasks with due dates, group them into lists, mark them complete, and filter by status.',
    true
  ),
  (
    'portfolio',
    'Portfolio',
    'A personal portfolio with project showcase and contact section.',
    'personal',
    'Build a personal portfolio site with an about section, a grid of project cards with images and tags, and a contact form.',
    false
  ),
  (
    'blog',
    'Blog',
    'A minimal blog with article list and reading view.',
    'content',
    'Build a minimal blog with a homepage listing articles by date, individual article pages with clean typography, and tag filtering.',
    false
  )
on conflict (slug) do nothing;
