# Mikrotik Hotspot Template — CLAUDE.md

## Project Overview

Hotspot template untuk MikroTik RouterOS, dibuild pake **Tailwind CSS v3** + custom template engine. Nama package: `hotspot_template_by_zen`.

Output static HTML/CSS/JS — tinggal copy ke `/hotspot/` di MikroTik.

## Tech Stack

- **Runtime:** Bun (npm juga support)
- **Styling:** Tailwind CSS 3
- **Linting/Formatting:** Biome (sesuai `biome.json`)
- **Module:** ESM (`"type": "module"`)
- **JS Minifier:** UglifyJS
- **HTML Minifier:** html-minifier-terser

## Project Structure

```
mikrotik_hotspot/
├── src/                    # Source files
│   ├── *.html             # Halaman hotspot (login, status, error, dll)
│   ├── css/
│   │   ├── input.css      # Tailwind input
│   │   └── style.css      # Compiled Tailwind (dev)
│   ├── js/
│   │   ├── app.js         # Main app logic
│   │   └── md5.js         # MD5 for CHAP auth
│   ├── partials/          # Partial HTML (@include target)
│   │   ├── logo.html
│   │   ├── price.html
│   │   └── login/         # Login form variants
│   ├── qrcode/            # QR code scanner feature
│   ├── xml/               # XML versions hotspot pages
│   ├── api.json           # API endpoint fallback
│   └── errors.txt         # Error messages by language
├── config.json            # All content/feature config (theme, text, price)
├── config.json.zen        # Personal config variant
├── config.json.arnet      # Personal config variant
├── build.js               # Build pipeline
├── dev.js                 # Dev server (BrowserSync)
├── scripts/               # Utility scripts (genconfig)
├── results/               # Build output (gitignored)
└── CLAUDE.md              # This file
```

## Custom Template Directives

All directives diproses di **build time** (`build.js`) dan **dev server middleware** (`dev.js`).

### @config('path.to.key')
Inject value dari `config.json`.
```html
<title>@config('login.meta.title')</title>
```

### @if / @elseif / @else / @endif
Conditional rendering. Support operator: `==`, `!=`, `>`, `<`, `&&`, `||`, `!`.
```html
@if(config.simple == true)
  @include('partials/login/simple.html')
@else
  @include('partials/login/with_credential.html')
@endif
```

### @foreach / @endforeach
Loop array dari config.
```html
@foreach(config.price_lists as item)
  <p>{{item.title}} — {{item.price}}</p>
@endforeach
@foreach(config.price_lists as key => item)
  <p>#{{key}}: {{item.title}} — {{item.price}}</p>
@endforeach
```

### @include('path/to/file.html')
Include partial file (path relative ke file yg nginclude).
```html
@include('partials/logo.html')
```

## Config (`config.json`)

Semua konten, teks, toggle fitur ada di sini. Pages yg dikonfigurasi:

- `login` — Halaman login utama
- `status` — Halaman status sesi aktif
- `logout` — Halaman logout sukses
- `error` — Halaman error sistem
- `flogin` — Halaman login gagal
- `flogout` — Halaman logout gagal (ga ada sesi)
- `fstatus` — Halaman status gagal (need login)
- `rlogin` — Redirect ke login
- `rstatus` — Redirect ke status (sudah login)
- `radvert` — Halaman iklan sponsor
- `alogin` — Halaman after-login
- `trials` — Halaman trial/gratisan
- `qrcode` — QR code scanner pages & notif
- `theme` — Nama tema Tailwind
- `simple` — Toggle login form simple vs credential
- `price` / `price_lists` — Toggle & list harga
- `errors_lang` — `"id"` atau `"en"`

## Dev Workflow

```bash
bun install              # Install deps
bun genconfig            # Generate config.json (first time)
bun dev                  # Dev server :3000 + BrowserSync + Tailwind watch
bun run build            # Build ke results/
```

Dev server (`bun dev`) pake BrowserSync dengan custom middleware yg proses `@include`, `@if`, `@foreach` directives live.

## Build Output

`bun run build`:

1. Clean `results/`
2. Build Tailwind → minify → hash (`style.{hash}.css`)
3. Minify JS files → hash (`app.{hash}.js`)
4. Proses semua HTML: config → foreach → if → include → minify
5. Copy assets lain (favicon, dll)
6. Generate `errors.txt` sesuai `errors_lang`

Hasilnya di `results/` — tinggal copy ke folder `/hotspot/` MikroTik.

## Code Quality (sebelum selesai)

- `tsc --noEmit` — skip, ini JS project (ga pake TS)
- `npx biome check --write .` — lint & format sesuai biome config
  - indent: 2 spaces
  - quotes: single (JS), double (JSX)
  - trailing commas: es5

## Important Notes for Claude

- **JANGAN ubah** `$(...)` syntax — itu MikroTik native variable, bukan template directive.
- File `.html` di `src/xml/` adalah versi XML, jangan diinclude partial HTML biasa.
- `config.json` dibaca di runtime (dev) & build time — setelah ubah config, reload browser (dev) atau rebuild.
- Fitur QR code ada di `src/qrcode/` — file terpisah, ga melalui pipeline directive biasa.
