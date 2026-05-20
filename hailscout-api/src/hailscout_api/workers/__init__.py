"""Background workers (alert dispatch, future cron-style tasks).

Each module is a standalone entrypoint: deploy as a separate Railway
service against the shared API Dockerfile with a different start
command, e.g.

    python -u -m hailscout_api.workers.alert_worker
"""
