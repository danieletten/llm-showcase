# LLM Token Confidence Visualizer (MVP)

Interactieve demo geïnspireerd op [llmviz](https://sanand0.github.io/llmviz/). Toont
hoe een LLM tekst token-voor-token genereert, met per token de probability en
de top-5 alternatieven.

## Lokaal draaien

```bash
npm install
cp .env.example .env.local   # vul OPENAI_API_KEY in (optioneel)
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
