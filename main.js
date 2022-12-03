
//GAME VARIABLES
let PLAYERS = [];    //List of players
let SQUARES = [];    //2D array of squares in the board

let ROWS = 3;   //number of row of squares
let COLS = 3;   //number of columns of squares

const GRID_LINE_COLOR = "lightgray";    //default lines of the grid color
let HOVER_COLOR = ""; //player hover color


//HTML elements
let clientId = null;
let gameId = null;
let ws = new WebSocket("ws://localhost:9090");
const createBtn = document.getElementById("create-game-btn");
const joinBtn = document.getElementById("join-game-btn");
const inputText = document.getElementById("input-game-id");
let leaveBtn = document.getElementById("leave-lobby-btn");

//events
joinBtn.addEventListener("click", e => {

    if(gameId === null){
        gameId = inputText.value;
    }

    const message = {
        "method": "join",
        "clientId": clientId,
        "gameId": gameId
    }
    ws.send(JSON.stringify(message)); //tell server to join a game
});

createBtn.addEventListener("click", e => {
    const message = {
        "method": "create",
        "clientId": clientId
    }

    ws.send(JSON.stringify(message)); //tell server to create a game

});

leaveBtn.addEventListener("click", e =>{
  //update the lobby screen
  document.getElementById("initial-screen").style.display = "flex";
  document.getElementById("game-screen").style.display = "none";
  document.getElementById("lobby-screen").style.display = "none";


  let message = {
    "method": "leave",
    "clientId": clientId,
    "gameId": gameId
  }
  ws.send(JSON.stringify(message)); //tell server that this client left the lobby
  gameId = null;

});


ws.onmessage = message => {
    //message.data is the string that the server has sent
    const response = JSON.parse(message.data);
    
    //if connect method
    if (response.method === "connect") {
        clientId = response.clientId;
        //console.log("Client id set successfully" + clientId);
    }

    //if create method
    if (response.method === "create") {
        gameId = response.game.gameId;
        //console.log("game successfully create with" + gameId);
        const message = {
          "method": "join",
          "clientId": clientId,
          "gameId": gameId
        }
        ws.send(JSON.stringify(message)); //tell server to join the game
    }

    //if left method
    if (response.method === "left"){
      gameId = response.game.gameId;
      let clients = response.game.clients; //array of clients in game room

      //update the lobby screen
      document.getElementById("initial-screen").style.display = "none";
      document.getElementById("game-screen").style.display = "none";
      document.getElementById("lobby-screen").style.display = "flex";
      document.getElementById("players-in-lobby").textContent = "Current number of players in lobby: " + clients.length;
      document.getElementById("lobby-id").textContent = "Room: "+ gameId;
    }

    //if join method
    if (response.method === "join") {
        gameId = response.game.gameId;
        let clients = response.game.clients; //array of clients in game
        document.getElementById("error-msg").textContent=""; //reset error msg back to ""
        console.log("successfully joined game:" + gameId);

        //set up lobby screen
        document.getElementById("initial-screen").style.display = "none";
        document.getElementById("game-screen").style.display = "none";
        document.getElementById("lobby-screen").style.display = "flex";
        document.getElementById("players-in-lobby").textContent = "Current number of players in lobby: " + clients.length;
        document.getElementById("lobby-id").textContent = "Room: "+ gameId;

      //start game
      if (clients.length === 3){
        SQUARES = [];
        SetupBoard(); 
        SetupRestartButton();
        let message = {
          "method": "start-game",
          "gameId": gameId,
          "squares": SQUARES,
        };
        
        //set up game screen
        document.getElementById("initial-screen").style.display = "none";
        document.getElementById("lobby-screen").style.display = "none";
        document.getElementById("game-screen").style.display = "flex";
        document.getElementById("room-id").textContent = "Room: "+gameId;

        

        ws.send(JSON.stringify(message));
      }
    }

    //get hover color
    if (response.method === "get-hovercolor"){
      HOVER_COLOR = response.hovercolor;
    }

    //if update method
    if (response.method === "update") {
      PLAYERS = response.game.players;
      SQUARES = response.game.squares;
      let turnDiv = document.getElementById("player-turn");
      
      //display whos turn it is
      if(PLAYERS[0].clientId === clientId){
        turnDiv.textContent = "Your turn!";
      } else{
        turnDiv.textContent = capitalizeFirstLetter(PLAYERS[0].color) + " is playing...";
      }
      turnDiv.style.color = PLAYERS[0].color;
      UpdateScore();
      if (CheckWin()){
          OpenModal(); //open ending popup screen
          let message = {
            "method": "finish-game",
            "gameId": gameId
          }
          ws.send(JSON.stringify(message));
      }
    }

    //if restart method
    if (response.method === "restart"){
      let parentDiv = document.getElementById("game-board");
      let modal = document.getElementById("myModal");
      let winText = document.getElementById("modal-win-text");
      let scoresText = document.getElementById("modal-scores-text");

      modal.style.display = "none"; //hide popup
      winText.replaceChildren(); //clear children
      scoresText.replaceChildren(); //clear children
      parentDiv.replaceChildren(); //clears the children in parentDiv

      SQUARES = []; //reset the squares
      SetupBoard(); 
      SetupRestartButton();
      let message = {
        "method": "restart",
        "gameId": gameId,
        "squares": SQUARES,
      };

      ws.send(JSON.stringify(message));
    }

    //if home button method (for others that didnt press the button)
    if (response.method === "home-button"){
      //display modal of saying that a player left the game
      let modal = document.getElementById("myModal");
      let winText = document.getElementById("modal-win-text");
      let playAgainBtn = document.getElementById("modal-playagain-btn");
      let homeBtn = document.getElementById("modal-home-btn");
      winText.textContent = "A player has left the game."
      modal.style.display = "block";
      playAgainBtn.style.display = "none";

      homeBtn.onclick = () => {
        location.href='index.html';
      }


    }

    //if play method
    if (response.method === "play"){
      let border = response.border;
      let r = response.row;
      let c = response.col;
      let lightcolor = response.lightcolor;
      let color = response.color;
      let filledSquare = response.filledSquare;
      let filledSquareNeighbor = response.filledSquareNeighbor;

      let neighbor = response.neighbor;
      let change = response.change;

      if(border === "top" && change){
        document.getElementById("sq-"+r+"-"+c).style.borderTopColor = color;
        if (filledSquare){
          document.getElementById("sq-"+r+"-"+c).style.background = lightcolor;
        }
        if(filledSquareNeighbor){
          document.getElementById("sq-"+(r-1)+"-"+c).style.background = lightcolor;
        } 

      } else if (border === "bottom" && change){
        if (neighbor){
          document.getElementById("sq-"+(r+1)+"-"+c).style.borderTopColor = color;
        } else {
          document.getElementById("sq-"+r+"-"+c).style.borderBottomColor = color;
        }
        if (filledSquare){
          document.getElementById("sq-"+r+"-"+c).style.background = lightcolor;
        }
        if(filledSquareNeighbor){
          document.getElementById("sq-"+(r+1)+"-"+c).style.background = lightcolor;
        } 

      } else if (border === "left" && change){
        document.getElementById("sq-"+r+"-"+c).style.borderLeftColor = color;
        if (filledSquare){
          document.getElementById("sq-"+r+"-"+c).style.background = lightcolor;
        }
        if(filledSquareNeighbor){
          document.getElementById("sq-"+r+"-"+(c-1)).style.background = lightcolor;
        } 

      } else if (border === "right" && change) {
        if (neighbor){
          document.getElementById("sq-"+r+"-"+(c+1)).style.borderLeftColor = color;
        } else {
          document.getElementById("sq-"+r+"-"+c).style.borderRightColor = color;
        }
        
        if (filledSquare){
          document.getElementById("sq-"+r+"-"+c).style.background = lightcolor;
        }
        if(filledSquareNeighbor){
          document.getElementById("sq-"+r+"-"+(c+1)).style.background = lightcolor;
        }
      }

    }


    //if game id given did not exist method
    if (response.method === "wrong-game-id") {
        gameId = null;
        document.getElementById("error-msg").textContent = "Room does not exist";
    }

    //if game room already has 3 players
    if (response.method === "game-full") {
      gameId = null;
      document.getElementById("error-msg").textContent = "Room is full";
    }
}

/**
* Square object
* @param {*} square Parent div (square shape)
* @param {*} top Child div (top side of square)
* @param {*} bottom Child div (bottom side of square)
* @param {*} left Child div (left side of square)
* @param {*} right Child div (right side of square)
* @param {*} row number
* @param {*} col number
*/
function Square(square, top, bottom, left, right, row, col){
  this.row = row; //row index of square in SQUARES
  this.col = col; //col index of square in SQUARES

  this.square = square;
  this.top = top;
  this.bottom = bottom;
  this.left = left;
  this.right = right;
  this.owner = null; //player that filled up this square

  this.numOfSideSelected = 0; //number of sides selected for this square 
  this.topSelected = false; //if top was clicked true, else false
  this.bottomSelected = false; //if bottom was clicked true, else false
  this.leftSelected = false; //if left was clicked true, else false
  this.rightSelected = false; //if right was clicked true, else false

  //top click
  this.top.onclick = () => {
      let message = {
        "method": "play",
        "row": this.row,
        "col": this.col,
        "click": "top",
        "gameId": gameId,
        "clientId": clientId
      }

      ws.send(JSON.stringify(message));
      
    }

  //bottom click
  this.bottom.onclick = () => {
    let message = {
      "method": "play",
      "row": this.row,
      "col": this.col,
      "click": "bottom",
      "gameId": gameId,
      "clientId": clientId
    }

    ws.send(JSON.stringify(message));
  }
  
  //left click
  this.left.onclick = () => {
    let message = {
      "method": "play",
      "row": this.row,
      "col": this.col,
      "click": "left",
      "gameId": gameId,
      "clientId": clientId
    }

    ws.send(JSON.stringify(message));
  }
      
  //right click
  this.right.onclick = () => {
    let message = {
      "method": "play",
      "row": this.row,
      "col": this.col,
      "click": "right",
      "gameId": gameId,
      "clientId": clientId
    }

    ws.send(JSON.stringify(message));
  }

  // top hover
  this.top.onmouseover = () => {
    if (this.square.style.borderTopColor == ""){
        this.square.style.borderTopColor = HOVER_COLOR; 
    }
}
this.top.onmouseout = () => {
    if(this.square.style.borderTopColor == HOVER_COLOR){
        this.square.style.borderTopColor = "";
    }
}

//bottom hover
this.bottom.onmouseover = () => {
    
  if(this.row == ROWS-1){ //has no bottom neighbor
      if (this.square.style.borderBottomColor == "") {
          this.square.style.borderBottomColor = HOVER_COLOR; 
      }
  } else {
      //check if neighbor side as selected (in this case its the top side of the neightbor)
      if(document.getElementById("sq-"+(row+1)+"-"+col).style.borderTopColor == ""){
        document.getElementById("sq-"+(row+1)+"-"+col).style.borderTopColor = HOVER_COLOR; 
      }
  }
  
  
}
this.bottom.onmouseout = () => {
  if(this.row == ROWS-1){
      if (this.square.style.borderBottomColor == HOVER_COLOR){
          this.square.style.borderBottomColor = ""; 
      }
  } else {
      if (document.getElementById("sq-"+(row+1)+"-"+col).style.borderTopColor == HOVER_COLOR){
        document.getElementById("sq-"+(row+1)+"-"+col).style.borderTopColor = ""; 
      }
  }

  
}

//left hover
this.left.onmouseover = () => {
  if (this.square.style.borderLeftColor == ""){
      this.square.style.borderLeftColor = HOVER_COLOR; 
  }
}
this.left.onmouseout = () => {
  if(this.square.style.borderLeftColor == HOVER_COLOR){
      this.square.style.borderLeftColor = "";
  }
}

//right hover
this.right.onmouseover = () => { 
  if(this.col == COLS-1){
      if (this.square.style.borderRightColor == ""){
          this.square.style.borderRightColor = HOVER_COLOR; 
      }
  } else {
      if(document.getElementById("sq-"+row+"-"+(col+1)).style.borderLeftColor == ""){
        document.getElementById("sq-"+row+"-"+(col+1)).style.borderLeftColor = HOVER_COLOR; 
      }
  }
}

this.right.onmouseout = () => {
  if(this.col == COLS-1){
      if (this.square.style.borderRightColor == HOVER_COLOR){
          this.square.style.borderRightColor = ""; 
      }
  } else {
      if(document.getElementById("sq-"+row+"-"+(col+1)).style.borderLeftColor == HOVER_COLOR){
        document.getElementById("sq-"+row+"-"+(col+1)).style.borderLeftColor = ""; 
      }
  }       
}

}
      
  

/**
* Function to update the score
*/
function UpdateScore() {
  let bp = document.getElementById("blue-player");
  let rp = document.getElementById("red-player");
  let gp = document.getElementById("green-player");

  for (player of PLAYERS){
      if (player.color === "blue"){
          bp.textContent = "Blue: " + player.boxes;
      } else if (player.color === "green"){
          gp.textContent = "Green: " + player.boxes;
      } else if (player.color === "red"){
          rp.textContent = "Red: " + player.boxes;
      }
  }
}

/**
* Function to check which player won
* @returns true if there is a winner, false if no winner yet
*/
function CheckWin() {
  let numOfFilledSquares = 0;
  for (player of PLAYERS){
      numOfFilledSquares += player.boxes;
  }

  if (numOfFilledSquares == ROWS*COLS){
      return true;
  } else {
      return false;
  }
}

/**
* Function to setup the restart button
*/
function SetupRestartButton() {
  let btn = document.getElementById("restart-button");
  btn.onclick = () => {
      let message = {
        "method": "restart-clicked",
        "gameId": gameId,
      };
      ws.send(JSON.stringify(message));
    }
  
    let homeBtn = document.getElementById("back-home-button");

    homeBtn.onclick = () => {
      location.href='index.html';
      
      let message = {
        "method": "return-home",
        "gameId": gameId,
        "clientId": clientId
      }
      ws.send(JSON.stringify(message));

    }
}

/**
* Function to setup the board UI and append Sqaures to SQUARES
*/
function SetupBoard(){
  let board = document.getElementById("game-board");

  for (let r = 0; r < ROWS; r++){
      rowOfSquares = [];

      let row = document.createElement("div");
      row.style.display = "flex";

      for(let c = 0; c < COLS; c++){
          
          
          let outerbox = document.createElement("div"); //top parent div
          outerbox.className = "outerbox";

          let box = document.createElement("div"); //child of outerbox
          box.className = "box";
          let wSize = 100/COLS-(20/COLS)+"vw"; //100/COLS is for width of each Square. -(20/COLS) is for to make left and right margins
          let hSize = 100/ROWS-(40/ROWS)+"vh"; //100/ROWS is for height of each Square. -(20/ROWS) is for to make top and bottom margins
          box.style.setProperty("--wSize", wSize); //the min of wSize and hSize get calculated in the stylesheet, so that squares size are relative to the min
          box.style.setProperty("--hSize", hSize);

          outerbox.style.setProperty("--wBordW", wSize);
          outerbox.style.setProperty("--hBordW", hSize);


      
          let rotate = document.createElement("div"); //child of box
          rotate.className = "rotate";
      
          let top = document.createElement("div"); //children of rotate
          let bottom = document.createElement("div");
          let right = document.createElement("div");
          let left = document.createElement("div");
        
      
          rotate.appendChild(top);
          rotate.appendChild(right);
          rotate.appendChild(left);
          rotate.appendChild(bottom);
      
          box.appendChild(rotate);
          outerbox.appendChild(box);
    
          if (c < COLS-1){
              outerbox.style.borderRightStyle = "hidden"; //hide the right border of all squares except the most right squares (of SQUARES)
          }

          if (r < ROWS-1){
              outerbox.style.borderBottomStyle = "hidden"; //hide the bottom borders of all squares except the most bottom squares (of SQUARES)

          }

          //set ids
          outerbox.id = "sq-"+r+"-"+c;
        

          rowOfSquares.push(new Square(outerbox, top, bottom, left, right, r, c));
          row.appendChild(outerbox);
      }
      SQUARES.push(rowOfSquares);

      board.appendChild(row);
  }

  //calculate proper size for the top-bar which shows the scores and restart button
  let topBar = document.getElementById("top-bar");
  let tbWidth0 = COLS*(100/COLS-(20/COLS))+"vw"; //find the total width of the grid by COLS*width of one square
  let tbWidth1 = ROWS*(100/ROWS-(40/ROWS))+"vh"; //find the total height of the grid by ROWS*width of one square
  topBar.style.setProperty("--tbWidth0", tbWidth0); //the min of these get calculated in the stylesheet, so that top-bar width is relative to the min
  topBar.style.setProperty("--tbWidth1", tbWidth1);
}

/**
* Function to open the ending popup window
*/
function OpenModal(){
  // Get the modal
  let modal = document.getElementById("myModal");
  let winText = document.getElementById("modal-win-text");
  let scoresText = document.getElementById("modal-scores-text");
  let playAgainBtn = document.getElementById("modal-playagain-btn");
  let homeBtn = document.getElementById("modal-home-btn");

  let maxBoxes = 0; //max number of filled squares from a player

  //finding the max number of boxes from each player
  for (player of PLAYERS){
      if (player.boxes > maxBoxes){
          maxBoxes = player.boxes;
      }
  }

  //array of winners because more than 1 player may have the highest score
  let winner = [];

  for (player of PLAYERS){
      if (player.boxes == maxBoxes){
          winner.push(player);
      }
  }

  //setting text of who won
  let text = "Winner(s): ";
  let a = document.createElement("a");
  a.textContent = text;
  winText.appendChild(a);

  if(winner.length > 1){
      for (w of winner){
          let b = document.createElement("a");
          b.textContent = " " + capitalizeFirstLetter(w.color);
          b.style.color = w.color;
          winText.appendChild(b)
      }
  } else {
      let b = document.createElement("a");
      b.textContent = " " + capitalizeFirstLetter(winner[0].color);
      b.style.color = winner[0].color;
      winText.appendChild(b)
  }

  //setting text of the scores
  for (player of PLAYERS){
      let c  = document.createElement("div");
      c.textContent = capitalizeFirstLetter(player.color) + ": " + player.boxes;
      c.style.color = player.color;
      scoresText.appendChild(c);
  }

  //Play Again button on click
  playAgainBtn.onclick = function() {
      let message = {
        "method": "restart-clicked",
        "gameId": gameId,
      };
      ws.send(JSON.stringify(message));
  }

  //home button on click
    homeBtn.onclick = () => {
      location.href='index.html';
      
      let message = {
        "method": "return-home",
        "gameId": gameId,
        "clientId": clientId
      }
      ws.send(JSON.stringify(message));

    }

  

  modal.style.display = "block"; //show popup

}

/**
* Helper function to capitalize the first letter of a string
* @param {*} string String
* @returns string with first letter capitalized
*/
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

