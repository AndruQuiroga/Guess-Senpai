param(
    [Parameter(Mandatory = $true)][string]$ImageTag,
    [string]$RepositoryReference = 'refs/heads/codex/deploy-portainer',
    [string]$Url = 'http://portainer.stache.lan'
)
$ErrorActionPreference = 'Stop'
$headers = @{}
function Api([string]$Method, [string]$Path, $Body = $null) {
    $request = @{Method = $Method; Uri = "$Url/api$Path"; Headers = $headers; TimeoutSec = 180}
    if ($null -ne $Body) {
        $request.ContentType = 'application/json'
        $request.Body = $Body | ConvertTo-Json -Depth 12 -Compress
    }
    Invoke-RestMethod @request
}
try {
    $secure = Import-Clixml -LiteralPath 'C:/Users/Dreski-PC/.stache-infra/portainer-session.clixml'
    $credential = [PSCredential]::new('session', $secure)
    $headers.Authorization = 'Bearer ' + $credential.GetNetworkCredential().Password
    $info = Api GET '/endpoints/1/docker/info'
    $expected = ssh -o BatchMode=yes -o ConnectTimeout=10 stache-docker-1 'docker info --format {{.Swarm.Cluster.ID}}'
    if ($LASTEXITCODE -ne 0 -or $expected.Trim() -ne $info.Swarm.Cluster.ID) {
        throw 'Portainer does not match the trusted Stache Swarm'
    }
    $stacks = @(Api GET '/stacks')
    if ($stacks | Where-Object { $_.Name -eq 'guesssenpai' }) {
        throw 'GuessSenpai already exists. Use its Portainer Git redeploy path, preserving Env.'
    }
    $services = @(Api GET '/endpoints/1/docker/services')
    if ($services | Where-Object { $_.Spec.Labels.'com.docker.stack.namespace' -eq 'guesssenpai' }) {
        throw 'An external GuessSenpai stack exists; refusing to create competing services'
    }
    $envPath = Join-Path (Split-Path $PSScriptRoot) '.env'
    $oauth = @{}
    foreach ($line in Get-Content -LiteralPath $envPath) {
        if ($line -match '^(ANILIST_CLIENT_ID|ANILIST_CLIENT_SECRET)=(.*)$') {
            $oauth[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
        }
    }
    foreach ($key in @('ANILIST_CLIENT_ID', 'ANILIST_CLIENT_SECRET')) {
        if (-not $oauth[$key] -or $oauth[$key] -match '^your-') {
            throw "Configure $key in the ignored local .env file before deploying"
        }
    }
    $password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
    $session = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)).ToLowerInvariant()
    $secretValues = @{
        guesssenpai_postgres_password_v1 = $password
        guesssenpai_database_url_v1 = "postgresql+asyncpg://guesssenpai:$password@guesssenpai_postgres:5432/guesssenpai"
        guesssenpai_session_secret_v1 = $session
        guesssenpai_anilist_client_id_v1 = $oauth.ANILIST_CLIENT_ID
        guesssenpai_anilist_client_secret_v1 = $oauth.ANILIST_CLIENT_SECRET
    }
    $existingSecrets = @(Api GET '/endpoints/1/docker/secrets')
    $ours = @($existingSecrets | Where-Object { $_.Spec.Name -in $secretValues.Keys })
    if ($ours.Count -ne 0 -and $ours.Count -ne $secretValues.Count) {
        throw 'Partial GuessSenpai secrets exist; reconcile before deployment'
    }
    if ($ours.Count -eq 0) {
        foreach ($name in $secretValues.Keys) {
            $null = Api POST '/endpoints/1/docker/secrets/create' @{
                Name = $name
                Labels = @{application = 'guesssenpai'}
                Data = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($secretValues[$name]))
            }
            Write-Output "Created Docker secret $name"
        }
    }
    $result = Api POST '/stacks/create/swarm/repository?endpointId=1' @{
        Name = 'guesssenpai'
        SwarmID = $info.Swarm.Cluster.ID
        RepositoryURL = 'https://github.com/AndruQuiroga/Guess-Senpai'
        RepositoryReferenceName = $RepositoryReference
        ComposeFile = 'infra/stack.yml'
        RepositoryAuthentication = $false
        Registries = @(1)
        Env = @(@{name = 'IMAGE_TAG'; value = $ImageTag})
    }
    $stored = Api GET "/stacks/$($result.Id)/file"
    if (-not $stored.StackFileContent -or -not $result.GitConfig) {
        throw 'Portainer did not return the expected Git-managed stack definition'
    }
    [pscustomobject]@{StackId = $result.Id; Name = $result.Name; EndpointId = $result.EndpointId; GitManaged = $true; ImageTag = $ImageTag} | ConvertTo-Json -Compress
} finally {
    $headers.Clear()
    $secretValues = $null; $oauth = $null; $password = $null; $session = $null; $credential = $null; $secure = $null
}
