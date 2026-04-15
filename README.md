# Azure Web Crawler

Creates an Azure Function that scrapes 10 Wikipedia links and returns the content.

This example is setup as an HTTP trigger for easy debugging but in production you would want to use a timer trigger.

---

## Prerequisites

Make sure that you have the Azure CLI installed:

```bash
$ az --version
```

Otherwise, install it from [here](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli).

And `func` which you can install with [npm](https://www.npmjs.com/package/azure-functions-core-tools):

```bash
$ npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

---

## Setup

Storage account names must be globally unique. If you get an error when creating the storage account, try a different name.

```bash
az group create --name web-crawler-rg --location westeurope

az storage account create --name webcrawlerstorage12 --location westeurope --resource-group web-crawler-rg --sku Standard_LRS

az functionapp create --resource-group web-crawler-rg --consumption-plan-location westeurope --runtime node --runtime-version 20 --functions-version 4 --name web-crawler-func-app --storage-account webcrawlerstorage12 --os-type Linux
```

---

## Initialize

### This step is if you want to create a function from scratch. If you want to run the code then skip to deploy.

```bash
$ func init web-crawler-func-app --javascript
$ cd web-crawler-func-app
$ func new --name web-crawler-func-app --template "HTTP trigger"
```

Create a `functions.json` in `web-crawler-func-app/src/functions` with this content:

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get", "post"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

Install any dependency you might need to use. Example:

```bash
$ npm install jsdom
```

---

## Deploy

If you've cloned the repository then remember to install the dependencies. This will take a while because the binary is large:

```bash
$ npm install
```

Before you deploy you can always test it locally. Make sure to be inside of the function app folder for instance `web-crawler-func-app` in this project:

```bash
$ func start
```

Make sure to run from within the `web-crawler-func-app` folder which is where `host.json` is located.

Once you confirm that it works, you can deploy it to Azure Functions:

```bash
$ func azure functionapp publish web-crawler-func-app
```

---

##  Clean up

```bash
$ az group delete --name web-crawler-rg --yes --no-wait
```
