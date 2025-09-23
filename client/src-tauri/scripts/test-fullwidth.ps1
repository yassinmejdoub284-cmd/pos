[CmdletBinding()]
param(
  [string]$PrinterName,
  [ValidateSet(32,42,48,56,64)]
  [int]$Columns
)

$ErrorActionPreference = 'Stop'

function Write-Audit {
  param(
    [string]$Message
  )
  $log = Join-Path $env:TEMP 'pos_print_audit.log'
  $entry = "$(Get-Date -Format s) | $Message"
  Add-Content -LiteralPath $log -Value $entry -Encoding UTF8
  $entry
}

# Resolve target printer (prefer parameter, else default, else first available)
if (-not [string]::IsNullOrWhiteSpace($PrinterName)) {
  $targetPrinter = (Get-Printer | Where-Object { $_.Name -eq $PrinterName } | Select-Object -First 1 -ExpandProperty Name)
} else {
  $targetPrinter = (Get-Printer | Where-Object IsDefault -eq $true | Select-Object -First 1 -ExpandProperty Name)
}

if (-not $targetPrinter) {
  # Heuristic: try to find common 80mm names, otherwise pick first
  $targetPrinter = (Get-Printer | Where-Object { $_.Name -match '80|POS|ESC|Thermal' } | Select-Object -First 1 -ExpandProperty Name)
}

if (-not $targetPrinter) {
  $targetPrinter = (Get-Printer | Select-Object -First 1 -ExpandProperty Name)
}

if (-not $targetPrinter) {
  throw 'No printer found. Set a default printer or pass -PrinterName.'
}

# C# helper to send RAW bytes via WinSpool
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class RawPrinterHelper {
  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct DOC_INFO_1 { public string pDocName; public string pOutputFile; public string pDatatype; }
  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
  public static extern int StartDocPrinter(IntPtr hPrinter, int level, ref DOC_INFO_1 di);
  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static bool SendBytesToPrinter(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
    var di = new DOC_INFO_1(); di.pDocName = "POS FullWidth Audit"; di.pDatatype = "RAW";
    int job = StartDocPrinter(hPrinter, 1, ref di); if (job == 0) { ClosePrinter(hPrinter); return false; }
    if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }
    int written; IntPtr unmanaged = Marshal.AllocHGlobal(bytes.Length);
    Marshal.Copy(bytes, 0, unmanaged, bytes.Length);
    bool ok = WritePrinter(hPrinter, unmanaged, bytes.Length, out written);
    Marshal.FreeHGlobal(unmanaged);
    EndPagePrinter(hPrinter); EndDocPrinter(hPrinter); ClosePrinter(hPrinter);
    return ok && written == bytes.Length;
  }
}
"@

# Build one or multiple blocks depending on -Columns
function New-EscPosBlock {
  param([int]$Cols)
  # ESC/POS: init, margins 0, full area, Font B, left align, char spacing 0
  [byte[]]$prefix = 0x1B,0x40, 0x1B,0x4C,0x00,0x00, 0x1B,0x51,0x00, 0x1B,0x57,0x00,0x00,0x00,0x00,0x30,0x00,
                     0x1B,0x4D,0x01, 0x1B,0x21,0x01, 0x1B,0x20,0x00, 0x1B,0x61,0x00
  $digitLine = ($Cols -ge 10) ? ('0123456789' * [Math]::Ceiling($Cols/10))[0..($Cols-1)] -join '' : ('X' * $Cols)
  $lines = @()
  $lines += ('=' * $Cols)
  $lines += ('L' + (' ' * [Math]::Max(0, $Cols - 2)) + 'R')
  $lines += ('X' * $Cols)
  $lines += $digitLine
  $header = "[COLUMNS=$Cols]"
  $body = $header + "`n" + ([string]::Join("`n", $lines)) + "`n`n"
  $bodyBytes = [System.Text.Encoding]::ASCII.GetBytes($body)
  [byte[]]$suffix = 0x0A
  $all = New-Object byte[] ($prefix.Length + $bodyBytes.Length + $suffix.Length)
  [Array]::Copy($prefix, 0, $all, 0, $prefix.Length)
  [Array]::Copy($bodyBytes, 0, $all, $prefix.Length, $bodyBytes.Length)
  [Array]::Copy($suffix, 0, $all, $prefix.Length + $bodyBytes.Length, $suffix.Length)
  ,$all
}

$blocks = @()
if ($PSBoundParameters.ContainsKey('Columns')) {
  $blocks += (New-EscPosBlock -Cols $Columns)
} else {
  foreach ($c in 64,56,48) { $blocks += (New-EscPosBlock -Cols $c) }
}

# Add final cut
[byte[]]$cut = 0x1D,0x56,0x00
$totalLen = ($blocks | ForEach-Object { $_.Length } | Measure-Object -Sum).Sum + $cut.Length
$payload = New-Object byte[] $totalLen
$offset = 0
foreach ($b in $blocks) { [Array]::Copy($b, 0, $payload, $offset, $b.Length); $offset += $b.Length }
[Array]::Copy($cut, 0, $payload, $offset, $cut.Length)

$ok = [RawPrinterHelper]::SendBytesToPrinter($targetPrinter, $payload)
Write-Audit -Message ("printer='{0}' | bytes={1} | success={2}" -f $targetPrinter, $payload.Length, $ok)
