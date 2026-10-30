#!/usr/bin/env bash
# 権限(RLS)のテスト。ローカルの PostgreSQL(16 で確認)に、テスト用の DB を作り直して実行する
#   使い方: PGHOST=... PGPORT=... supabase/tests/run_tests.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=memoapp_test
psql -U postgres -X -q -c "drop database if exists $DB" -c "create database $DB" 2>/dev/null
for f in supabase/tests/local_bootstrap.sql supabase/migrations/*.sql supabase/tests/rls_test.sql; do
  psql -U postgres -X -q -o /dev/null -v ON_ERROR_STOP=1 -d "$DB" -f "$f" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
done
