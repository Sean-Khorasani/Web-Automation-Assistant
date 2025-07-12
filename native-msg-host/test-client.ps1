# Test Client for Web Recorder Native Messaging Host
# This script connects to the TCP server and sends test commands

param(
    [int]$Port = 9999,
    [string]$HostName = "localhost"
)

Write-Host "Web Recorder Native Messaging Host Test Client" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Connecting to $HostName`:$Port..." -ForegroundColor Yellow

try {
    # Create TCP client
    $client = New-Object System.Net.Sockets.TcpClient
    $client.Connect($HostName, $Port)
    
    if ($client.Connected) {
        Write-Host "Connected successfully!" -ForegroundColor Green
        Write-Host ""
        
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $writer = New-Object System.IO.StreamWriter($stream)
        $writer.AutoFlush = $true
        
        # Start a background job to read responses
        $readJob = Start-Job -ScriptBlock {
            param($reader)
            while ($true) {
                try {
                    $response = $reader.ReadLine()
                    if ($null -ne $response) {
                        Write-Output $response
                    }
                }
                catch {
                    break
                }
            }
        } -ArgumentList $reader
        
        Write-Host "Test Client Commands:" -ForegroundColor Cyan
        Write-Host "  1. Send 'run' command with instruction name"
        Write-Host "  2. Send 'list' command to get all instructions"
        Write-Host "  3. Send 'record' command to start recording"
        Write-Host "  4. Send 'stop' command to stop recording"
        Write-Host "  5. Send custom JSON command"
        Write-Host "  6. Exit"
        Write-Host ""
        
        while ($client.Connected) {
            Write-Host ""
            Write-Host "Select command (1-6): " -NoNewline -ForegroundColor Yellow
            $choice = Read-Host
            
            $command = $null
            
            switch ($choice) {
                "1" {
                    Write-Host "Enter instruction name: " -NoNewline
                    $name = Read-Host
                    $command = @{
                        action = "run"
                        instruction = $name
                    }
                }
                "2" {
                    $command = @{
                        action = "list"
                    }
                }
                "3" {
                    Write-Host "Enter recording name: " -NoNewline
                    $name = Read-Host
                    $command = @{
                        action = "record"
                        name = $name
                    }
                }
                "4" {
                    $command = @{
                        action = "stop"
                    }
                }
                "5" {
                    Write-Host "Enter custom JSON (single line): " -NoNewline
                    $customJson = Read-Host
                    try {
                        $command = $customJson | ConvertFrom-Json
                    }
                    catch {
                        Write-Host "Invalid JSON format!" -ForegroundColor Red
                        continue
                    }
                }
                "6" {
                    Write-Host "Exiting..." -ForegroundColor Yellow
                    break
                }
                default {
                    Write-Host "Invalid choice!" -ForegroundColor Red
                    continue
                }
            }
            
            if ($null -ne $command) {
                # Send command
                $json = $command | ConvertTo-Json -Compress
                Write-Host "Sending: $json" -ForegroundColor Cyan
                $writer.WriteLine($json)
                
                # Wait for response
                Start-Sleep -Milliseconds 500
                
                # Check for responses
                $responses = Receive-Job -Job $readJob -ErrorAction SilentlyContinue
                foreach ($response in $responses) {
                    Write-Host "Response: " -NoNewline -ForegroundColor Green
                    Write-Host $response
                    
                    # Try to parse and pretty-print JSON
                    try {
                        $responseObj = $response | ConvertFrom-Json
                        Write-Host "Parsed response:" -ForegroundColor Green
                        $responseObj | ConvertTo-Json -Depth 10 | Write-Host
                    }
                    catch {
                        # Response might not be JSON
                    }
                }
            }
        }
        
        # Cleanup
        Stop-Job -Job $readJob -ErrorAction SilentlyContinue
        Remove-Job -Job $readJob -ErrorAction SilentlyContinue
        
        $writer.Close()
        $reader.Close()
        $stream.Close()
        $client.Close()
    }
    else {
        Write-Host "Failed to connect!" -ForegroundColor Red
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure the native messaging host is running:" -ForegroundColor Yellow
    Write-Host "  1. Install the host: Run install.bat as administrator" -ForegroundColor White
    Write-Host "  2. The browser extension must be running (it starts the host)" -ForegroundColor White
    Write-Host "  3. Or manually start: powershell -File host.ps1" -ForegroundColor White
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = [System.Console]::ReadKey($true)