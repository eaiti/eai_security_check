# Windows Task Scheduler Setup for EAI Security Check Daemon
# Run this in an Administrator PowerShell session

# Create a scheduled task that runs the daemon at startup
$TaskName = "EAI Security Check Daemon"
$TaskDescription = "Automated security auditing daemon for EAI Security Check tool"
$ExePath = "C:\path\to\eai-security-check.exe"  # Update this path
$Arguments = "daemon"

# Create the task action
$Action = New-ScheduledTaskAction -Execute $ExePath -Argument $Arguments

# Create the task trigger (at startup and daily)
$TriggerStartup = New-ScheduledTaskTrigger -AtStartup
$TriggerDaily = New-ScheduledTaskTrigger -Daily -At "09:00AM"

# Create task settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# Create the task principal (run as current user)
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

# Register the scheduled task
Try {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger @($TriggerStartup, $TriggerDaily) -Settings $Settings -Principal $Principal -Description $TaskDescription
    Write-Host "✅ Successfully created scheduled task: $TaskName" -ForegroundColor Green
    Write-Host "💡 The daemon will now start automatically at system startup" -ForegroundColor Cyan
    Write-Host "💡 It will also run daily at 9:00 AM as a backup" -ForegroundColor Cyan
} Catch {
    Write-Host "❌ Failed to create scheduled task: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Make sure to run this script as Administrator" -ForegroundColor Yellow
}

# Optional: Start the task immediately
# Start-ScheduledTask -TaskName $TaskName