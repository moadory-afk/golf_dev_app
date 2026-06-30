# recognize-scorecard Edge Function

This function backs the app's scorecard OCR call:

```ts
supabase.functions.invoke('recognize-scorecard', ...)
```

It includes browser CORS handling for the web app and KakaoTalk in-app browser.

## Deploy

Set the Anthropic key as a Supabase secret:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Optionally set a model:

```bash
supabase secrets set ANTHROPIC_MODEL=claude-sonnet-4-6
```

Deploy the function:

```bash
supabase functions deploy recognize-scorecard
```
