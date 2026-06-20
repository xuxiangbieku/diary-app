-- 在 Supabase SQL Editor 中运行此脚本
-- 为 diary_entries 表添加 (user_id, date) 唯一约束
-- 这样 upsert（Prefer: resolution=merge-duplicates）才能正确匹配记录

ALTER TABLE diary_entries
  ADD CONSTRAINT diary_entries_user_date_unique
  UNIQUE (user_id, date);

-- 如果之前有重复数据，先清理重复记录（保留最新的）
DELETE FROM diary_entries
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM diary_entries
  GROUP BY user_id, date
);
