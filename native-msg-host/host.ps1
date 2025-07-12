# Native Messaging Host for Web Recorder Extension
# This script acts as a bridge between the browser extension and external applications
# It listens on TCP port 9999 and forwards messages through native messaging protocol

param()

# Configure error handling
$ErrorActionPreference = "Stop"
$script:Debug = $true

# Function to write debug logs
function Write-DebugLog {
    param([string]$Message)
    if ($script:Debug) {
        Add-Content -Path "host-debug.log" -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'): $Message"
    }
}

# Function to read a message from stdin (from browser)
function Read-NativeMessage {
    try {
        # Read 4-byte length prefix
        $lengthBytes = New-Object byte[] 4
        $bytesRead = [System.Console]::OpenStandardInput().Read($lengthBytes, 0, 4)
        
        if ($bytesRead -ne 4) {
            Write-DebugLog "Failed to read length prefix. Bytes read: $bytesRead"
            return $null
        }
        
        # Convert to integer (little-endian)
        $messageLength = [BitConverter]::ToInt32($lengthBytes, 0)
        Write-DebugLog "Message length: $messageLength"
        
        if ($messageLength -le 0 -or $messageLength -gt 1048576) {  # Max 1MB
            Write-DebugLog "Invalid message length: $messageLength"
            return $null
        }
        
        # Read the message content
        $messageBytes = New-Object byte[] $messageLength
        $totalRead = 0
        
        while ($totalRead -lt $messageLength) {
            $bytesRead = [System.Console]::OpenStandardInput().Read(
                $messageBytes, 
                $totalRead, 
                $messageLength - $totalRead
            )
            
            if ($bytesRead -eq 0) {
                Write-DebugLog "Unexpected end of stream"
                return $null
            }
            
            $totalRead += $bytesRead
        }
        
        # Convert to string and parse JSON
        $messageText = [System.Text.Encoding]::UTF8.GetString($messageBytes)
        Write-DebugLog "Received message: $messageText"
        
        return $messageText | ConvertFrom-Json
    }
    catch {
        Write-DebugLog "Error reading native message: $_"
        return $null
    }
}

# Function to write a message to stdout (to browser)
function Write-NativeMessage {
    param($Message)
    
    try {
        # Convert to JSON
        $json = $Message | ConvertTo-Json -Compress -Depth 10
        $messageBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        
        # Write length prefix (4 bytes, little-endian)
        $lengthBytes = [BitConverter]::GetBytes($messageBytes.Length)
        [System.Console]::OpenStandardOutput().Write($lengthBytes, 0, 4)
        
        # Write message content
        [System.Console]::OpenStandardOutput().Write($messageBytes, 0, $messageBytes.Length)
        [System.Console]::OpenStandardOutput().Flush()
        
        Write-DebugLog "Sent message: $json"
    }
    catch {
        Write-DebugLog "Error writing native message: $_"
    }
}

# Function to handle TCP client connection
function Handle-TcpClient {
    param($Client, $Stream, $MessageQueue)
    
    $reader = New-Object System.IO.StreamReader($Stream)
    $writer = New-Object System.IO.StreamWriter($Stream)
    $writer.AutoFlush = $true
    
    try {
        while ($Client.Connected) {
            # Read line from TCP client
            $line = $reader.ReadLine()
            if ($null -eq $line) { break }
            
            Write-DebugLog "TCP received: $line"
            
            try {
                # Parse the JSON message
                $tcpMessage = $line | ConvertFrom-Json
                
                # Create a unique ID for this request
                $requestId = [Guid]::NewGuid().ToString()
                
                # Forward to browser
                $browserMessage = @{
                    id = $requestId
                    type = "external_request"
                    data = $tcpMessage
                }
                
                # Add to queue with response callback
                $queueItem = @{
                    Message = $browserMessage
                    ResponseCallback = {
                        param($Response)
                        try {
                            $responseJson = $Response | ConvertTo-Json -Compress -Depth 10
                            $writer.WriteLine($responseJson)
                        }
                        catch {
                            Write-DebugLog "Error sending TCP response: $_"
                        }
                    }
                    RequestId = $requestId
                }
                
                $MessageQueue.Enqueue($queueItem)
                
            }
            catch {
                Write-DebugLog "Error processing TCP message: $_"
                $errorResponse = @{
                    error = "Invalid message format"
                    details = $_.ToString()
                } | ConvertTo-Json -Compress
                $writer.WriteLine($errorResponse)
            }
        }
    }
    catch {
        Write-DebugLog "TCP client error: $_"
    }
    finally {
        $reader.Close()
        $writer.Close()
        $Stream.Close()
        $Client.Close()
    }
}

# Main execution
try {
    Write-DebugLog "Native messaging host starting..."
    
    # Create message queue for thread-safe communication
    $messageQueue = [System.Collections.Concurrent.ConcurrentQueue[object]]::new()
    $pendingRequests = @{}
    
    # Start TCP listener in background
    $tcpListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, 9999)
    $tcpListener.Start()
    Write-DebugLog "TCP listener started on port 9999"
    
    # Start TCP accept loop in background runspace
    $tcpRunspace = [RunspaceFactory]::CreateRunspace()
    $tcpRunspace.Open()
    $tcpRunspace.SessionStateProxy.SetVariable("tcpListener", $tcpListener)
    $tcpRunspace.SessionStateProxy.SetVariable("messageQueue", $messageQueue)
    $tcpRunspace.SessionStateProxy.SetVariable("DebugLog", ${function:Write-DebugLog})
    
    $tcpPowerShell = [PowerShell]::Create()
    $tcpPowerShell.Runspace = $tcpRunspace
    
    $tcpScript = {
        param($tcpListener, $messageQueue)
        
        # Redefine Write-DebugLog in this runspace
        function Write-DebugLog {
            param([string]$Message)
            if ($true) {  # Debug is always on in background thread
                Add-Content -Path "host-debug.log" -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'): [TCP] $Message"
            }
        }
        
        Write-DebugLog "TCP accept loop starting"
        
        while ($true) {
            try {
                $client = $tcpListener.AcceptTcpClient()
                Write-DebugLog "TCP client connected"
                
                # Handle each client in a separate runspace
                $clientRunspace = [RunspaceFactory]::CreateRunspace()
                $clientRunspace.Open()
                $clientRunspace.SessionStateProxy.SetVariable("client", $client)
                $clientRunspace.SessionStateProxy.SetVariable("messageQueue", $messageQueue)
                
                $clientPowerShell = [PowerShell]::Create()
                $clientPowerShell.Runspace = $clientRunspace
                
                $clientScript = {
                    param($client, $messageQueue)
                    
                    # Load the Handle-TcpClient function
                    . "$PSScriptRoot\host.ps1"
                    
                    $stream = $client.GetStream()
                    Handle-TcpClient -Client $client -Stream $stream -MessageQueue $messageQueue
                }
                
                $clientPowerShell.AddScript($clientScript).AddArgument($client).AddArgument($messageQueue)
                $clientPowerShell.BeginInvoke() | Out-Null
            }
            catch {
                Write-DebugLog "TCP accept error: $_"
            }
        }
    }
    
    $tcpPowerShell.AddScript($tcpScript).AddArgument($tcpListener).AddArgument($messageQueue)
    $tcpHandle = $tcpPowerShell.BeginInvoke()
    
    Write-DebugLog "Starting main message loop"
    
    # Main message processing loop
    while ($true) {
        # Check for messages from browser
        $message = Read-NativeMessage
        if ($null -ne $message) {
            Write-DebugLog "Processing browser message"
            
            # Handle response to a previous request
            if ($message.id -and $pendingRequests.ContainsKey($message.id)) {
                $request = $pendingRequests[$message.id]
                if ($request.ResponseCallback) {
                    & $request.ResponseCallback $message
                }
                $pendingRequests.Remove($message.id)
            }
            # Handle other message types
            elseif ($message.type -eq "ping") {
                Write-NativeMessage @{ type = "pong"; timestamp = Get-Date -Format "o" }
            }
            elseif ($message.type -eq "status") {
                Write-NativeMessage @{ 
                    type = "status_response"
                    tcp_listening = $true
                    port = 9999
                }
            }
        }
        
        # Check for queued messages to send to browser
        $queueItem = $null
        if ($messageQueue.TryDequeue([ref]$queueItem)) {
            Write-DebugLog "Sending queued message to browser"
            
            # Store pending request for response matching
            if ($queueItem.RequestId) {
                $pendingRequests[$queueItem.RequestId] = $queueItem
            }
            
            Write-NativeMessage $queueItem.Message
        }
        
        # Small delay to prevent CPU spinning
        Start-Sleep -Milliseconds 10
    }
}
catch {
    Write-DebugLog "Fatal error: $_"
    Write-NativeMessage @{ 
        type = "error"
        message = $_.ToString()
    }
}
finally {
    if ($tcpListener) {
        $tcpListener.Stop()
    }
    if ($tcpPowerShell) {
        $tcpPowerShell.Stop()
        $tcpPowerShell.Dispose()
    }
    if ($tcpRunspace) {
        $tcpRunspace.Close()
        $tcpRunspace.Dispose()
    }
}