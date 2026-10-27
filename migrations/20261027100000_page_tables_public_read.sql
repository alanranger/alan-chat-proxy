-- Crawled public alanranger.com page content: read-only for the publishable (anon) key.
-- Used by Schema Tools' blog generator (dates, images, meta). RLS stays on; with no
-- insert/update/delete policies, anon writes remain blocked.
-- Approved by Alan 2026-10-27.

drop policy if exists "page_entities public read" on public.page_entities;
create policy "page_entities public read" on public.page_entities for select to anon using (true);

drop policy if exists "page_html public read" on public.page_html;
create policy "page_html public read" on public.page_html for select to anon using (true);

drop policy if exists "page_chunks public read" on public.page_chunks;
create policy "page_chunks public read" on public.page_chunks for select to anon using (true);
