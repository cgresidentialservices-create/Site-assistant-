-- C&G Site Assistant: work-leads intake
-- Run in Supabase SQL Editor. This adds separate lead records; it does not alter biz_state or existing jobs.
create table if not exists public.work_leads (
  id uuid primary key default gen_random_uuid(),
  original_message text not null,
  source_type text not null default 'whatsapp_group' check (source_type in ('whatsapp_group','whatsapp_direct','manual')),
  source_name text,
  sender_name text,
  source_message_date timestamptz,
  source_key text unique,
  lead_type text not null default 'needs_review' check (lead_type in ('work_offer','seeking_work','referral','trade_request','general_enquiry','needs_review')),
  trade text,
  location_text text,
  job_summary text,
  confidence numeric(4,3) not null default 0.300 check (confidence >= 0 and confidence <= 1),
  status text not null default 'review_required' check (status in ('new','review_required','contacted','converted','not_a_lead','duplicate','closed')),
  classification_reason text,
  created_by uuid not null default auth.uid() references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_leads_status_created_idx on public.work_leads (status, created_at desc);
create index if not exists work_leads_created_by_idx on public.work_leads (created_by, created_at desc);

alter table public.work_leads enable row level security;

drop policy if exists "Owners can read work leads" on public.work_leads;
create policy "Owners can read work leads"
on public.work_leads for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner' and p.approved = true));

drop policy if exists "Owners can create work leads" on public.work_leads;
create policy "Owners can create work leads"
on public.work_leads for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner' and p.approved = true)
);

drop policy if exists "Owners can update work leads" on public.work_leads;
create policy "Owners can update work leads"
on public.work_leads for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner' and p.approved = true))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner' and p.approved = true));

create or replace function public.set_work_leads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists work_leads_updated_at on public.work_leads;
create trigger work_leads_updated_at
before update on public.work_leads
for each row execute function public.set_work_leads_updated_at();
