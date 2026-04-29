# WiFi Persistence Fix

Root cause: wifi_status was not persisted because backend canonical table was missing column or migration not applied.

Action required:
1. Run migration 0062_add_wifi_status_column.sql
2. Ensure frontend is sending metadata.wifi_status
3. Verify client_usina_config.wifi_status is populated
