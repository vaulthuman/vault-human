-- Test data only. One member with open access who has received all five sample Keys
-- (started a week ago, one Key a day), so Today shows B003 Thank your body.
-- example.com never receives mail, and v1 sends no email at all.
DELETE FROM logs WHERE member_id IN (SELECT id FROM members WHERE email = 'test@example.com');
DELETE FROM members WHERE email = 'test@example.com';
INSERT INTO members (email, name, started_on, tz, access, stripe_customer_id, subscription_status)
VALUES ('test@example.com', 'Test Member', date('now', '-6 days'), 'America/Chicago', 1, 'cus_test_seed', 'active');
