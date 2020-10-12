// Checkers Game using WebGL
// AUTHORS: 
'use strict';
    
// Global WebGL context variable
let gl;

// Drawing Sizes
const SQUARE_SZ = 2/8;
const PIECE_RADIUS = SQUARE_SZ/2 * 0.8; // make the radius a little smaller than a square so it fits inside
// Number of sides in the circle
const NUM_SIDES = 64;

// Basic Colors
const WHITE = [1.0, 1.0, 1.0, 1.0];
const BLACK = [0.0, 0.0, 0.0, 1.0];

// Square Colors
const DARK_SQUARE = [0.82, 0.55, 0.28, 1.0];
const LIGHT_SQUARE = [1.0, 0.89, 0.67, 1.0];

// Player Colors
const PLAYER_1 = [0.7, 0.0, 0.0, 1.0]; // red
const PLAYER_2 = [0.8, 0.8, 0.8, 1.0]; // light-gray
const PLAYER_1_HIGHLIGHT = [0.8, 0.3, 0.3, 1.0]; // lighter red
const PLAYER_2_HIGHLIGHT = [0.9, 0.9, 0.9, 1.0]; // lighter gray

// Other Colors
const BORDER_CURRENT_TURN = [0.0, 0.0, 0.0, 1.0];
const POTENTIAL_PIECE = [1.0, 1.0, 0.6, 1.0];

// Useful consts
const SHIFT_DISTANCE = -0.01;


// Once the document is fully loaded run this init function.
window.addEventListener('load', function init() {
    // Get the HTML5 canvas object from it's ID
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) { window.alert('Could not find #webgl-canvas'); return; }

    // Get the WebGL context (save into a global variable)
    gl = canvas.getContext('webgl2');
    if (!gl) { window.alert("WebGL isn't available"); return; }

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height); // this is the region of the canvas we want to draw on (all of it)
    gl.clearColor(...LIGHT_SQUARE); // setup the background color

    // Initialize the WebGL program and data
    gl.program = initProgram();
    initBuffers();
    initEvents(); 

    gl.uniform4fv(gl.program.uTColor, DARK_SQUARE);

    //variable to keep track of who is the current player 0 = red, 1 = white
    gl.Current_player = 0;


    // Render the static scene
    render_initial_board();
});


/**
 * Initializes the WebGL program.
 */
function initProgram() {
    // Compile shaders
    // Vertex Shader
    let vert_shader = compileShader(gl, gl.VERTEX_SHADER,
        `#version 300 es
        precision mediump float;

        in vec4 aPosition;
        uniform vec4 uTranslation;
        uniform float uLarger;


        
        void main() {
            gl_Position = aPosition + uTranslation;
        }`
    );
    // Fragment Shader
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        out vec4 fragColor;
        uniform vec4 uTColor;
        void main() {
            fragColor = vec4(uTColor);
        }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);
    
    // Get the attribute indices
    program.aPosition = gl.getAttribLocation(program, 'aPosition'); // get the vertex shader attribute "aPosition"
    
    //  Get the uniform indices
    program.uTranslation = gl.getUniformLocation(program, 'uTranslation');
    program.uTColor = gl.getUniformLocation(program, 'uTColor');

    return program;
}


/**
 * Initialize the data buffers.
 */
function initBuffers() {

    // The vertices of the circle
    let Ccoords = [];
    gl.initial_x_center = 1/(2*4)-4/4;
    gl.initial_y_center = 1/(2*4)-4/4;
    let BIGGER_RADIUS = PIECE_RADIUS + 0.01;
    circle(gl.initial_x_center, gl.initial_y_center , PIECE_RADIUS, NUM_SIDES, Ccoords);
    circle(gl.initial_x_center, gl.initial_y_center, BIGGER_RADIUS, NUM_SIDES, Ccoords);

    // Create and bind VAO
    gl.circleVAO = gl.createVertexArray();
    gl.bindVertexArray(gl.circleVAO);

    // Load the vertex coordinate data onto the GPU and associate with attribute
    let posBuffer = gl.createBuffer(); // create a new buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer); // bind to the new buffer
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(Ccoords), gl.STATIC_DRAW); // load the data into the buffer
    gl.vertexAttribPointer(gl.program.aPosition, 2, gl.FLOAT, false, 0, 0); // associate the buffer with "aPosition" as length-2 vectors of floats
    gl.enableVertexAttribArray(gl.program.aPosition); // enable this set of data

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);




    // The vertices for the triangle
    let coords = [-4/4, -4/4, -4/4, -3/4, -3/4, -3/4, -3/4, -4/4];

    // Create and bind VAO
    gl.squareVAO = gl.createVertexArray();
    gl.bindVertexArray(gl.squareVAO);

    // Load the vertex data into the GPU and associate with shader
    let buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(coords), gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl.program.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.program.aPosition);

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);



}


/**
 * Initialize event handlers
 */
function initEvents() {
    gl.canvas.addEventListener('click', onClick);

}


/**
 * Render the scene. Uses a loop to to go over the entire board and render each square and piece.
 * The light squares (which cannot have pieces on them) are not directly done here but instead by
 * the clear color.
 */
function render_initial_board() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    //draw the squares
    gl.bindVertexArray(gl.squareVAO);
    gl.uniform4fv(gl.program.uTColor, DARK_SQUARE);
    let row_column_size = 8;
    for(let i = 0; i < row_column_size; ++i) {
        for(let j = i%2 === 0 ? 0 : 1; j < row_column_size; j = j + 2) {
            gl.uniform4fv(gl.program.uTranslation, [j/4,i/4,0,0]);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        }
    }

    // Draw the pieces
    //Pieces are drawn by coping a original piece located at
    gl.bindVertexArray(gl.circleVAO);
    

    // Draw the red pieces
    gl.red_pieces_pos = [];
    for(let i = 0; i < 3; ++i) {
        for(let j = i%2 === 0 ? 0 : 1; j < row_column_size; j = j + 2) {
            
            let new_position =  [j/4,i/4,0,0];
            gl.red_pieces_pos.push(new_position);
            draw_current_player_piece(new_position[0], new_position[1], PLAYER_1);

        }
    }


    // Draw the black pieces
    gl.white_pieces_pos = [];
    for(let i = 5; i < 8; ++i) {
        for(let j = i%2 === 0 ? 0 : 1; j < row_column_size; j = j + 2) {

            let new_position =  [j/4,i/4];
            gl.white_pieces_pos.push(new_position);
            draw_resting_player_piece(new_position[0], new_position[1], PLAYER_2);
        }
    }

    gl.bindVertexArray(null);

}

function draw_resting_player_piece(x, y, resting_player) {

    gl.uniform4fv(gl.program.uTranslation, [x, y+SHIFT_DISTANCE,0,0]);
    gl.uniform4fv(gl.program.uTColor, BLACK);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);
    gl.uniform4fv(gl.program.uTColor, resting_player);
    gl.uniform4fv(gl.program.uTranslation, [x, y, 0, 0]);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);

}

function draw_current_player_piece(x, y, current_player) {
    //Draw slightly bigger circle using vertices in circleVAO from the position  NUM_SIDES + 2 to 2*(NUM_SIDES + 2)
    gl.uniform4fv(gl.program.uTColor, BORDER_CURRENT_TURN);
    gl.uniform4fv(gl.program.uTranslation, [x, y, 0, 0]);
    gl.drawArrays(gl.TRIANGLE_FAN, NUM_SIDES + 2, NUM_SIDES + 2);

    //Draw normal red piece
    gl.uniform4fv(gl.program.uTColor, current_player);
    gl.uniform4fv(gl.program.uTranslation, [x, y, 0, 0]);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);

}

function draw_king() {

    gl.uniform4fv(gl.program.uTranslation, [0,-.01+1,0,0]);
    gl.uniform4fv(gl.program.uTColor, BLACK);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);
    gl.uniform4fv(gl.program.uTColor, PLAYER_2);
    gl.uniform4fv(gl.program.uTranslation, [0,1,0,0]);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);

    gl.uniform4fv(gl.program.uTranslation, [0,1.01,0,0]);
    gl.uniform4fv(gl.program.uTColor, BLACK);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);
    gl.uniform4fv(gl.program.uTColor, PLAYER_2);
    gl.uniform4fv(gl.program.uTranslation, [0,1.02,0,0]);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);

}



/**
 * Add the vertices for a circle centered at (cx, cy) with a radius of r and n sides to the
 * array coords.
 */
function circle(cx, cy, r, n, Ccoords) {
    // The angle between subsequent vertices
    let theta = 2*Math.PI/n;

    // Push the center vertex (all triangles share this one)
    Ccoords.push(cx, cy);

    // Push the first coordinate around the circle
    Ccoords.push(cx+r, cy);

    // Loop over each of the triangles we have to create
    for (let i = 1; i <= n; ++i) {
        // Push the next coordinate
        Ccoords.push(cx+Math.cos(i*theta)*r, cy+Math.sin(i*theta)*r);
    }
}



/**
 * 
 */
function onClick(e) {
    let [x, y, w, h] = [e.offsetX, e.offsetY, this.width, this.height];
    [x, y] = [-1+2*x/(w-1), 1-2*y/(h-1)];

    


    if(gl.Current_player === 0) {
        for(let i = 0; i < gl.red_pieces_pos.length; i++) {
            let current_x_center = gl.initial_x_center + gl.red_pieces_pos[i][0];
            let current_y_center = gl.initial_y_center + gl.red_pieces_pos[i][1];
            
            let Distance_from_center_of_circle = Math.sqrt(Math.pow(x-current_x_center,2)+ Math.pow(y-current_y_center,2));

            if(Distance_from_center_of_circle <= PIECE_RADIUS) {

                
                //draw_current_player_piece(gl.red_pieces_pos[i][0], gl.red_pieces_pos[i][1], PLAYER_1_HIGHLIGHT);
                
                

            }
        }
    } else {

        //code will be here

    }
    

}
