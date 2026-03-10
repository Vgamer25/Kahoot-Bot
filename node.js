const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Kahoot = require('kahoot.js-updated');
const cors = require('cors');
const { init } = require("@heyputer/puter.js/src/init.cjs");

// Initialize Puter.js
// Note: In a production environment, you would use process.env.PUTER_AUTH_TOKEN
const puter = init(process.env.PUTER_AUTH_TOKEN || "");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

io.on('connection', (socket) => {
    let client = new Kahoot();
    console.log('Client connected to controller');

    socket.on('join_game', async ({ pin, name }) => {
        try {
            console.log(`Joining ${pin} as ${name}`);
            await client.join(pin, name);
            socket.emit('status', { msg: 'Joined successfully!', type: 'success' });
            
            // Log interaction to Puter (Example of using Puter.js)
            try {
                puter.print(`Bot ${name} joined game ${pin}`);
            } catch (e) {
                // Puter log failed (likely missing token), continue silently
            }
        } catch (err) {
            socket.emit('status', { msg: `Join failed: ${err.description || 'Unknown error'}`, type: 'error' });
        }
    });

    // Handle normal questions and "minigames" (Jumbles, etc.)
    client.on("QuestionStart", (question) => {
        socket.emit('event', { msg: `Question ${question.index + 1} started!`, type: 'info' });
        
        // Auto-answer logic (Wait 2-4 seconds to look human)
        setTimeout(() => {
            if (question.type === "quiz") {
                // Multiple choice
                question.answer(Math.floor(Math.random() * question.quizQuestionAnswers[question.questionIndex]));
            } else if (question.type === "jumble") {
                // Minigame: Jumble (reorder 0,1,2,3)
                question.answer([0, 1, 2, 3]);
            } else {
                // Other types like True/False
                question.answer(0);
            }
            socket.emit('event', { msg: `Answered question ${question.index + 1}`, type: 'success' });
        }, 3000);
    });

    client.on("QuizEnd", () => {
        socket.emit('status', { msg: 'Quiz ended!', type: 'info' });
    });

    socket.on('disconnect', () => {
        try { client.leave(); } catch(e) {}
        console.log('Controller disconnected');
    });
});

server.listen(3000, () => {
    console.log('Backend running on http://localhost:3000');
});
