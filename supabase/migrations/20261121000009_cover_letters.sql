-- Phase 12A — cover letters: metadata + exportable via the document worker.

alter table public.cover_letters
  add column job_title text check (char_length(job_title) <= 200),
  add column company text check (char_length(company) <= 200),
  add column page_size text not null default 'A4' check (page_size in ('A4', 'Letter')),
  add constraint cover_letters_id_user_unique unique (id, user_id);

-- An export is for exactly one resume OR one cover letter (both owned by the same user).
alter table public.document_exports alter column resume_id drop not null;
alter table public.document_exports add column cover_letter_id uuid;
alter table public.document_exports add constraint document_exports_cover_letter_fk
  foreign key (cover_letter_id, user_id) references public.cover_letters (id, user_id) on delete cascade;
alter table public.document_exports add constraint document_exports_one_subject
  check ((resume_id is null) <> (cover_letter_id is null));
create index document_exports_cover_letter_idx on public.document_exports (cover_letter_id) where cover_letter_id is not null;
