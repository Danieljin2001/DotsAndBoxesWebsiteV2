

let ROWS = 3;   //number of row of squares
let COLS = 3;   //number of columns of squares


const http = require("http");

const express = require("express");
const app = express(); //serves HTML page
app.get("/", (req, res)=> res.sendFile(__dirname + "/index.html"));
app.use(express.static("."));

app.listen(9091, () => console.log("Listening on 9091"));
const websocketServer = require("websocket").server;
const httpServer = http.createServer(); 
httpServer.listen(9090, () => console.log("Listening on 9090")); 


const clients = {}; //hashmap of clients. Key: clientId, value: client object 
const games = {}; //hashmap of games. Key: gameId, value: game object


const wsServer = new websocketServer({ //websocket server
    "httpServer": httpServer
});

wsServer.on("request", request => {
    //when a client connects
    const connection = request.accept(null, request.origin); //TCP connection (no websocket protocalls)
    connection.on("open", () => console.log("opened connection"));
    //if client loses connection
    connection.on("close", () => {
        let cKeys = Object.keys(clients); //list of keys
        let gKeys = Object.keys(games); //list of keys
        let clientId = null; //clientId of client that lost connection
        let gameId = null; //if they were in a game, this is their gameid

        //find the clientid of the client that lost connection
        cKeys.forEach( c => {
            if (clients[c].connection === connection){
                clientId = c;
                //console.log("Client Id: "+c +" lost connection");
            }
        });

        //find the game that the client was in (could be null)
        gKeys.forEach( g => {
            games[g].clients.forEach( c => {
                if (c.clientId === clientId){
                    gameId = g;
                }
            })
        })



        if (gameId != null && games[gameId].clients.length > 2) { //game in progress
            let index = null;
            //find the index of the client in client array list of game
            for (let i = 0; i < games[gameId].clients.length; i ++) {
                if (games[gameId].clients[i].clientId === clientId){
                    index = i;
                }
            }

            //remove client from array of client from game room
            if(index !== null){
                games[gameId].clients.splice(index, 1);
            }

            //reset gameId of the client to null
            clients[clientId].gameId = null;

            //stop the interval for the game
            clearInterval(games[gameId].timeout);

            let message = {
                "method": "home-button"
            };
            //broad cast to every other player in the game that game ended
            games[gameId].clients.forEach(c => {
                clients[c.clientId].connection.send(JSON.stringify(message));
            });

            //delete the game from the hashmap
            delete games[gameId];

        } else if (gameId != null && games[gameId].clients.length <= 2){ //in lobby phase  
            let index = null;
            //find the index of the client in the array of clients in the game
            for (let i = 0; i < games[gameId].clients.length; i ++) {
                if (games[gameId].clients[i].clientId === clientId){
                    index = i;
                }
            }

            //remove the client from the array list
            if(index !== null){
                games[gameId].clients.splice(index, 1);
            }

            let message = {
                "method": "left",
                "game": games[gameId]
            }
            
            //tell other clients in the game room that user left
            games[gameId].clients.forEach(client => {
                clients[client.clientId].connection.send(JSON.stringify(message));
            });
        } 
        

    });
    connection.on("message", message => {
        //Recieved a message from client
        const result = JSON.parse(message.utf8Data); 
        
        //when user wants to create new game
        if (result.method === "create"){
            const clientId = result.clientId;
            const gameId = generateGameID();

            //timeout is the interval for the game
            games[gameId] = {
                "gameId": gameId,
                "clients": [],
                "players": [],
                "squares": [],
                "timeout": null
            };

            const message = {
                "method": "create",
                "game": games[gameId]
            };

            let con = clients[clientId].connection; //find the connection by using the current client's connection
            con.send(JSON.stringify(message));
        }

        //if user left the lobby
        if (result.method === "leave"){
            let clientId = result.clientId;
            let gameId = result.gameId;
            
            let index = null;
            //find the index of the client that left in the client array list in game
            for (let i = 0; i < games[gameId].clients.length; i ++) {
                if (games[gameId].clients[i].clientId === clientId){
                    index = i;
                }
            }

            //remove the client from the array list
            if(index !== null){
                games[gameId].clients.splice(index, 1);
            }

            let message = {
                "method": "left",
                "game": games[gameId]
            }
            
            //tell other clients in the game room that user left
            games[gameId].clients.forEach(client => {
                clients[client.clientId].connection.send(JSON.stringify(message));
            });


        }

        //when user wants to join a game
        if (result.method === "join"){
            const clientId = result.clientId;
            const gameId = result.gameId;
            const game = games[gameId];

            //if wrong gameid was entered
            if(game == undefined){
                let con = clients[clientId].connection; //find the connection by using the current client's connection
                con.send(JSON.stringify({"method":"wrong-game-id"}));
                return;
            }
            
            //max amount of players reached for the game
            if(game.clients.length > 2){
                const con = clients[clientId].connection; //find the connection by using the current client's connection
                con.send(JSON.stringify({"method":"game-full"}));
                return;
            }
            //add player into array
            game.clients.push({
                "clientId": clientId,
                "color": null,
                "lightcolor": null,
                "boxes": 0,
                "gameId": gameId
            });

            const message = {
                "method": "join",
                "game": game
            }
            //tell every client in the list of clients in the game that new client has joined
            game.clients.forEach(client => {
                clients[client.clientId].connection.send(JSON.stringify(message));
            });
        }

        //all players have joined
        if (result.method === "start-game"){
            let gameId = result.gameId;
            let squares = result.squares;
            let game = games[gameId];
            
            //only run this method for once
            if(game.players.length == game.clients.length){
                return;
            }

            //initialize the squares for the game
            game.squares = squares;

            //initialize the clients (players) and push onto array
            for (let i = 0; i < game.clients.length; i++){
                if(i === 0){
                    game.clients[i].color = "blue";
                    game.clients[i].lightcolor = "lightblue";
                } else if (i === 1){
                    game.clients[i].color = "red";
                    game.clients[i].lightcolor = "pink";
                } else {
                    game.clients[i].color = "green";
                    game.clients[i].lightcolor = "lightgreen";
                }
                game.players.push(game.clients[i]);
            }

            //set the proper hover color for everyone
            game.clients.forEach(client => {
                let hoverColorMsg = {
                    "method": "get-hovercolor",
                    "hovercolor": client.lightcolor
                }
                clients[client.clientId].connection.send(JSON.stringify(hoverColorMsg));
            });

            let payload  = {
                "method": "update",
                "game": game
            }

            //start interval for the game
            game.timeout = setInterval(function() {
                game.clients.forEach(client => {
                    clients[client.clientId].connection.send(JSON.stringify(payload));
                })
            }, 30);
        }

        //back to home button clicked
        if (result.method === "return-home"){
            let gameId = result.gameId;
            let clientId = result.clientId;

            //find the index of the client that left in the array list of clients in game
            let index = null;
            for (let i = 0; i < games[gameId].clients.length; i ++) {
                if (games[gameId].clients[i].clientId === clientId){
                    index = i;
                }
            }

            //remove client from array of client from teh array list in the game room
            if(index !== null){
                games[gameId].clients.splice(index, 1);
            }

            clients[clientId].gameId = null;

            //stop the game interval
            clearInterval(games[gameId].timeout);

            let message = {
                "method": "home-button"
            };
            games[gameId].clients.forEach(c => {
                clients[c.clientId].connection.send(JSON.stringify(message));
            });

            //delete the game from the hashmap
            delete games[gameId];
        }

        //restart btn clicked
        if (result.method === "restart-clicked"){
            let gameId = result.gameId;
            let game = games[gameId]
            

            //tell every other player that it restarted
            game.clients.forEach(client => {
                clients[client.clientId].connection.send(JSON.stringify({"method": "restart"}));
            })
        }

        //restart game
        if (result.method === "restart"){
            let gameId = result.gameId;
            let squares = result.squares;
            let game = games[gameId];
            clearInterval(game.timeout);

            //initialize the squares for the game
            game.squares = squares;

            //clear players 
            game.players = [];

            //set player scores back to 0
            game.clients.forEach(client => {
                client.boxes = 0;
            });

            //initialize the clients (players)
            for (let i = 0; i < game.clients.length; i++){
                game.players.push(game.clients[i]);
            }

            

            let payload  = {
                "method": "update",
                "game": game
            }

            //tell every player in the game to restart
            game.timeout = setInterval(function() {
                game.clients.forEach(client => {
                    clients[client.clientId].connection.send(JSON.stringify(payload));
                })
                
            }, 30);
        }

        //player plays
        if (result.method === "play"){
            let clientId = result.clientId;
            let gameId = result.gameId;
            let game = games[gameId];
            let click = result.click; //area of click (top, bottom, left, right)
            let r = result.row;
            let c = result.col;
            let s = game.squares;
            let p = game.players[0];
            let change = false; //change color, true or false

            let border = click; //arera of click (top, bottom, left, right), or whcih border to change color now
            let color = p.color;
            let lightcolor = p.lightcolor; //square color
            let fillSquare = false; //fill the current square
            let fillSquareNeighbor = false; //fill the neighbor square
            let neighbor = false;  //neighbor top or neighbor right (e.g top border of a square is also the bottom border of the square on top)

            if(clientId == p.clientId){
                //top selected:
                if(click == "top"){
                    if(!s[r][c].topSelected){ //not been already clicked before
                        change = true; //change the color

                        //add the number of sides selected for the neighbor square
                        if(r > 0){
                            s[r-1][c].numOfSideSelected += 1;
                        }
                        
                        //add the number of sides selected for the current square
                        s[r][c].numOfSideSelected += 1;
                        s[r][c].topSelected = true;
    
                        //check if this square has 4 sides selected
                        if(s[r][c].numOfSideSelected == 4){
                            p.boxes += 1;
                            fillSquare = true;
                        }
    
                        //check if this square's neighbour has 4 sides selected, then fill it up
                        //and add 1 to the score of the current player
                        if(r > 0 && s[r-1][c].numOfSideSelected == 4){
                            p.boxes += 1;
                            fillSquareNeighbor = true;
                        }

                        //if a square wasnt filled, change player turn
                        if(!fillSquare && !fillSquareNeighbor){
                            game.players.shift();
                            game.players.push(p); 
                        }
                    }
                } else if (click == "bottom"){
                    //bottom selected
                    if(r == ROWS-1){ //square without bottom neighbor
                        if (!s[r][c].bottomSelected) {
                            change = true;
                            //add the number of sides selected for this square
                            s[r][c].numOfSideSelected += 1;
                            s[r][c].bottomSelected = true;

                            //check if four sides for this square are selected
                            if(s[r][c].numOfSideSelected == 4){
                                p.boxes += 1;
                                fillSquare = true;
                            }
            
                            //if a square or more were not filled switch to next player, else dont switch
                            if(!fillSquare && !fillSquareNeighbor){
                                game.players.shift();
                                game.players.push(p);
                            }
                        }
                    } else { //square with bottom neighbor
                        if(!s[r + 1][c].topSelected){
                            change = true;
                            //add number of sides selected for neighbor square
                            s[r + 1][c].numOfSideSelected +=1
                            neighbor = true;
                            //add number of sides selected for this square
                            s[r][c].numOfSideSelected += 1;
                            
                            //set bottom neighbor top selected to true
                            s[r + 1][c].topSelected = true;
                            
                            //check if sides selected is 4
                            if(s[r][c].numOfSideSelected == 4){
                                p.boxes += 1;
                                fillSquare = true;
                            }
                            
                            //check if neighbor sides selected is four
                            if(s[r + 1][c].numOfSideSelected == 4){
                                p.boxes += 1;
                                fillSquareNeighbor = true;
                            }
            
                            //if a square or more were not filled switch to next player, else dont switch
                            if(!fillSquare && !fillSquareNeighbor){
                                game.players.shift();
                                game.players.push(p);
                            }
                        }
                }
                } else if (click == "left") {
                    if (!s[r][c].leftSelected){ //if not selected previously
                        change = true; //change color
                        //for squares with left neighbors
                        if(c > 0){ 
                            s[r][c-1].numOfSideSelected += 1
                        }
                        s[r][c].numOfSideSelected += 1;
                        s[r][c].leftSelected = true;

                        //check if current square has 4 sides selected
                        if(s[r][c].numOfSideSelected == 4){
                            p.boxes += 1;
                            fillSquare = true;
                        } 
                        //check if neighbor square has 4 sides selected
                        if(c > 0 && s[r][c-1].numOfSideSelected == 4){
                            p.boxes += 1;
                            fillSquareNeighbor = true;
                        }
              
                        //if a square or more were not filled switch to next player, else dont switch
                        if(!fillSquare && !fillSquareNeighbor){
                            game.players.shift();
                            game.players.push(p);
                        }
                        
                    }

                } else { //right click
                    if(c == COLS-1){
                        if (!s[r][c].rightSelected) {
                            change = true;
                            s[r][c].numOfSideSelected += 1;
                            s[r][c].rightSelected = true;                           
                            if(s[r][c].numOfSideSelected == 4){
                                p.boxes += 1;
                                fillSquare = true;
                            }
              
                            //if a square or more were not filled switch to next player, else dont switch
                            if(!fillSquare && !fillSquareNeighbor){
                                game.players.shift();
                                game.players.push(p);
                            } 
                        }
                    } else {
                        if(!s[r][c+1].leftSelected){
                            change = true;
                            s[r][c+1].numOfSideSelected +=1
                            s[r][c].numOfSideSelected += 1;
                            neighbor = true;
              
                            s[r][c+1].leftSelected = true;
                            if(s[r][c].numOfSideSelected == 4){
                                p.boxes += 1;
                                fillSquare = true;
                            }
              
                            if(s[r][c+1].numOfSideSelected == 4){
                                p.boxes += 1;
                                fillSquareNeighbor = true;

                            }
              
                            //if a square or more were not filled switch to next player, else dont switch
                            if(!fillSquare && !fillSquareNeighbor){
                                game.players.shift();
                                game.players.push(p);
                            } 
                        }
                        
                    }
                }
                let message = {
                    "method": "play",
                    "border": border,
                    "row": r,
                    "col": c,
                    "lightcolor": lightcolor,
                    "color": color,
                    "filledSquare": fillSquare,
                    "filledSquareNeighbor": fillSquareNeighbor,
                    "neighbor": neighbor,
                    "change": change
                }
                game.clients.forEach(client => {
                    clients[client.clientId].connection.send(JSON.stringify(message));
                });
            }




        }

        //finished game
        if (result.method === "finish-game"){
            let gameId = result.gameId;
            clearInterval(games[gameId].timeout);
        }
    });
    //generate a new clientId
    const clientId = generateClientID(); 
    clients[clientId] = {
        "connection": connection
    }

    const response = {
        "method": "connect",
        "clientId": clientId
    }

    //send back client connect
    connection.send(JSON.stringify(response));
});


//generates GUID for client
function generateClientID() { // Public Domain/MIT
    var d = new Date().getTime();//Timestamp
    var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now()*1000)) || 0;//Time in microseconds since page-load or 0 if unsupported
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16;//random number between 0 and 16
        if(d > 0){//Use timestamp until depleted
            r = (d + r)%16 | 0;
            d = Math.floor(d/16);
        } else {//Use microseconds since page-load if supported
            r = (d2 + r)%16 | 0;
            d2 = Math.floor(d2/16);
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

//generates ID for game
function generateGameID() {
    let id = "";
    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let n = chars.length;

    //8 character code
    for (let i = 0; i < 6; i++){
        id += chars.charAt(Math.floor(Math.random()*n));
    }

    return id;
}