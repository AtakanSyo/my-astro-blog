-- Fix numeric overflow when average user rating reaches 10.00
-- Previous type numeric(3,2) cannot store 10.00 (max 9.99).

alter table public.telescopes
  alter column user_rating type numeric(4,2);
