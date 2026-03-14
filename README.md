# webchat-IRC

Bring back the classic web to your website. 

## Setup

### Prerequisites
- Node.js installed on your system

### 1. Installation
Clone the repository and install the required dependencies:

```bash
git clone https://github.com/byeoon/webchat-irc.git
cd webchat-irc
npm install
```

### 2. Configuration
The server's configuration is stored in `config.json`. By default, it connects to the `#webchatirc-general` channel on `irc.libera.chat`. You can adjust the web server port and the IRC connection details to your preferences.

```json
{
  "port": 3000,
  "irc": {
    "mode": "centralized",
    "host": "irc.libera.chat",
    "port": 6697,
    "tls": true,
    "channel": "#webchatirc-general"
  }
}
```

### 3. Run the server
Start the application using Node:

```bash
node index.js
```

### 4. Access the Webchat
Open your web browser and navigate to `http://localhost:3000` (or whichever port you specified in the `config.json`). You can start chatting immediately!