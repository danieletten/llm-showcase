# LLM Token Confidence Visualizer (MVP)

Interactieve demo geïnspireerd op [llmviz](https://sanand0.github.io/llmviz/). Toont
hoe een LLM tekst token-voor-token genereert, met per token de probability en
de top-5 alternatieven.

## Lokaal draaien

```bash
npm install
cp .env.example .env   # vul AZURE_OPENAI_* in (optioneel)
npm run dev
```

Open http://localhost:3000.

Zonder Azure OpenAI credentials draait de app in **mock-modus**: de API endpoint geeft een
deterministische demo-respons terug, zodat de UI getest kan worden zonder kosten.

## Environment variables

Alle variabelen zijn server-side; ze worden nooit naar de client gestuurd.

| Naam                        | Verplicht | Beschrijving                                                            |
| --------------------------- | --------- | ----------------------------------------------------------------------- |
| `AZURE_OPENAI_ENDPOINT`     | nee\*     | Bv. `https://my-aoai.openai.azure.com`.                                 |
| `AZURE_OPENAI_API_KEY`      | nee\*     | API key van de Azure OpenAI resource.                                   |
| `AZURE_OPENAI_DEPLOYMENT`   | nee       | *Deployment*-naam (niet de modelnaam). Default: `gpt-4o-mini`.          |
| `AZURE_OPENAI_API_VERSION`  | nee       | Min. `2024-06-01` voor logprobs. Default: `2024-10-21`.                 |

\* Endpoint én key zijn samen verplicht voor echte LLM-output. Ontbreekt één van beide,
dan draait de app op mock-data.

## API

`POST /api/generate-token-confidence`

Request:
```json
{ "prompt": "string", "temperature": 0.7 }
```

Response:
```json
{
  "text": "…",
  "tokens": [
    {
      "token": "Hello",
      "logprob": -0.1,
      "probability": 0.905,
      "topAlternatives": [
        { "token": "Hi", "logprob": -1.2, "probability": 0.30 }
      ]
    }
  ]
}
```

## Beperkingen / aannames

- Gebruikt **Azure OpenAI Chat Completions** met `logprobs: true` en `top_logprobs: 5`.
  Vereist API-versie `2024-06-01` of nieuwer; het gekozen *deployment* moet een
  model serveren dat logprobs ondersteunt (bv. `gpt-4o-mini`, `gpt-4o`).
- Authenticatie via API key. Wil je liever Microsoft Entra (managed identity /
  `DefaultAzureCredential`), dan kan dat met dezelfde `AzureOpenAI` client door
  `apiKey` te vervangen door een `azureADTokenProvider` — eenvoudige uitbreiding.
- Geen streaming — het volledige antwoord wordt in één keer opgehaald en daarna
  token-voor-token gerenderd.
- Geen persistente opslag, auth of analytics (MVP-scope).
- De `TokenVisualizer`-component is bewust losgekoppeld van de API zodat hij
  later in een AI exam-trainer of leermodule kan worden hergebruikt — geef hem
  enkel een `TokenInfo[]` mee.

## Op Azure draaien (App Service, voor test/demo)

Deze sectie beschrijft een **simpele test-hosting** op Azure App Service Linux
met Node 20. Geen production-hardening (geen custom domain, geen WAF, geen
staging slot, geen managed identity richting Azure OpenAI — die staat hieronder
als optionele vervolgstap).

### Vereisten

- Een actieve Azure subscription en `az` CLI ingelogd (`az login`).
- Een bestaande Azure OpenAI resource met een deployment van een model dat
  logprobs ondersteunt (bv. `gpt-4o-mini`).
- Node.js 20+ lokaal (voor de build) — App Service draait dezelfde major versie.

### 1. Resources aanmaken

```bash
# Pas naam + regio aan; webapp-namen zijn globaal uniek.
RG=rg-llm-showcase
LOC=westeurope
PLAN=asp-llm-showcase
APP=llm-showcase-$RANDOM

az group create -n $RG -l $LOC

# B1 = goedkope basic SKU, prima voor demo's. Free (F1) kan ook maar heeft
# strakke CPU/geheugen limieten en geen always-on.
az appservice plan create -g $RG -n $PLAN --sku B1 --is-linux

az webapp create -g $RG -p $PLAN -n $APP --runtime "NODE:20-lts"
```

### 2. App settings (secrets + runtime config)

```bash
az webapp config appsettings set -g $RG -n $APP --settings \
  AZURE_OPENAI_ENDPOINT="https://<jouw-aoai>.openai.azure.com" \
  AZURE_OPENAI_API_KEY="<jouw-key>" \
  AZURE_OPENAI_DEPLOYMENT="gpt-4o-mini" \
  AZURE_OPENAI_API_VERSION="2024-10-21" \
  WEBSITE_NODE_DEFAULT_VERSION="~20" \
  SCM_DO_BUILD_DURING_DEPLOYMENT="true" \
  NODE_ENV="production"

# Next.js leest PORT uit de omgeving; App Service zet die voor je.
az webapp config set -g $RG -n $APP --startup-file "npm run start"
```

> App settings worden door App Service als environment variables in het
> Node-proces gezet. Ze zijn server-side; ze komen niet bij de browser.

### 3. Code deployen

De simpelste route is een zip-deploy van de repo (zonder `node_modules` en
`.next`); Oryx draait `npm install` en `npm run build` op de App Service.

```bash
# Maak een schone zip — geen node_modules, geen build-output, geen .env.
zip -r app.zip . \
  -x "node_modules/*" ".next/*" ".git/*" ".env" "*.tsbuildinfo"

az webapp deploy -g $RG -n $APP --src-path app.zip --type zip
```

Na de eerste deploy duurt het 1–3 minuten voor Oryx klaar is met `npm install`
en `next build`. Daarna:

```bash
az webapp browse -g $RG -n $APP
```

of open `https://$APP.azurewebsites.net` in je browser.

### 4. Logs en troubleshooting

```bash
# Live log streaming (stdout + stderr van het Node-proces).
az webapp log tail -g $RG -n $APP
```

Nuttige checks bij een lege of stuk werkende site:

- **App settings staan aan**: `az webapp config appsettings list -g $RG -n $APP -o table`
- **Startup command klopt**: `az webapp config show -g $RG -n $APP --query "appCommandLine"` moet `npm run start` teruggeven.
- **Logprobs werken**: roep `https://$APP.azurewebsites.net/api/generate-token-confidence` aan met een kleine `POST {"prompt":"hi","temperature":0.2}`. De response heeft `tokens[]` met `logprob`-velden zodra de Azure OpenAI call slaagt.
- In `NODE_ENV=production` valt de API **niet** stilletjes terug op mock-data bij een LLM-fout — die geeft dan een 500 met `error` veld. Dat is bewust gedrag.

### 5. Opruimen

```bash
az group delete -n $RG --yes --no-wait
```

Dit verwijdert het App Service plan en de webapp, niet je Azure OpenAI resource
(die staat normaal in een andere resource group).

### Optioneel: managed identity i.p.v. API key

Voor een nettere setup zonder key in app settings:

1. Zet systeem-toegewezen identity aan: `az webapp identity assign -g $RG -n $APP`.
2. Geef die identity de rol **Cognitive Services OpenAI User** op je Azure
   OpenAI resource.
3. Vervang in [app/api/generate-token-confidence/route.ts](app/api/generate-token-confidence/route.ts) de `apiKey`-optie
   van de `AzureOpenAI` client door een `azureADTokenProvider` op basis van
   `DefaultAzureCredential` (uit `@azure/identity`). Verwijder daarna
   `AZURE_OPENAI_API_KEY` uit de app settings.

Dit is bewust niet de default in deze demo — een API key is sneller op te
zetten voor een eerste test.
