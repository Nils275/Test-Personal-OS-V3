$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ModelName = 'vosk-model-small-fr-0.22'
$ZipPath = Join-Path $Root "$ModelName.zip"
$ExtractPath = Join-Path $Root 'vosk-temp'
$ModelsPath = Join-Path $Root 'models'
$FinalPath = Join-Path $ModelsPath 'vosk-model-small-fr-0.22.tar.gz'
$Url = "https://alphacephei.com/vosk/models/$ModelName.zip"

Write-Host 'Téléchargement du modèle français Vosk (~41 Mo)...' -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $ModelsPath | Out-Null
Invoke-WebRequest -Uri $Url -OutFile $ZipPath
if (Test-Path $ExtractPath) { Remove-Item $ExtractPath -Recurse -Force }
New-Item -ItemType Directory -Force -Path $ExtractPath | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $ExtractPath -Force
$SourceModel = Join-Path $ExtractPath $ModelName
if (!(Test-Path $SourceModel)) { throw "Dossier modèle introuvable : $SourceModel" }
$TarExe = (Get-Command tar.exe -ErrorAction Stop).Source
Push-Location $ExtractPath
try {
  & $TarExe -czf $FinalPath $ModelName
  if ($LASTEXITCODE -ne 0) { throw 'La création de l’archive tar.gz a échoué.' }
} finally { Pop-Location }
Remove-Item $ZipPath -Force
Remove-Item $ExtractPath -Recurse -Force
Write-Host "Modèle installé : $FinalPath" -ForegroundColor Green
Write-Host 'Tu peux maintenant ouvrir http://localhost:8080 et activer Hé Sophie.' -ForegroundColor Green
