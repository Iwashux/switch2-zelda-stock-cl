# cloudflare/

- `src/index.js`: Worker de Cloudflare. Cada minuto dispara el workflow `cloudflare-dispatch.yml` en GitHub (`repository_dispatch`). Expone `/health` y `POST /run`.
- `src/monitor-core.js`: lógica del monitor (tiendas, filtros, región, estado y avisos).
- `run-monitor.mjs`: punto de entrada que ejecuta el workflow (`DRY_RUN=1` para probar en local).
- `test-alerts.mjs`: prueba de los canales de aviso (workflow **Probar avisos**).
- `selftest.mjs`: pruebas sin red de los parsers y de la detección de región.

La configuración, el despliegue y la verificación están en el [README principal](../README.md).
