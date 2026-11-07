-- Candidate for a dedicated Cloudflare D1 database; not applied by the build.
-- Bucket values contain an SHA-256 account identifier or a UTC date, never text
-- of the Bible or credentials. Retention/cleanup requires operational review.
create table if not exists bible_quota (
  bucket text primary key,
  count integer not null check (count >= 0)
);
