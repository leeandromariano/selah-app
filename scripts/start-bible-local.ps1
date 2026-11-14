$ErrorActionPreference = 'Stop'
$projectDirectory = [System.IO.Directory]::GetParent($PSScriptRoot).FullName
$inputBuffer = [System.Text.StringBuilder]::new()
[System.Console]::Write('Cole a chave da API.Bible (ela nao sera exibida) e pressione Enter: ')
while ($true) {
  $keyPress = [System.Console]::ReadKey($true)
  if ($keyPress.Key -eq [System.ConsoleKey]::Enter) { break }
  if ($keyPress.Key -eq [System.ConsoleKey]::Backspace) {
    if ($inputBuffer.Length -gt 0) { [void]$inputBuffer.Remove($inputBuffer.Length - 1, 1) }
  } elseif (-not [char]::IsControl($keyPress.KeyChar)) {
    [void]$inputBuffer.Append($keyPress.KeyChar)
  }
}
[System.Console]::WriteLine()
if ($inputBuffer.Length -eq 0) { throw 'A chave nao foi informada.' }
$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = [Environment]::GetEnvironmentVariable('ComSpec')
$startInfo.Arguments = '/d /c npm.cmd run dev'
$startInfo.WorkingDirectory = $projectDirectory
$startInfo.UseShellExecute = $false
# Use the Windows trust store for the local Node process; keep TLS validation enabled.
$startInfo.EnvironmentVariables['NODE_USE_SYSTEM_CA'] = '1'
$startInfo.EnvironmentVariables['BIBLE_API_KEY'] = $inputBuffer.ToString()
[void]$inputBuffer.Clear()
try {
  $process = [System.Diagnostics.Process]::Start($startInfo)
  $process.WaitForExit()
} finally {
  $startInfo.EnvironmentVariables.Remove('BIBLE_API_KEY')
}
