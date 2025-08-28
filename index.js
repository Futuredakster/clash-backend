const express = require("express");
const app = express();
const cors = require('cors');
const path = require('path');
const socketIo = require('socket.io');
const http = require('http');
const { setupSocket } = require('./socket/socketHandler');


app.use(cors());
app.use((req, res, next) => {
  if (req.originalUrl === "/cart/webhook") return next();
  express.json()(req, res, next);
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const db = require("./models");

const tokenRoutes = require('./routes/tokens');
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });
const postRouter= require("./routes/tournaments");
app.use("/tournaments",postRouter );

const usersRouter= require("./routes/users");
app.use("/users",usersRouter );

const accountsRouter= require("./routes/accounts");
app.use("/accounts",accountsRouter );

const divisionRouter = require("./routes/divisions");
app.use("/divisions",divisionRouter);

const participantRouter = require("./routes/participants");
app.use("/participants",participantRouter);

const bracketRouter = require("./routes/brackets");
app.use("/brackets",bracketRouter);

app.use('/api/stream/tokens', tokenRoutes);
const recordingsRouter = require("./routes/recordings");
app.use("/recordings", recordingsRouter);

const parentRouter = require("./routes/parent");
app.use("/parents", parentRouter);

const cartRouter = require("./routes/cart");
app.use("/cart", cartRouter);

const matsRouter = require("./routes/mats");
app.use("/mats", matsRouter);

setupSocket(io);





db.sequelize.sync().then(() => {
  server.listen(3001, () => { // <--- Change app.listen to server.listen
    console.log("Server running on port 3001");
  });
});
// So every time the serve starts we read through the models folder and make sure
// we have every table in the folder and if not we make them in the database.