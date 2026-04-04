# webchat-IRC

Bring back the classic web to your website.

## Quick Start

```bash
npm install webchat-irc
```

Copy the example config into your project directory:

```bash
cp node_modules/webchat-irc/webchat.config.example.json webchat.config.json
```

Edit `webchat.config.json` with your IRC server details, then start the server:

```bash
npx webchat-irc
```

Open `http://localhost:3000` to see the results!

## Configuration

Create a `webchat.config.json` in your project root:

```json
{
  "port": 3000,
  "irc": {
    "host": "irc.libera.chat",
    "port": 6697,
    "tls": true,
    "channel": "#your-channel"
  },
  "guestbook": {
    "enabled": true,
    "maxEntries": 200
  }
}
```

| Option | Default | Description |
|---|---|---|
| `port` | `3000` | HTTP server port |
| `irc.host` | `irc.libera.chat` | IRC server hostname |
| `irc.port` | `6697` | IRC server port |
| `irc.tls` | `true` | Use TLS/SSL |
| `irc.channel` | `#webchatirc-general` | IRC channel to join |
| `guestbook.enabled` | `true` | Enable/disable the guestbook feature |
| `guestbook.maxEntries` | `200` | Maximum stored guestbook entries |

## Embedding on Your Website

Once the server is running, embed the widget on any page using an iframe:

```html
<iframe
  src="https://your-server.com/embed.html"
  width="400"
  height="500"
  frameborder="0"
  style="border-radius: 6px; border: 1px solid #333;">
</iframe>
```

The `/embed.html` widget includes tabbed panels for **Chat** and **Guestbook** — fully self-contained with no external dependencies.


## Development

Clone and run locally:

```bash
git clone https://github.com/byeoon/webchat-irc.git
cd webchat-irc
npm install
cp webchat.config.example.json webchat.config.json
npm start
```

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/demo.html` | Full demo with navbar |
| `/embed.html` | Embeddable widget (chat + guestbook tabs) |
