# =====================================================================
#  sauvegarder.ps1  -  Verifie, enregistre et publie le projet
#
#  Usage : clic droit > "Executer avec PowerShell"
#          ou : powershell -ExecutionPolicy Bypass -File .\sauvegarder.ps1
#
#  Le commit n'a lieu QUE si la compilation et les tests passent.
# =====================================================================
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Etape($n, $txt) { Write-Host "`n[$n] $txt" -ForegroundColor Cyan }

try {
    # --- Verrous git restes d'une execution interrompue ---------------
    Etape 1 "Nettoyage des verrous git"
    if (-not (Get-Process git -ErrorAction SilentlyContinue)) {
        Get-ChildItem .git -Filter "*.lock" -ErrorAction SilentlyContinue |
            ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
        Write-Host "    verrous supprimes" -ForegroundColor DarkGray
    } else {
        Write-Host "    un processus git tourne deja - ferme-le et relance" -ForegroundColor Yellow
    }

    # --- Compilation TypeScript --------------------------------------
    Etape 2 "Compilation TypeScript"
    Push-Location client
    & .\node_modules\.bin\tsc -p tsconfig.app.json --noEmit
    $tsc = $LASTEXITCODE
    Pop-Location
    if ($tsc -ne 0) { throw "La compilation a echoue. Rien n'a ete enregistre." }
    Write-Host "    compilation propre" -ForegroundColor Green

    # --- Tests d'impression ------------------------------------------
    Etape 3 "Tests d'impression"
    & node client\tests\receipt-printing.cjs
    if ($LASTEXITCODE -ne 0) { throw "Les tests ont echoue. Rien n'a ete enregistre." }
    Write-Host "    tests OK" -ForegroundColor Green

    # --- Rien a enregistrer ? ----------------------------------------
    Etape 4 "Etat du depot"
    $modifies = git status --porcelain
    if (-not $modifies) {
        Write-Host "    aucune modification - deja a jour" -ForegroundColor Green
        git push origin main 2>&1 | Out-Null
        Write-Host "`nTermine." -ForegroundColor Green
        Read-Host "Appuie sur Entree pour fermer"
        exit 0
    }
    $modifies | Select-Object -First 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    $n = ($modifies | Measure-Object).Count
    Write-Host "    $n fichier(s)" -ForegroundColor DarkGray

    # --- Commit -------------------------------------------------------
    Etape 5 "Enregistrement"
    $msg = Read-Host "Message de commit (Entree = message automatique)"
    if ([string]::IsNullOrWhiteSpace($msg)) {
        $msg = "maj: $(Get-Date -Format 'yyyy-MM-dd HH:mm') - $n fichier(s)"
    }
    git add -A
    git commit -m $msg
    if ($LASTEXITCODE -ne 0) { throw "Le commit a echoue." }

    # --- Publication --------------------------------------------------
    Etape 6 "Publication sur GitHub"
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw "Le push a echoue - verifie ta connexion ou 'gh auth login'." }

    Write-Host "`nEnregistre et publie." -ForegroundColor Green
    git log --oneline -3
}
catch {
    Write-Host "`nECHEC : $_" -ForegroundColor Red
    Write-Host "Le depot n'a pas ete modifie." -ForegroundColor Yellow
}
finally {
    Read-Host "`nAppuie sur Entree pour fermer"
}
