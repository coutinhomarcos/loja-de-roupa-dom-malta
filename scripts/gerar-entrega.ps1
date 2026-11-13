# Executar na pasta do projeto. Não inclui credenciais nem dependências geradas.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskRoot=Split-Path $PSScriptRoot -Parent
$taskZip=Join-Path $taskRoot 'DOM-MALTA-atualizado.zip'
$taskTemp=Join-Path $taskRoot 'DOM-MALTA-atualizado.tmp.zip'
$taskExcluded=@('.git','.vercel','node_modules','.worktrees','.codex','.aws','__pycache__','.preview-cliente')
function Get-DeliveryFiles([string]$taskFolder){
 foreach($taskItem in Get-ChildItem -LiteralPath $taskFolder -Force){
  if($taskItem.PSIsContainer){if($taskItem.Name -notin $taskExcluded){Get-DeliveryFiles $taskItem.FullName};continue}
  if($taskItem.Extension -in @('.zip','.log') -or $taskItem.Name -eq '.preview-cliente-manifest.json'){continue}
  if($taskItem.Name.StartsWith('.env') -and $taskItem.Name -ne '.env.production.example'){continue}
  $taskItem.FullName
 }
}
$taskFiles=@(Get-DeliveryFiles $taskRoot)
$taskStream=[System.IO.File]::Open($taskTemp,[System.IO.FileMode]::Create)
$taskArchive=[System.IO.Compression.ZipArchive]::new($taskStream,[System.IO.Compression.ZipArchiveMode]::Create)
try{
 foreach($taskFile in $taskFiles){
  $taskName=$taskFile.Substring($taskRoot.Length+1).Replace('\','/')
  $taskEntry=$taskArchive.CreateEntry($taskName,[System.IO.Compression.CompressionLevel]::Optimal)
  $taskInput=[System.IO.File]::OpenRead($taskFile);$taskOutput=$taskEntry.Open()
  try{$taskInput.CopyTo($taskOutput)}finally{$taskInput.Dispose();$taskOutput.Dispose()}
 }
}finally{$taskArchive.Dispose();$taskStream.Dispose()}
$taskCheck=[System.IO.Compression.ZipFile]::OpenRead($taskTemp)
try{
 foreach($taskRequired in @('index.html','admin/js/banco.js','admin/js/calculos.js','DOM-MALTA.code-workspace','docs/MANUAL-OPERACAO.md','docs/REVISAO-FINAL.md')){
  if($taskCheck.Entries.FullName -notcontains $taskRequired){throw "Arquivo ausente: $taskRequired"}
 }
 foreach($taskEntry in $taskCheck.Entries){$taskRead=$taskEntry.Open();try{$taskRead.CopyTo([System.IO.Stream]::Null)}finally{$taskRead.Dispose()}}
 $taskCount=$taskCheck.Entries.Count
}finally{$taskCheck.Dispose()}
Move-Item -LiteralPath $taskTemp -Destination $taskZip -Force
Write-Output "ZIP conferido: $taskCount arquivos; $([math]::Round((Get-Item $taskZip).Length/1MB,1)) MB"
Get-FileHash -LiteralPath $taskZip -Algorithm SHA256 | Select-Object Hash
