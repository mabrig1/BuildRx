-- ============================================================
-- 0009 · Chat message editing
-- Allow project owners to edit their own user messages.
-- ============================================================

create policy "Owners can update own user messages"
  on public.chat_messages for update
  using (
    user_id = auth.uid()
    and role = 'user'
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and role = 'user'
  );
