const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const IRC = require('irc-framework');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 3000;

const domainMap = {};
io.on('connection', (socket) => {
    console.log('[webchatIRC Console] Client connected');

    socket.on('register', ({ domain, username }) => {
        const nick = `${username}_${Math.floor(Math.random() * 10000)}`;
        const irc = new IRC.Client();
        irc.userDomain = domain;

        irc.connect({
            host: 'irc.libera.chat',
            port: 6697,
            nick: nick,
            username: `${username}_wcIRC`, // ?? 9 char limit we r cooked
            gecos: `${domain}`,
            tls: true
        });

        irc.on('registered', () => {
            irc.join('#webchatirc-general');
            socket.emit('system', `Connected to IRC as ${nick}`);
            irc.whois(nick, (info) => {
                domainMap[nick] = info.real_name;
                console.log(domainMap);
                socket.emit('whois', info);
            });
        });

        irc.on('message', (event) => {
            const senderDomain = domainMap[event.nick] || 'Unknown';
            console.log(domainMap[event.nick])
            socket.emit('message', {
                channel: event.target,
                nick: event.nick,
                text: event.message,
                domain: senderDomain
            });
        });

        irc.on('join', (event) => {
            socket.emit('system', `${event.nick} joined ${event.channel}`);
            if (event.nick === irc.user.nick) return;
            irc.whois(event.nick, (info) => {
                domainMap[event.nick] = info.real_name || 'Unknown';
            });
        });
        irc.on('part', (event) => { socket.emit('system', `${event.nick} left ${event.channel}`); });
        irc.on('quit', (event) => { socket.emit('system', `${event.nick} quit IRC`); });
        socket.irc = irc;
    });

    socket.on('chat', (text) => {
        if (!socket.irc) return;
        socket.irc.say('#webchatirc-general', text);

        // echo! echo! echo!
        socket.emit('message', {
            channel: '#webchatirc-general',
            nick: socket.irc.user.nick,
            text,
            domain: socket.irc.userDomain
        });
    });

    socket.on('disconnect', () => {
        if (socket.irc) {
            socket.irc.quit('webchatIRC Client Disconnected');
        }
        console.log('[webchatIRC Console] Client Disconnected ');
    });

  function populateWHOIS(irc, channel, socket) {
    irc.names(channel, (nicks) => {
        Object.keys(nicks).forEach((existingNick) => {
            if (existingNick === irc.user.nick) return;
            irc.whois(existingNick, (info) => {
                domainMap[existingNick] = info.real_name || "???";
                socket.emit('whois', {
                    nick: existingNick,
                    domain: domainMap[existingNick]
                });
            });
        });
    });
    }
});

// Static site
app.use(express.static(path.join(__dirname, 'public')));

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
