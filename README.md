# Azure Web Crawler

An Azure Function that automatically indexes missing search results for the WhoKnows search engine.

## How it works

```
User searches "X" → Go server finds 0 results
                           │
                           ▼
                  Azure Storage Queue  ← message: { query: "X", language: "en" }
                           │
                           ▼
              Azure Function (Queue Trigger)
                           │
                  Searches Wikipedia for "X"
                  Scrapes the top article
                           │
                           ▼
              POST /api/pages → Go server → database
```

Next time someone searches for "X", the result is there.

---

## Prerequisites

```bash
az --version          # Azure CLI
func --version        # Azure Functions Core Tools
node --version        # Node.js 20+
```

Install missing tools:
- Azure CLI: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
- Functions Core Tools: `npm install -g azure-functions-core-tools@4 --unsafe-perm true`

---

## Azure Setup

Storage account names must be globally unique.

```bash
# Resource group and storage
az group create --name web-crawler-rg --location westeurope
az storage account create \
  --name webcrawlerstorage12 \
  --location westeurope \
  --resource-group web-crawler-rg \
  --sku Standard_LRS

# Create the queue
az storage queue create \
  --name missed-searches \
  --account-name webcrawlerstorage12

# Function App
az functionapp create \
  --resource-group web-crawler-rg \
  --consumption-plan-location westeurope \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --name whoknows-web-crawler \
  --storage-account webcrawlerstorage12 \
  --os-type Linux
```

---

## Environment Variables

### Go server (legacy-whoknows)

| Variable | Description |
|---|---|
| `AZURE_QUEUE_SAS_URL` | Full SAS URL to the queue `/messages` endpoint. Generate in Azure Portal → Storage Account → Queues → Shared access signature. Needs **Add** permission. |
| `WHOKNOWS_SCRAPER_API_KEY` | Secret key. The Azure Function must send this in `X-Scraper-Key: <key>`. |

### Azure Function

| Variable | Description |
|---|---|
| `AzureWebJobsStorage` | Connection string to the same storage account. |
| `QUEUE_NAME` | Queue name (default: `missed-searches`). |
| `WHOKNOWS_SERVER_URL` | Base URL of the Go server, e.g. `https://huw.dk`. |
| `WHOKNOWS_SCRAPER_API_KEY` | Must match the value set on the Go server. |

Set Function App settings:
```bash
az functionapp config appsettings set \
  --name whoknows-web-crawler \
  --resource-group web-crawler-rg \
  --settings \
    WHOKNOWS_SERVER_URL="https://huw.dk" \
    WHOKNOWS_SCRAPER_API_KEY="<your-secret-key>"
```

---

## Local Development

```bash
cd whoknows-web-crawler
npm install
```

Edit `local.settings.json` with real values (already gitignored).

For `AzureWebJobsStorage` locally you can use [Azurite](https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite):
```bash
npm install -g azurite
azurite --silent --location /tmp/azurite
```

Then start the function:
```bash
func start
```

---

## Deploy

```bash
cd whoknows-web-crawler
npm install
func azure functionapp publish whoknows-web-crawler
```

---

## PostgreSQL migration note

The Azure Function only talks to the Go server via `POST /api/pages`. It has no direct database connection. When the Go server migrates from SQLite to PostgreSQL, the Azure Function requires **no changes**.

The only adjustment in the Go server's `db/pages.go`:
- SQLite: `ON CONFLICT(title) DO NOTHING` ✓ (already used)
- PostgreSQL: `ON CONFLICT(title) DO NOTHING` ✓ (same syntax)

The placeholder `?` in queries must be changed to `$1, $2, ...` for PostgreSQL — but that is a general migration concern for the whole codebase, not specific to this integration.

---

## Clean up

```bash
az group delete --name web-crawler-rg --yes --no-wait
```
