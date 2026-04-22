create table if not exists coach_memories (
  user_id  uuid    not null references auth.users(id) on delete cascade,
  key      text    not null,
  value    text    not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table coach_memories enable row level security;

create policy "Users can manage their own memories"
  on coach_memories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
