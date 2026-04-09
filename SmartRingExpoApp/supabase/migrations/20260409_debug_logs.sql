create table if not exists public.debug_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.debug_logs enable row level security;

create policy "Users can insert own debug logs"
  on public.debug_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read own debug logs"
  on public.debug_logs for select
  to authenticated
  using (auth.uid() = user_id);
