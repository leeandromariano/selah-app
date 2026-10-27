begin;
-- Bind a frontend claim to its originating session identity, not a later SDK session.
-- Existing WITH CHECK user_id = auth.uid() remains the authorization boundary.
grant insert (user_id) on public.account_usernames to authenticated;
commit;
