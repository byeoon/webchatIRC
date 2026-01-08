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
        const safeDomain = domain.replace(/\./g, '_');
        const nick = `${username}_${safeDomain}`.slice(0, 30);
        const irc = new IRC.Client();

        domainMap[nick] = domain;

        socket.domain = domain;
        irc.userDomain = domain;

        irc.connect({
            host: 'irc.libera.chat',
            port: 6697,
            nick,
            user: nick,
            gecos: `From ${domain}`,
            tls: true
        });

        irc.on('registered', () => {
            irc.join('#webchatirc-general');
            socket.emit('system', `Connected to IRC as ${nick}`);
        });

        irc.on('message', (event) => {
            const senderDomain = domainMap[event.nick] || 'Unknown';
            socket.emit('message', {
                channel: event.target,
                nick: event.nick,
                text: event.message,
                domain: senderDomain
            });
        });

        irc.on('join', (event) => {
            socket.emit('system', `${event.nick} joined ${event.channel}`);
        });

        irc.on('part', (event) => {
            socket.emit('system', `${event.nick} left ${event.channel}`);
        });

        irc.on('quit', (event) => {
            socket.emit('system', `${event.nick} quit IRC`);
            delete domainMap[event.nick]; // clean up domain map
        });

        socket.irc = irc;
    });

    socket.on('chat', (text) => {
        if (!socket.irc) return;
        socket.irc.say('#webchatirc-general', text);
         const domain = domainMap[socket.irc.user.nick] || 'Unknown';

        // echo! echo! echo!
        socket.emit('message', {
        channel: '#webchatirc-general',
        nick: socket.irc.user.nick,
        text,
        domain
    });
    });

    socket.on('disconnect', () => {
        if (socket.irc) {
            socket.irc.quit('webchatIRC Client Disconnected | https://github.com/byeoon/webchatIRC');
             delete domainMap[socket.irc.user.nick];
        }
        console.log('[webchatIRC Console] Client Disconnected ');
    });
});

// Static site
app.use(express.static(path.join(__dirname, 'public')));

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
