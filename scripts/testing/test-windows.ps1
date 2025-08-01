# EAI Security Check - Windows Testing Script
# Tests all security checking methods on Windows systems

param(
    [switch]$Quiet = $false
)

# Colors for output (PowerShell)
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Magenta = "Magenta"
    Cyan = "Cyan"
    White = "White"
}

# Get script directory and project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$CLIPath = Join-Path $ProjectRoot "dist\cli\index.js"

# Test results tracking
$Script:TotalTests = 0
$Script:PassedTests = 0
$Script:FailedTests = 0
$Script:SkippedTests = 0

Write-Host "🪟 EAI Security Check - Windows Testing Suite" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Function to display test header
function Test-Header {
    param([string]$TestName)
    Write-Host "🔍 Testing: $TestName" -ForegroundColor Blue
    Write-Host ("=" * 50) -ForegroundColor Blue
}

# Function to display test result
function Test-Result {
    param(
        [string]$TestName,
        [string]$Status,
        [string]$Message = ""
    )
    
    $Script:TotalTests++
    
    switch ($Status) {
        "PASS" {
            Write-Host "✅ $TestName`: PASSED" -ForegroundColor Green
            if ($Message) { Write-Host "   $Message" }
            $Script:PassedTests++
        }
        "FAIL" {
            Write-Host "❌ $TestName`: FAILED" -ForegroundColor Red
            if ($Message) { Write-Host "   $Message" }
            $Script:FailedTests++
        }
        "SKIP" {
            Write-Host "⏭️  $TestName`: SKIPPED" -ForegroundColor Yellow
            if ($Message) { Write-Host "   $Message" }
            $Script:SkippedTests++
        }
    }
}

# Function to pause for user interaction
function Pause-ForUser {
    param([string]$Message)
    Write-Host ""
    Write-Host "⏸️  $Message" -ForegroundColor Yellow
    
    # Check if running in non-interactive mode (CI or automated environment)
    if ($env:CI -eq "true" -or $env:TESTING_MODE -eq "non-interactive" -or $Quiet) {
        Write-Host "⏭️  Skipping user prompt (non-interactive mode)" -ForegroundColor Yellow
        Write-Host ""
        return
    }
    
    Write-Host "Press Enter to continue after making changes, or 'q' to quit..." -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq "q" -or $response -eq "Q") {
        Write-Host "👋 Testing stopped by user." -ForegroundColor Cyan
        exit 0
    }
    Write-Host ""
}

# Display system information
Write-Host "🖥️  System Information:" -ForegroundColor Magenta
Write-Host "   Computer Name: $env:COMPUTERNAME"
Write-Host "   Windows Version: $((Get-CimInstance Win32_OperatingSystem).Caption)"
Write-Host "   Build Number: $((Get-CimInstance Win32_OperatingSystem).BuildNumber)"
Write-Host "   Architecture: $((Get-CimInstance Win32_OperatingSystem).OSArchitecture)"
Write-Host "   Current User: $env:USERNAME"
Write-Host "   Domain: $env:USERDOMAIN"
Write-Host ""

# Check if CLI tool exists
if (-not (Test-Path $CLIPath)) {
    Write-Host "❌ CLI tool not found at: $CLIPath" -ForegroundColor Red
    Write-Host "Please run 'npm run build' from the project root first." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ CLI tool found and ready for testing" -ForegroundColor Green
Write-Host ""

# Test 1: Platform Detection
Test-Header "Platform Detection"
try {
    $platformInfo = & node $CLIPath check --quiet 2>&1 | Select-Object -First 5
    if ($platformInfo -match "windows|win32") {
        Test-Result "Platform Detection" "PASS" "Windows platform correctly detected"
    } else {
        Test-Result "Platform Detection" "FAIL" "Windows platform not detected correctly"
    }
} catch {
    Test-Result "Platform Detection" "FAIL" "Failed to run platform detection"
}
Write-Host ""

# Test 2: BitLocker Disk Encryption
Test-Header "BitLocker Disk Encryption"
Write-Host "Checking BitLocker encryption status..."

try {
    $bitlockerStatus = manage-bde -status 2>$null
    if ($bitlockerStatus -match "Protection On") {
        Test-Result "BitLocker" "PASS" "BitLocker is enabled on at least one drive"
        $protectedDrives = ($bitlockerStatus | Select-String "Protection On").Count
        Write-Host "   Protected drives found: $protectedDrives"
    } else {
        Test-Result "BitLocker" "FAIL" "BitLocker is not enabled"
        Write-Host "💡 To enable BitLocker:" -ForegroundColor Yellow
        Write-Host "   Control Panel > System and Security > BitLocker Drive Encryption"
        Write-Host "   Or use: manage-bde -on C: -RecoveryPassword" -ForegroundColor Yellow
        Pause-ForUser "Enable BitLocker and then continue testing"
    }
} catch {
    Test-Result "BitLocker" "SKIP" "Unable to check BitLocker status (may need admin privileges)"
}
Write-Host ""

# Test 3: Windows Defender Firewall
Test-Header "Windows Defender Firewall"
Write-Host "Checking Windows Defender Firewall status..."

try {
    $firewallProfiles = Get-NetFirewallProfile
    $allEnabled = $true
    
    foreach ($profile in $firewallProfiles) {
        if ($profile.Enabled -eq $false) {
            $allEnabled = $false
            Test-Result "Firewall $($profile.Name)" "FAIL" "$($profile.Name) profile is disabled"
        } else {
            Test-Result "Firewall $($profile.Name)" "PASS" "$($profile.Name) profile is enabled"
        }
    }
    
    if (-not $allEnabled) {
        Write-Host "💡 To enable Windows Defender Firewall:" -ForegroundColor Yellow
        Write-Host "   Control Panel > System and Security > Windows Defender Firewall" -ForegroundColor Yellow
        Write-Host "   Or use: Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True" -ForegroundColor Yellow
        Pause-ForUser "Enable Windows Defender Firewall profiles and continue testing"
    }
} catch {
    Test-Result "Windows Defender Firewall" "SKIP" "Unable to check firewall status"
}
Write-Host ""

# Test 4: Windows Defender Antivirus
Test-Header "Windows Defender Antivirus"
Write-Host "Checking Windows Defender Antivirus status..."

try {
    $defenderStatus = Get-MpComputerStatus
    
    if ($defenderStatus.AntivirusEnabled) {
        Test-Result "Windows Defender AV" "PASS" "Windows Defender Antivirus is enabled"
    } else {
        Test-Result "Windows Defender AV" "FAIL" "Windows Defender Antivirus is disabled"
    }
    
    if ($defenderStatus.RealTimeProtectionEnabled) {
        Test-Result "Real-time Protection" "PASS" "Real-time protection is enabled"
    } else {
        Test-Result "Real-time Protection" "FAIL" "Real-time protection is disabled"
    }
    
    # Check definition age
    $lastUpdate = $defenderStatus.AntivirusSignatureLastUpdated
    $daysSinceUpdate = (Get-Date) - $lastUpdate
    if ($daysSinceUpdate.Days -le 7) {
        Test-Result "Defender Definitions" "PASS" "Definitions updated $($daysSinceUpdate.Days) days ago"
    } else {
        Test-Result "Defender Definitions" "FAIL" "Definitions are $($daysSinceUpdate.Days) days old"
    }
    
} catch {
    Test-Result "Windows Defender" "SKIP" "Unable to check Windows Defender status"
}
Write-Host ""

# Test 5: Windows SmartScreen
Test-Header "Windows SmartScreen"
Write-Host "Checking SmartScreen settings..."

try {
    # Check SmartScreen for apps and files
    $smartScreenPolicy = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "EnableSmartScreen" -ErrorAction SilentlyContinue
    
    if ($smartScreenPolicy -and $smartScreenPolicy.EnableSmartScreen -eq 1) {
        Test-Result "SmartScreen" "PASS" "SmartScreen is enabled via policy"
    } else {
        # Check user setting
        $userSmartScreen = Get-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppHost" -Name "EnableWebContentEvaluation" -ErrorAction SilentlyContinue
        if ($userSmartScreen -and $userSmartScreen.EnableWebContentEvaluation -eq 1) {
            Test-Result "SmartScreen" "PASS" "SmartScreen is enabled for user"
        } else {
            Test-Result "SmartScreen" "FAIL" "SmartScreen appears to be disabled"
            Write-Host "💡 To enable SmartScreen:" -ForegroundColor Yellow
            Write-Host "   Windows Security > App and browser control > Reputation-based protection" -ForegroundColor Yellow
        }
    }
} catch {
    Test-Result "SmartScreen" "SKIP" "Unable to check SmartScreen settings"
}
Write-Host ""

# Test 6: User Account Control (UAC)
Test-Header "User Account Control (UAC)"
Write-Host "Checking UAC settings..."

try {
    $uacLevel = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name "ConsentPromptBehaviorAdmin" -ErrorAction SilentlyContinue
    
    if ($uacLevel -and $uacLevel.ConsentPromptBehaviorAdmin -ge 2) {
        Test-Result "UAC" "PASS" "UAC is enabled (level: $($uacLevel.ConsentPromptBehaviorAdmin))"
    } else {
        Test-Result "UAC" "FAIL" "UAC is disabled or set too low"
        Write-Host "💡 To enable UAC:" -ForegroundColor Yellow
        Write-Host "   Control Panel > User Accounts > Change User Account Control settings" -ForegroundColor Yellow
        Pause-ForUser "Enable UAC and continue testing"
    }
} catch {
    Test-Result "UAC" "SKIP" "Unable to check UAC settings"
}
Write-Host ""

# Test 7: Windows Update Settings
Test-Header "Windows Update"
Write-Host "Checking Windows Update configuration..."

try {
    # Check if Windows Update service is running
    $wuService = Get-Service -Name "wuauserv" -ErrorAction SilentlyContinue
    if ($wuService -and $wuService.Status -eq "Running") {
        Test-Result "Windows Update Service" "PASS" "Windows Update service is running"
    } else {
        Test-Result "Windows Update Service" "FAIL" "Windows Update service is not running"
    }
    
    # Check automatic updates setting
    $autoUpdate = Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -Name "NoAutoUpdate" -ErrorAction SilentlyContinue
    if (-not $autoUpdate -or $autoUpdate.NoAutoUpdate -eq 0) {
        Test-Result "Automatic Updates" "PASS" "Automatic updates are enabled"
    } else {
        Test-Result "Automatic Updates" "FAIL" "Automatic updates are disabled"
        Write-Host "💡 To enable automatic updates:" -ForegroundColor Yellow
        Write-Host "   Settings > Update and Security > Windows Update > Advanced options" -ForegroundColor Yellow
    }
    
} catch {
    Test-Result "Windows Update" "SKIP" "Unable to check Windows Update settings"
}
Write-Host ""

# Test 8: Remote Desktop
Test-Header "Remote Desktop"
Write-Host "Checking Remote Desktop settings..."

try {
    $rdpEnabled = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -ErrorAction SilentlyContinue
    
    if ($rdpEnabled -and $rdpEnabled.fDenyTSConnections -eq 1) {
        Test-Result "Remote Desktop" "PASS" "Remote Desktop is disabled"
    } else {
        Test-Result "Remote Desktop" "FAIL" "Remote Desktop is enabled (potential security risk)"
        Write-Host "💡 To disable Remote Desktop:" -ForegroundColor Yellow
        Write-Host "   System Properties > Remote > Disable Remote Desktop" -ForegroundColor Yellow
        Pause-ForUser "Disable Remote Desktop if not needed and continue testing"
    }
} catch {
    Test-Result "Remote Desktop" "SKIP" "Unable to check Remote Desktop settings"
}
Write-Host ""

# Test 9: File and Printer Sharing
Test-Header "File and Printer Sharing"
Write-Host "Checking sharing services..."

try {
    # Check if Server service is running (file sharing)
    $serverService = Get-Service -Name "LanmanServer" -ErrorAction SilentlyContinue
    if ($serverService -and $serverService.Status -eq "Running") {
        Test-Result "File Sharing Service" "FAIL" "File sharing service is running"
        Write-Host "💡 Consider disabling if not needed:" -ForegroundColor Yellow
        Write-Host "   Control Panel > Network and Sharing Center > Advanced sharing settings" -ForegroundColor Yellow
    } else {
        Test-Result "File Sharing Service" "PASS" "File sharing service is not running"
    }
    
    # Check network discovery
    $networkDiscovery = Get-NetFirewallRule -DisplayGroup "Network Discovery" | Where-Object {$_.Enabled -eq "True"}
    if ($networkDiscovery) {
        Test-Result "Network Discovery" "FAIL" "Network discovery is enabled"
    } else {
        Test-Result "Network Discovery" "PASS" "Network discovery is disabled"
    }
    
} catch {
    Test-Result "File and Printer Sharing" "SKIP" "Unable to check sharing settings"
}
Write-Host ""

# Test 10: Password Policy
Test-Header "Password Policy"
Write-Host "Checking local security policy..."

try {
    # Get password policy using secedit
    $tempFile = [System.IO.Path]::GetTempFileName()
    secedit /export /cfg $tempFile /quiet
    
    if (Test-Path $tempFile) {
        $policyContent = Get-Content $tempFile
        
        # Check minimum password length
        $minLength = ($policyContent | Select-String "MinimumPasswordLength = (\d+)").Matches.Groups[1].Value
        if ([int]$minLength -ge 8) {
            Test-Result "Password Length" "PASS" "Minimum password length: $minLength characters"
        } else {
            Test-Result "Password Length" "FAIL" "Minimum password length too short: $minLength characters"
        }
        
        # Check password complexity
        $complexity = ($policyContent | Select-String "PasswordComplexity = (\d+)").Matches.Groups[1].Value
        if ([int]$complexity -eq 1) {
            Test-Result "Password Complexity" "PASS" "Password complexity is required"
        } else {
            Test-Result "Password Complexity" "FAIL" "Password complexity is not required"
        }
        
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
    
} catch {
    Test-Result "Password Policy" "SKIP" "Unable to check password policy"
}
Write-Host ""

# Test 11: Screen Lock Settings
Test-Header "Screen Lock Settings"
Write-Host "Checking screen saver and lock settings..."

try {
    # Check if screen saver is enabled
    $screenSaverEnabled = Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveActive" -ErrorAction SilentlyContinue
    if ($screenSaverEnabled -and $screenSaverEnabled.ScreenSaveActive -eq "1") {
        Test-Result "Screen Saver" "PASS" "Screen saver is enabled"
        
        # Check screen saver timeout
        $timeout = Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveTimeOut" -ErrorAction SilentlyContinue
        if ($timeout -and [int]$timeout.ScreenSaveTimeOut -le 900) {  # 15 minutes
            Test-Result "Screen Saver Timeout" "PASS" "Screen saver timeout: $($timeout.ScreenSaveTimeOut) seconds"
        } else {
            Test-Result "Screen Saver Timeout" "FAIL" "Screen saver timeout too long: $($timeout.ScreenSaveTimeOut) seconds"
        }
        
        # Check if password is required
        $passwordProtected = Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaverIsSecure" -ErrorAction SilentlyContinue
        if ($passwordProtected -and $passwordProtected.ScreenSaverIsSecure -eq "1") {
            Test-Result "Screen Saver Password" "PASS" "Password required for screen saver"
        } else {
            Test-Result "Screen Saver Password" "FAIL" "Password not required for screen saver"
        }
    } else {
        Test-Result "Screen Saver" "FAIL" "Screen saver is disabled"
        Write-Host "💡 To enable screen saver:" -ForegroundColor Yellow
        Write-Host "   Settings > Personalization > Lock screen > Screen saver settings" -ForegroundColor Yellow
        Pause-ForUser "Enable screen saver and continue testing"
    }
} catch {
    Test-Result "Screen Lock Settings" "SKIP" "Unable to check screen lock settings"
}
Write-Host ""

# Test 12: Running EAI Security Check
Test-Header "EAI Security Check Integration"
Write-Host "Running full security check to validate integration..."

try {
    $tempOutput = New-TemporaryFile
    $output = & node $CLIPath check default --quiet 2>&1 | Out-File -FilePath $tempOutput.FullName
    
    if ($LASTEXITCODE -eq 0) {
        Test-Result "CLI Integration" "PASS" "EAI Security Check ran successfully"
        Write-Host "Sample output:" -ForegroundColor Cyan
        Get-Content $tempOutput.FullName | Select-Object -First 10 | ForEach-Object { Write-Host "   $_" }
    } else {
        Test-Result "CLI Integration" "FAIL" "EAI Security Check failed to run"
        Write-Host "Error output:" -ForegroundColor Red
        Get-Content $tempOutput.FullName | Select-Object -First 5 | ForEach-Object { Write-Host "   $_" }
    }
    
    Remove-Item $tempOutput.FullName -Force -ErrorAction SilentlyContinue
} catch {
    Test-Result "CLI Integration" "FAIL" "Exception running EAI Security Check: $($_.Exception.Message)"
}
Write-Host ""

# Display final summary
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🏁 Windows Testing Summary" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Total Tests: $Script:TotalTests"
Write-Host "Passed: $Script:PassedTests" -ForegroundColor Green
Write-Host "Failed: $Script:FailedTests" -ForegroundColor Red
Write-Host "Skipped: $Script:SkippedTests" -ForegroundColor Yellow
Write-Host ""

# Calculate pass rate
if ($Script:TotalTests -gt 0) {
    $passRate = [math]::Round(($Script:PassedTests * 100) / $Script:TotalTests, 1)
    Write-Host "Pass Rate: $passRate%" -ForegroundColor Green
} else {
    Write-Host "Pass Rate: N/A" -ForegroundColor Yellow
}

Write-Host ""
if ($Script:FailedTests -eq 0) {
    Write-Host "🎉 All tests passed! Your Windows system appears to be well-configured for security." -ForegroundColor Green
} else {
    Write-Host "⚠️  Some security settings need attention. Review the failed tests above." -ForegroundColor Yellow
    Write-Host "💡 Use 'node $CLIPath check --help' for more configuration options." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "📚 For more information:" -ForegroundColor Cyan
Write-Host "   • Run: node $CLIPath check default"
Write-Host "   • View: README.md for detailed documentation"  
Write-Host "   • Configure: Use 'node $CLIPath interactive' for guided setup"