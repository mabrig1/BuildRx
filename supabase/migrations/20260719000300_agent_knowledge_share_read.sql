-- ============================================================
-- 0015 · Fix: knowledge files must be readable by anyone who can
-- use the agent, not just its owner — otherwise a shared/public
-- agent's knowledge base only ever works for the owner.
-- Writes (insert/update/delete) stay owner-only.
-- ============================================================

drop policy "Owners manage own agent knowledge files" on public.agent_knowledge_files;

create policy "Accessible-agent knowledge files are readable"
  on public.agent_knowledge_files for select
  using (
    exists (
      select 1 from public.agents a
      where a.id = agent_id and (a.owner_id = auth.uid() or a.visibility <> 'private')
    )
  );

create policy "Owners can add knowledge files"
  on public.agent_knowledge_files for insert
  with check (
    exists (select 1 from public.agents a where a.id = agent_id and a.owner_id = auth.uid())
  );

create policy "Owners can update knowledge files"
  on public.agent_knowledge_files for update
  using (
    exists (select 1 from public.agents a where a.id = agent_id and a.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.agents a where a.id = agent_id and a.owner_id = auth.uid())
  );

create policy "Owners can delete knowledge files"
  on public.agent_knowledge_files for delete
  using (
    exists (select 1 from public.agents a where a.id = agent_id and a.owner_id = auth.uid())
  );
