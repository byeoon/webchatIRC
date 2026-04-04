const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const IRC = require('irc-framework');

const DEFAULT_CONFIG = {
    port: 3000,
    irc: {
        mode: 'centralized',
        host: 'irc.libera.chat',
        port: 6697,
        tls: true,
        channel: '#webchatirc-general'
    },
    guestbook: {
        enabled: true,
        maxEntries: 200
    }
};

/**
 * Create and start a webchatIRC server.
 * @param {object} [userConfig] - Configuration object (merged over defaults)
 * @returns {{ app, server, io }} Express app, HTTP server, and Socket.IO instance
 */
function createServer(userConfig) {
    const config = {
        ...DEFAULT_CONFIG,
        ...userConfig,
        irc: { ...DEFAULT_CONFIG.irc, ...(userConfig && userConfig.irc) },
        guestbook: { ...DEFAULT_CONFIG.guestbook, ...(userConfig && userConfig.guestbook) }
    };

    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);

    const port = config.port || 3000;
    const ircConfig = config.irc;
    const domainMap = {};

    // persistence
    const guestbookPath = path.join(process.cwd(), 'guestbook.json');
    let guestbookEntries = [];
    if (config.guestbook.enabled) {
        try {
            guestbookEntries = JSON.parse(fs.readFileSync(guestbookPath, 'utf-8'));
            console.log(`[webchatIRC] Loaded ${guestbookEntries.length} guestbook entries`);
        } catch (err) {
            guestbookEntries = [];
        }
    }

    function saveGuestbook() {
        try {
            fs.writeFileSync(guestbookPath, JSON.stringify(guestbookEntries, null, 2), 'utf-8');
        } catch (err) {
            console.error('[webchatIRC] Failed to save guestbook:', err.message);
        }
    }

    function populateWHOIS(irc, channel, socket) {
        irc.raw('NAMES', channel);
        irc.once('userlist', (event) => {
            if (!event.users) return;
            socket.emit('server_info', {
                server: ircConfig.host,
                userCount: event.users.length
            });
            event.users.forEach((user) => {
                const nick = user.nick;
                if (nick === irc.user.nick) return;
                irc.whois(nick, (info) => {
                    domainMap[nick] = info.real_name || 'Unknown';
                    socket.emit('whois', { nick, domain: domainMap[nick] });
                });
            });
        });
    }

    function sanitizeUsername(username) {
        if (!username || typeof username !== 'string') return 'Guest';
        const clean = username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
        return clean || 'Guest';
    }

    function sanitizeDomain(domain) {
        if (!domain || typeof domain !== 'string') return 'Unknown';
        const clean = domain.replace(/[^a-zA-Z0-9.\-:]/g, '').slice(0, 64);
        return clean || 'Unknown';
    }

    io.on('connection', (socket) => {
        console.log('[webchatIRC] Client connected');

        socket.on('register', ({ domain, username }) => {
            if (socket.irc) {
                socket.emit('error_msg', 'Already connected.');
                return;
            }

            const cleanUser = sanitizeUsername(username);
            const cleanDomain = sanitizeDomain(domain);
            const nick = `${cleanUser}_${Math.floor(Math.random() * 10000)}`;
            const irc = new IRC.Client();
            irc.userDomain = cleanDomain;

            irc.connect({
                host: ircConfig.host,
                port: ircConfig.port,
                nick: nick,
                username: cleanUser,
                gecos: cleanDomain,
                tls: ircConfig.tls
            });

            irc.on('registered', () => {
                const channel = ircConfig.channel;
                irc.join(channel);
                socket.emit('system', `Connected to IRC as ${nick}`);

                irc.whois(nick, (info) => {
                    domainMap[nick] = info.real_name || cleanDomain;
                });
                populateWHOIS(irc, channel, socket);
            });

            irc.on('message', (event) => {
                if (event.nick === irc.user.nick) return;
                if (!event.nick || !domainMap[event.nick]) return;

                const senderDomain = domainMap[event.nick];
                socket.emit('message', {
                    channel: event.target,
                    nick: event.nick,
                    text: event.message,
                    domain: senderDomain,
                    timestamp: Date.now()
                });
            });

            irc.on('notice', (event) => {
                if (event.message) {
                    socket.emit('system', event.message);
                }
            });

            irc.on('join', (event) => {
                socket.emit('system', `${event.nick} joined ${event.channel}`);
                socket.emit('user_joined');
                if (event.nick === irc.user.nick) return;
                irc.whois(event.nick, (info) => {
                    domainMap[event.nick] = info.real_name || 'Unknown';
                });
            });

            irc.on('part', (event) => {
                socket.emit('system', `${event.nick} left ${event.channel}`);
                socket.emit('user_left');
                delete domainMap[event.nick];
            });

            irc.on('quit', (event) => {
                socket.emit('system', `${event.nick} quit IRC`);
                socket.emit('user_left');
                delete domainMap[event.nick];
            });

            irc.on('error', (event) => {
                console.error('[webchatIRC] IRC error:', event);
                socket.emit('error_msg', `IRC error: ${event.reason || event.message || 'Unknown error'}`);
            });

            irc.on('close', () => {
                socket.emit('system', 'Disconnected from IRC.');
            });

            socket.irc = irc;
        });

        socket.on('chat', (text) => {
            if (!socket.irc) return;
            if (typeof text !== 'string' || !text.trim()) return;

            const cleanText = text.trim().slice(0, 500);
            const channel = ircConfig.channel;

            socket.irc.say(channel, cleanText);
            socket.emit('message', {
                channel: channel,
                nick: socket.irc.user.nick,
                text: cleanText,
                domain: socket.irc.userDomain,
                timestamp: Date.now(),
                self: true
            });
        });

        // Guestbook events
        if (config.guestbook.enabled) {
            socket.on('guestbook:load', () => {
                socket.emit('guestbook:entries', guestbookEntries);
            });

            socket.on('guestbook:sign', ({ name, message }) => {
                if (!name || typeof name !== 'string') return;
                if (!message || typeof message !== 'string') return;

                const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
                const alreadySigned = guestbookEntries.some(e => e.ip === ip);
                if (alreadySigned) {
                    socket.emit('guestbook:error', 'You have already signed the guestbook!');
                    return;
                }

                const entry = {
                    name: name.replace(/[^a-zA-Z0-9_ -]/g, '').slice(0, 32),
                    message: message.trim().slice(0, 200),
                    domain: socket.handshake.headers.origin || 'Unknown',
                    date: new Date().toISOString(),
                    ip: ip
                };

                guestbookEntries.push(entry);
                if (guestbookEntries.length > config.guestbook.maxEntries) {
                    guestbookEntries = guestbookEntries.slice(-config.guestbook.maxEntries);
                }
                saveGuestbook();

                // Broadcast without IP (important!!)
                const publicEntry = { name: entry.name, message: entry.message, domain: entry.domain, date: entry.date };
                io.emit('guestbook:new', publicEntry);
                socket.emit('guestbook:signed');
            });
        }

        socket.on('disconnect', () => {
            if (socket.irc) {
                const nick = socket.irc.user ? socket.irc.user.nick : null;
                socket.irc.quit('webchatIRC Client Disconnected');
                if (nick) delete domainMap[nick];
            }
            console.log('[webchatIRC] Client disconnected');
        });
    });

    app.use(express.static(path.join(__dirname, 'public')));

    server.listen(port, () => {
        console.log(`[webchatIRC] Server running at http://localhost:${port}`);
        console.log(`[webchatIRC] IRC: ${ircConfig.host}:${ircConfig.port} ${ircConfig.channel}`);
    });

    return { app, server, io };
}

module.exports = { createServer };

if (require.main === module) {
    const configPath = path.join(__dirname, 'webchat.config.json');
    let fileConfig = {};
    try {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (err) {
        console.log('[webchatIRC] No webchat.config.json found, using defaults.');
    }
    createServer(fileConfig);
}
