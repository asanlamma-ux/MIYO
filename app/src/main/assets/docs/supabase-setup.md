# Supabase Setup

MIYO uses Supabase for optional cloud backup and future build orchestration.

## Recommended backend shape

- Storage bucket: `project-archives`
- Table: `project_backups`
- Primary columns:
  - `project_id text`
  - `title text`
  - `archive_path text`
  - `schema_version int`
  - `created_at timestamptz default now()`

## MVP flow

1. Export the current project to ZIP.
2. Upload the ZIP to Supabase Storage.
3. Upsert one metadata row into `project_backups`.

## Notes

- The current app implementation is single-user backup/sync first.
- Realtime collaboration is intentionally out of scope for this MVP.
- Keep Row Level Security enabled and scope access to authenticated project owners.

