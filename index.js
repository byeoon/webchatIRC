const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const IRC = require('irc-framework');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 3000;

io.on('connection', (socket) => {
    console.log('[webchatIRC Console] Client connected');

    socket.on('register', ({ domain, username }) => {
        const safeDomain = domain.replace(/\./g, '_');
        const nick = `${username}_${safeDomain}`.slice(0, 30);
        const irc = new IRC.Client();
        
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
            socket.emit('message', {
                channel: event.target,
                nick: event.nick,
                text: event.message,
                domain: irc.userDomain
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
        });

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
        domain: socket.domain
    });
    });

    socket.on('disconnect', () => {
        if (socket.irc) {
            socket.irc.quit('webchatIRC Client Disconnected | https://github.com/byeoon/webchatIRC');
        }
        console.log('[webchatIRC Console] Client Disconnected ');
    });
});

// Static site
app.use(express.static(path.join(__dirname, 'public')));

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
