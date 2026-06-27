-- 体重记录
ALTER TABLE diary_entries ADD COLUMN weight DOUBLE PRECISION;
ALTER TABLE diary_entries ADD COLUMN target_weight DOUBLE PRECISION;
