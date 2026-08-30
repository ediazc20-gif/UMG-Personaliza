# QA smoke UMG Personaliza
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8081'
$results = New-Object System.Collections.Generic.List[object]

function Assert-Ok([string]$name, [bool]$cond, [string]$detail = '') {
  $results.Add([pscustomobject]@{ Case = $name; Pass = $cond; Detail = $detail }) | Out-Null
  if ($cond) { Write-Host "PASS  $name" -ForegroundColor Green }
  else { Write-Host "FAIL  $name :: $detail" -ForegroundColor Red }
}

$admin = Invoke-RestMethod "$base/login" -Method POST -ContentType 'application/json' -Body '{"identificador":"admin","contrasena":"admin123"}'
Assert-Ok 'A1 login admin' ($admin.ok -and $admin.usuario.rol -eq 'Administrador') "$($admin.usuario.rol)"
$ha = @{ Authorization = "Bearer $($admin.token)"; 'Content-Type' = 'application/json' }

$comprador = Invoke-RestMethod "$base/login" -Method POST -ContentType 'application/json' -Body '{"identificador":"test","contrasena":"test123"}'
Assert-Ok 'A2 login comprador' ($comprador.ok -and $comprador.usuario.rol -eq 'Comprador') "$($comprador.usuario.rol)"
$hc = @{ Authorization = "Bearer $($comprador.token)"; 'Content-Type' = 'application/json' }

$prods = Invoke-RestMethod "$base/api/tienda/productos"
Assert-Ok 'C1 catalogo >= 4' ($prods.productos.Count -ge 4) "count=$($prods.productos.Count)"
$pLlavero = $prods.productos | Where-Object { $_.id -eq 1 } | Select-Object -First 1
$pTaza = $prods.productos | Where-Object { $_.id -eq 5 } | Select-Object -First 1
Assert-Ok 'C2 lado B boolean true' ($pLlavero.tiene_lado_b -eq $true) "$($pLlavero.tiene_lado_b)"
Assert-Ok 'C3 taza sin lado B' ($pTaza.tiene_lado_b -eq $false) "$($pTaza.tiene_lado_b)"

$cats = Invoke-RestMethod "$base/api/tienda/categorias"
Assert-Ok 'C4 categorias' ($cats.categorias.Count -ge 1) "count=$($cats.categorias.Count)"
$areas = Invoke-RestMethod "$base/api/tienda/areas"
Assert-Ok 'C5 areas entrega' ($areas.areas.Count -ge 1) "count=$($areas.areas.Count)"

$cart = Invoke-RestMethod "$base/api/tienda/carrito" -Headers $hc
foreach ($it in @($cart.items)) {
  try { Invoke-RestMethod "$base/api/tienda/carrito/items/$($it.id)" -Method DELETE -Headers $hc | Out-Null } catch {}
}
$add = Invoke-RestMethod "$base/api/tienda/carrito/items" -Method POST -Headers $hc -Body '{"id_producto":1,"cantidad":1,"personalizacion":{"lado_a":{"texto":"QA","filtro":"none"}}}'
Assert-Ok 'K1 add carrito' ($add.ok -and $add.items.Count -ge 1) "items=$($add.items.Count)"

$chk = Invoke-RestMethod "$base/api/tienda/checkout" -Method POST -Headers $hc -Body '{"id_area_entrega":1,"metodo_pago":"efectivo","notas_entrega":"QA smoke"}'
Assert-Ok 'K2 checkout' ($chk.ok -and [bool]$chk.orden.codigo) "$($chk.orden.codigo)"
Assert-Ok 'K3 codigo CSPRNG largo' ($chk.orden.codigo.Length -ge 12) "len=$($chk.orden.codigo.Length)"
Assert-Ok 'K4 pdf constancia' ([bool]$chk.orden.pdf_constancia_url) "$($chk.orden.pdf_constancia_url)"

$codigo = $chk.orden.codigo
$track = Invoke-RestMethod "$base/api/tienda/ordenes/$codigo" -Headers $hc
Assert-Ok 'T1 tracking comprador' ($track.orden.estado -eq 'recibida') "$($track.orden.estado)"

$pdf = Invoke-WebRequest "$base/api/tienda/ordenes/$codigo/constancia" -Headers $hc -UseBasicParsing
Assert-Ok 'T2 PDF 200' ($pdf.StatusCode -eq 200) "ctype=$($pdf.Headers['Content-Type'])"

try {
  Invoke-RestMethod "$base/api/tienda/checkout" -Method POST -Headers $hc -Body '{"id_area_entrega":1}' | Out-Null
  Assert-Ok 'K5 checkout vacio rechazado' $false 'expected error'
} catch {
  $msg = $_.ErrorDetails.Message
  Assert-Ok 'K5 checkout vacio rechazado' ($msg -match 'vaci') "$msg"
}

$lista = Invoke-RestMethod "$base/api/tienda/ordenes/admin/list" -Headers $ha
Assert-Ok 'D1 admin list ordenes' ([bool]$lista.ok) "count=$($lista.ordenes.Count)"
$ord = $lista.ordenes | Where-Object { $_.codigo -eq $codigo } | Select-Object -First 1
Assert-Ok 'D2 orden en listado' ([bool]$ord) "$codigo"

$st = Invoke-RestMethod "$base/api/tienda/ordenes/$($ord.id)/estado" -Method PUT -Headers $ha -Body '{"estado":"en_elaboracion","nota":"QA"}'
Assert-Ok 'D3 cambio estado' ($st.ok -and $st.estado -eq 'en_elaboracion') "$($st.estado)"
$track2 = Invoke-RestMethod "$base/api/tienda/ordenes/$codigo" -Headers $hc
Assert-Ok 'D4 tracking refleja estado' ($track2.orden.estado -eq 'en_elaboracion') "$($track2.orden.estado)"

$prodsAdmin = Invoke-RestMethod "$base/api/tienda/productos/admin/list" -Headers $ha
Assert-Ok 'D5 admin productos' ($prodsAdmin.productos.Count -ge 1) "count=$($prodsAdmin.productos.Count)"

$ventas = Invoke-RestMethod "$base/api/tienda/dashboard/ventas?rango=total" -Headers $ha
Assert-Ok 'D6 dashboard ventas' ([bool]$ventas.ok) "ordenes=$($ventas.resumen.total_ordenes)"

try {
  Invoke-RestMethod "$base/api/tienda/ordenes/admin/list" -Headers $hc | Out-Null
  Assert-Ok 'S1 comprador no admin list' $false 'expected 403'
} catch {
  Assert-Ok 'S1 comprador no admin list' ($_.ErrorDetails.Message -match 'permisos|forbidden') $_.ErrorDetails.Message
}

$perfil = Invoke-RestMethod "$base/api/tienda/perfil" -Headers $hc
Assert-Ok 'P1 perfil get' ([bool]$perfil.ok) "$($perfil.perfil.email)"
$nick = "qa_$([guid]::NewGuid().ToString('N').Substring(0,6))"
$put = Invoke-RestMethod "$base/api/tienda/perfil" -Method PUT -Headers $hc -Body (@{ nickname = $nick } | ConvertTo-Json)
Assert-Ok 'P2 perfil nickname' ($put.ok -and $put.nickname -eq $nick) "$($put.nickname)"

$forgot = Invoke-RestMethod "$base/api/auth/forgot-password" -Method POST -ContentType 'application/json' -Body '{"identificador":"test"}'
Assert-Ok 'R1 forgot password' ([bool]$forgot.ok) "$($forgot.message)"

$cfg = Invoke-RestMethod "$base/api/config/public"
Assert-Ok 'R2 config public' ($cfg.appName -like '*Personaliza*') "$($cfg.appName)"

$pages = @(
  '/', '/recuperar.html', '/comprador/tienda.html', '/comprador/carrito.html',
  '/comprador/checkout.html', '/comprador/historial.html', '/comprador/perfil.html',
  '/admin/administrador.html', '/repartidor/entrega.html', '/supervisor/dashboard.html'
)
foreach ($p in $pages) {
  $r = Invoke-WebRequest "$base$p" -UseBasicParsing
  Assert-Ok "H $p" ($r.StatusCode -eq 200) "status=$($r.StatusCode)"
}

$passN = @($results | Where-Object { $_.Pass }).Count
$failN = @($results | Where-Object { -not $_.Pass }).Count
Write-Host ""
Write-Host "==== QA RESULT: $passN passed, $failN failed / $($results.Count) ====" -ForegroundColor Cyan
$results | Format-Table -AutoSize
if ($failN -gt 0) { exit 1 } else { exit 0 }
