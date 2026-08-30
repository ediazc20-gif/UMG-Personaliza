# Validación del flujo firma en producción

## 1) Firmador Windows

```powershell
Invoke-RestMethod http://localhost:5080/health
```

Debe devolver `status: ok`.

## 2) Cloudflare Tunnel

Desde la VPS o tu PC:

```bash
curl -sS https://signer.seguridadglobalumg.com/health
```

Misma respuesta JSON.

## 3) Firma PDF de prueba

Con una credencial PDF base64 pequeña (PowerShell en Windows):

```powershell
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("ruta\credencial.pdf"))
Invoke-RestMethod -Uri "https://signer.seguridadglobalumg.com/sign-pdf" `
  -Method Post -Headers @{ Authorization = "Bearer TU_API_KEY" } `
  -ContentType "application/json" `
  -Body (@{ pdfBase64 = $b64; reason = "test"; location = "GT" } | ConvertTo-Json)
```

Debe incluir `signedPdfBase64`.

## 4) Backend en VPS

```bash
docker compose exec backend printenv | grep SIGNING_
```

Comprueba `SIGNING_SERVICE_URL=https://signer.seguridadglobalumg.com`.

## 5) Registro real

1. Registrar usuario en el frontend público.
2. Verificar código.
3. Confirmar correo con PDF adjunto.
4. Descargar PDF y validar en el portal del RPSC.

## Fallos comunes

| Síntoma | Causa probable |
|---------|----------------|
| ECONNREFUSED | Firmador apagado o puerto mal |
| 401 en sign-pdf | API key distinta entre VPS y Windows |
| 502 nginx | Backend caído o mal proxy |
| Certificado no encontrado | UKC cerrado o thumbprint incorrecto |
