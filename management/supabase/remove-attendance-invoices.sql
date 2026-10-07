-- Airavat Management feature cleanup
-- Run this once in Supabase SQL Editor to remove the old attendance and invoice data/features.
-- This permanently deletes existing attendance, attendance selfie, and invoice data.

drop table if exists public.guard_attendance cascade;
drop table if exists public.invoices cascade;

drop function if exists public.is_guard_for(text) cascade;

delete from storage.objects where bucket_id = 'guard-attendance-selfies';
delete from storage.buckets where id = 'guard-attendance-selfies';

-- The guard-photos bucket is still used by guard profiles and is intentionally kept.
