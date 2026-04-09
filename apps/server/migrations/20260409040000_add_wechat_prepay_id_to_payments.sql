ALTER TABLE payments
ADD COLUMN IF NOT EXISTS wechat_prepay_id varchar;
