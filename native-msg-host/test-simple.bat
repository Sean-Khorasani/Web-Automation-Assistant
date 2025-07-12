@echo off
REM Simple test script for sending a single command to the native messaging host

if "%~1"=="" (
    echo Usage: test-simple.bat "Your prompt or command"
    echo Example: test-simple.bat "Click the login button"
    echo Example: test-simple.bat "{\"action\":\"list\"}"
    exit /b 1
)

echo Sending command: %~1
echo.

REM Use PowerShell to send TCP message
powershell -NoProfile -Command ^
    "$client = New-Object System.Net.Sockets.TcpClient; ^
    try { ^
        $client.Connect('localhost', 9999); ^
        $stream = $client.GetStream(); ^
        $writer = New-Object System.IO.StreamWriter($stream); ^
        $reader = New-Object System.IO.StreamReader($stream); ^
        $writer.AutoFlush = $true; ^
        $message = '%~1'; ^
        if ($message.StartsWith('{')) { ^
            $writer.WriteLine($message); ^
        } else { ^
            $json = @{action='prompt'; text=$message} | ConvertTo-Json -Compress; ^
            $writer.WriteLine($json); ^
        } ^
        $response = $reader.ReadLine(); ^
        Write-Host 'Response:' -ForegroundColor Green; ^
        Write-Host $response; ^
        try { ^
            $responseObj = $response | ConvertFrom-Json; ^
            $responseObj | ConvertTo-Json -Depth 10 | Write-Host; ^
        } catch {} ^
        $writer.Close(); ^
        $reader.Close(); ^
        $stream.Close(); ^
        $client.Close(); ^
    } catch { ^
        Write-Host 'Error: Could not connect to native messaging host' -ForegroundColor Red; ^
        Write-Host 'Make sure the browser extension is running or start host.ps1 manually' -ForegroundColor Yellow; ^
    }"

echo.
pause