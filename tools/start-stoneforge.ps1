[CmdletBinding()]
param(
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$RootPath = Split-Path -Parent $PSScriptRoot

function Test-LocalPort {
  param([int]$Port)

  foreach ($address in [System.Net.Dns]::GetHostAddresses('localhost')) {
    $client = New-Object System.Net.Sockets.TcpClient($address.AddressFamily)
    try {
      $client.Connect($address, $Port)
      return $true
    } catch {
      $client.Dispose()
    }
  }

  return $false
}

function Start-LocalService {
  param(
    [string]$Name,
    [int]$Port,
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory
  )

  if (Test-LocalPort -Port $Port) {
    Write-Host "$Name is already running on $Port"
    return
  }

  if (-not (Test-Path -LiteralPath $FilePath)) {
    throw "Launcher for ${Name} was not found: $FilePath"
  }

  if ($ArgumentList -and $ArgumentList.Count -gt 0) {
    Start-Process `
      -FilePath $FilePath `
      -ArgumentList $ArgumentList `
      -WorkingDirectory $WorkingDirectory `
      -WindowStyle Hidden | Out-Null
  } else {
    Start-Process `
      -FilePath $FilePath `
      -WorkingDirectory $WorkingDirectory `
      -WindowStyle Hidden | Out-Null
  }

  Write-Host "$Name is starting on $Port"
}

function Wait-LocalPort {
  param(
    [int]$Port,
    [string]$Name,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while (-not (Test-LocalPort -Port $Port)) {
    if ((Get-Date) -gt $deadline) {
      throw "$Name did not become ready on port $Port within $TimeoutSeconds seconds"
    }

    Start-Sleep -Milliseconds 500
  }
}

function Wait-LocalHttp {
  param(
    [string]$Url,
    [string]$Name,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $probeUrls = @($Url)
  if ($Url -match '^http://127\.0\.0\.1:(\d+)(/.*)?$') {
    $probeUrls += "http://localhost:$($matches[1])$($matches[2])"
  }

  while ($true) {
    foreach ($probeUrl in $probeUrls) {
      try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $probeUrl -TimeoutSec 2
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
          return
        }
      } catch {
      }
    }

    if ((Get-Date) -gt $deadline) {
      throw "$Name did not become ready at $Url within $TimeoutSeconds seconds"
    }

    Start-Sleep -Milliseconds 500
  }
}

function Find-Bun {
  $command = Get-Command bun -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidates = @(
    (Join-Path $env:USERPROFILE '.bun\bin\bun.exe'),
    (Join-Path $env:LOCALAPPDATA 'bun\bin\bun.exe'),
    (Join-Path $env:ProgramFiles 'bun\bun.exe')
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  return $null
}

$quarryServerPath = Join-Path $RootPath 'apps\quarry-server'
$quarryWebPath = Join-Path $RootPath 'apps\quarry-web'
$smithyServerPath = Join-Path $RootPath 'apps\smithy-server'
$smithyWebPath = Join-Path $RootPath 'apps\smithy-web'
$controlCenterPath = Join-Path $RootPath 'apps\control-center-web'
$quarryTsxPath = Join-Path $smithyServerPath 'node_modules\.bin\tsx.cmd'

if (-not (Test-LocalPort -Port 3456)) {
  $bunPath = Find-Bun
  if ($bunPath) {
    Start-LocalService `
      -Name 'Quarry server' `
      -Port 3456 `
      -FilePath $bunPath `
      -ArgumentList @('run', '--hot', 'src/index.ts') `
      -WorkingDirectory $quarryServerPath
  } elseif (Test-Path -LiteralPath $quarryTsxPath) {
    $env:HOST = '127.0.0.1'
    Start-LocalService `
      -Name 'Quarry server' `
      -Port 3456 `
      -FilePath $quarryTsxPath `
      -ArgumentList @('src/index.ts') `
      -WorkingDirectory $quarryServerPath
  } else {
    throw 'Bun or the Quarry tsx launcher is required to start quarry-server'
  }
}

Wait-LocalPort -Port 3456 -Name 'Quarry server'
Wait-LocalHttp -Url 'http://127.0.0.1:3456/api/projects' -Name 'Quarry API'

Start-LocalService `
  -Name 'Quarry web' `
  -Port 5173 `
  -FilePath (Join-Path $quarryWebPath 'node_modules\.bin\vite.cmd') `
  -ArgumentList @('preview', '--host', '127.0.0.1', '--port', '5173', '--configLoader', 'runner') `
  -WorkingDirectory $quarryWebPath

Wait-LocalHttp -Url 'http://127.0.0.1:5173/dashboard/overview' -Name 'Quarry web'

$smithyTsxPath = Join-Path $smithyServerPath 'node_modules\.bin\tsx.cmd'
Start-LocalService `
  -Name 'Smithy server' `
  -Port 3457 `
  -FilePath $smithyTsxPath `
  -ArgumentList @('watch', 'src/index.ts') `
  -WorkingDirectory $smithyServerPath

Wait-LocalPort -Port 3457 -Name 'Smithy server'
Wait-LocalHttp -Url 'http://127.0.0.1:3457/api/providers' -Name 'Smithy providers API'
Wait-LocalHttp -Url 'http://127.0.0.1:3457/api/settings/agent-defaults' -Name 'Smithy settings API'

Start-LocalService `
  -Name 'Smithy web' `
  -Port 5174 `
  -FilePath (Join-Path $smithyWebPath 'node_modules\.bin\vite.cmd') `
  -WorkingDirectory $smithyWebPath

Wait-LocalHttp -Url 'http://127.0.0.1:5174/' -Name 'Smithy web'

Start-LocalService `
  -Name 'Control Center' `
  -Port 5175 `
  -FilePath (Join-Path $controlCenterPath 'node_modules\.bin\vite.cmd') `
  -WorkingDirectory $controlCenterPath

Wait-LocalPort -Port 5175 -Name 'Control Center'
Wait-LocalHttp -Url 'http://127.0.0.1:5175/dashboard' -Name 'Control Center dashboard'

if (-not $NoOpen) {
  Start-Process -FilePath 'rundll32.exe' -ArgumentList @('url.dll,FileProtocolHandler', 'http://localhost:5175/dashboard')
}

Write-Host 'Stoneforge is ready: http://localhost:5175/dashboard'
