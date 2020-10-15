// Checkers Game using WebGL
// AUTHORS: 
'use strict';
    
// Global WebGL context variable
let gl;

// Drawing sizes
const SQUARE_SZ = 2/8;
const PIECE_RADIUS = SQUARE_SZ/2 * 0.8; // make the radius a little smaller than a square so it fits inside
const BIGGER_RADIUS = PIECE_RADIUS + 0.01; // the outline of the piece

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

// Useful constants
const SHIFT_DISTANCE = -0.01;
const ROW_COLUMN_SIZE = 8;


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
    
    // TODO: make this a better comment
    // Send the dark tiles to the fragment shader
    gl.uniform4fv(gl.program.uTColor, DARK_SQUARE);

    // Initialize game data
    initialize_board();

    // Render the static scene
    render();
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
        // add uniforms
        uniform vec4 uTranslation;
        uniform float uLarger;
        
        void main() {
            // gl_Position = aPosition;
            gl_Position = aPosition + uTranslation;
        }`
    );

    // Fragment Shader
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        out vec4 fragColor;

        // add uniforms
        uniform vec4 uTColor;

        void main() {
            //fragColor = vec4(1, 0, 0, 1);
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

    let circle_coords = [];
    // The original origin coordinates
    gl.origin_x_init = -7/8;
    gl.origin_y_init = -7/8;
    // Push co-ords of the piece
    circle(gl.origin_x_init, gl.origin_y_init, PIECE_RADIUS, NUM_SIDES, circle_coords);
    // Push co-ords of the piece's outline
    circle(gl.origin_x_init, gl.origin_y_init, BIGGER_RADIUS, NUM_SIDES, circle_coords);

    // Create and bind circleVAO
    gl.circleVAO = gl.createVertexArray();
    gl.bindVertexArray(gl.circleVAO);

    // Load the vertex coordinate data onto the GPU and associate with attribute
    let circle_buffer = gl.createBuffer(); // create a new buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, circle_buffer); // bind to the new buffer
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(circle_coords), gl.STATIC_DRAW); // load the data into the buffer
    gl.vertexAttribPointer(gl.program.aPosition, 2, gl.FLOAT, false, 0, 0); // associate the buffer with "aPosition" as length-2 vectors of floats
    gl.enableVertexAttribArray(gl.program.aPosition); // enable this set of data

    // The vertices for the first tile
    let square_coords = [-4/4, -4/4, -4/4, -3/4, -3/4, -3/4, -3/4, -4/4];

    // Create and bind squareVAO
    gl.squareVAO = gl.createVertexArray();
    gl.bindVertexArray(gl.squareVAO);

    // Load the vertex data into the GPU and associate with shader
    let square_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, square_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(square_coords), gl.STATIC_DRAW);
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


function initialize_board() {

    // Initialize game data
    // Red is 0, White is 1
    gl.current_player = 0;

    // Push the initial positions of the pieces to the respective lists
    gl.red_pieces_pos = [];
    gl.white_pieces_pos = [];

    for (let i = 0; i < 8; ++i) {

        let new_position = [];

        if (i < 3) {

            // Only draw pieces on every other square
            for (let j = i % 2 === 0 ? 0 : 1; j < ROW_COLUMN_SIZE; j = j + 2) {

                //define the pice x, y, and is_king values
                new_position =  [j/4, i/4, false];
                gl.red_pieces_pos.push(new_position);

            } 

        } else if (i >= 5) {

            // Ditto
            for (let j = i % 2 === 0 ? 0 : 1; j < ROW_COLUMN_SIZE; j = j + 2) {

                //define the pice x, y, and is_king values
                new_position = [j/4, i/4], false;
                gl.white_pieces_pos.push(new_position);
    
            }
            
        }

    }
}


/**
 * Render the scene. Uses a loop to to go over the entire board and render each square and piece.
 * The light squares (which cannot have pieces on them) are not directly done here but instead by
 * the clear color.
 */
function render() {

    // Clear the scene
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the board
    draw_board();

    // Draw pieces
    draw_pieces(gl.current_player);    
}


function draw_board() {

    // Draw board
    gl.bindVertexArray(gl.squareVAO);
    gl.uniform4fv(gl.program.uTColor, DARK_SQUARE);

    for(let i = 0; i < ROW_COLUMN_SIZE; ++i) {

        // Draw every other square
        for(let j = i%2 === 0 ? 0 : 1; j < ROW_COLUMN_SIZE; j = j + 2) {

            gl.uniform4fv(gl.program.uTranslation, [j/4, i/4, 0, 0]);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        }

    }

}


function draw_pieces(current_player) {

    let [red_border, white_border] = get_border_colors(current_player);

    // Bind VAO
    gl.bindVertexArray(gl.circleVAO);
    
    // Draw red pieces
    for (let i = 0; i < gl.red_pieces_pos.length; ++i) {

        let [x, y] = [gl.red_pieces_pos[i][0], gl.red_pieces_pos[i][1]];
        
        // Draw outline
        gl.uniform4fv(gl.program.uTColor, red_border);
        gl.uniform4fv(gl.program.uTranslation, [x, y, 0.0, 0.0]);
        gl.drawArrays(gl.TRIANGLE_FAN, NUM_SIDES + 2, NUM_SIDES + 2);
        
        // Draw piece
        gl.uniform4fv(gl.program.uTColor, PLAYER_1);
        gl.uniform4fv(gl.program.uTranslation, [x, y - SHIFT_DISTANCE, 0.0, 0.0]);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);
    }

    // Draw white pieces
    for (let i = 0; i < gl.white_pieces_pos.length; ++i) {

        let [x, y] = [gl.white_pieces_pos[i][0], gl.white_pieces_pos[i][1]];
        
        // Draw outline
        gl.uniform4fv(gl.program.uTColor, white_border);
        gl.uniform4fv(gl.program.uTranslation, [x, y + SHIFT_DISTANCE, 0.0, 0.0]);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);
        
        // Draw piece
        gl.uniform4fv(gl.program.uTColor, PLAYER_2);
        gl.uniform4fv(gl.program.uTranslation, [x, y, 0.0, 0.0]);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);
    }

}


function get_border_colors(current_player) {

    let red_border;
    let white_border;

    if (current_player === 0) {

        red_border = BORDER_CURRENT_TURN;
        white_border = WHITE;

    } else {

        red_border = BLACK;
        white_border = BORDER_CURRENT_TURN;

    }

    return [red_border, white_border];

}


/*
function draw_king() {

    // Draw the man piece
    gl.uniform4fv(gl.program.uTranslation, [0, 1.0 - 0.01, 0.0, 0.0]);
    gl.uniform4fv(gl.program.uTColor, BLACK);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);
    gl.uniform4fv(gl.program.uTColor, PLAYER_2);
    gl.uniform4fv(gl.program.uTranslation, [0.0, 1.0, 0.0, 0.0]);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);

    // Draw a second piece offset from the first one
    gl.uniform4fv(gl.program.uTranslation, [0.0, 1.0 + 0.01, 0.0, 0.0]);
    gl.uniform4fv(gl.program.uTColor, BLACK);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);
    gl.uniform4fv(gl.program.uTColor, PLAYER_2);
    gl.uniform4fv(gl.program.uTranslation, [0.0, 1.00 + 0.01 * 2.0, 0.0, 0.0]);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);

}
*/


/**
 * Add the vertices for a circle centered at (cx, cy) with a radius of r and n sides to the
 * array coords.
 */
function circle(cx, cy, r, n, coords) {

    // The angle between subsequent vertices
    let theta = 2 * Math.PI/n;

    // Push the center vertex (all triangles share this one)
    coords.push(cx, cy);

    // Push the first coordinate around the circle
    coords.push(cx + r, cy);

    // Loop over each of the triangles we have to create
    for (let i = 1; i <= n; ++i) {

        // Push the next coordinate
        coords.push(cx + Math.cos(i * theta) * r, cy + Math.sin(i * theta) * r);

    }
}


/**
 * 
 */
function onClick(e) {
    
    // Convert click location to clip co-ordinates
    let [x, y, w, h] = [e.offsetX, e.offsetY, this.width, this.height];
    [x, y] = [(-1 + 2 * x/(w - 1)), (1 - 2 * y/(h - 1))];

    let active_player_pieces;
    let inactive_player_pieces;
    // Determine which pieces to check
    if (gl.current_player === 0) {

        active_player_pieces = gl.red_pieces_pos;
        inactive_player_pieces = gl.white_pieces_pos;

    } else {

        active_player_pieces = gl.white_pieces_pos;
        inactive_player_pieces = gl.red_pieces_pos;

    }

    

        
    // E: It's not very efficient to check every single piece, but it works
    for (let i = 0; i < active_player_pieces.length; i++) {

    
        if (within_bounds(gl.current_player, active_player_pieces, i, x, y)) {
                
            gl.bindVertexArray(gl.circleVAO);

            let [x_coord, y_coord] = [active_player_pieces[i][0], active_player_pieces[i][1]];
            let highlight_color = get_highlight_color(gl.current_player);

            // TODO: move this to after the logic
            // Rerender and draw the highlighted piece
            render();

            draw_a_piece(x_coord, y_coord - SHIFT_DISTANCE, highlight_color);
                
                
            //save piece index and owner
            gl.last_clicked_piece = i;
            // Get valid positions
            gl.potential_squares = get_potential_squares(x_coord, y_coord, gl.current_player, active_player_pieces,
                inactive_player_pieces, active_player_pieces[i][2]);
            

            //draw a piece for each potential move in potential_squares
            for(let j = 0; j < gl.potential_squares.length; j++) {
                    
                draw_a_piece(gl.potential_squares[j][0], gl.potential_squares[j][1], POTENTIAL_PIECE);

            }
            break; 

        } else { 
            render(); 
        }

    }

    if(gl.potential_squares !== null) {
        for (let i = 0; i < gl.potential_squares.length; i++) {
                
            if (within_bounds(gl.current_player, gl.potential_squares, i, x, y)) {
                    

                gl.bindVertexArray(gl.circleVAO);

                //update the index of the recently move piece
                let new_index = gl.last_clicked_piece;
                active_player_pieces[new_index] = [gl.potential_squares[i][0], gl.potential_squares[i][1]];

                //if piece jump remove rivals piece
                if(gl.potential_squares[i][2] === true) {
                    
                    for(let j = 0; j < inactive_player_pieces.length; j++) {
                        if(inactive_player_pieces[j][0] === gl.potential_squares[i][3][0] && inactive_player_pieces[j][1] === gl.potential_squares[i][3][1]) {
                            inactive_player_pieces.splice(j, 1);
                        }
                    }
                }

                //reset logical values and pass the turn
                gl.last_clicked_piece = null;
                gl.potential_squares = null;
                gl.current_player = (gl.current_player + 1) % 2;
                    
        
                // TODO: move this to after the logic
                // Rerender and draw the highlighted piece
                //update the coordinates in the active_player_pieces
                render();                   
                break;        
            } 
        }
    }
}


function within_bounds(current_player, pieces_positions, i, x, y) {

    // If the distance from the origin is less than or equal to the radius, 
    // it is within the circle
    let origin_x = gl.origin_x_init + pieces_positions[i][0];
    let origin_y = gl.origin_y_init + pieces_positions[i][1];
    let distance_origin = Math.sqrt(
        Math.pow(x - origin_x, 2) + 
        Math.pow(y - origin_y, 2));

    // Checks distance from origin of circle
    if (distance_origin <= PIECE_RADIUS) { return true; } else { return false; }

}

function draw_a_piece(x, y, color) {

    //draw outline
    gl.uniform4fv(gl.program.uTColor, BLACK);
    gl.uniform4fv(gl.program.uTranslation, [x, y, 0.0, 0.0]);
    gl.drawArrays(gl.TRIANGLE_FAN, NUM_SIDES + 2, NUM_SIDES + 2);

    //draw circle
    gl.uniform4fv(gl.program.uTColor, color);
    gl.uniform4fv(gl.program.uTranslation, [x, y, 0.0, 0.0]);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, NUM_SIDES + 2);

}

function get_highlight_color(current_player) {

    if (current_player === 0) {

        return PLAYER_1_HIGHLIGHT;

    } else {

        return PLAYER_2_HIGHLIGHT;

    }

}


//function returns the available movements of a piece given the pice x, y transformation values
function get_potential_squares(x, y, current_player, turn_pieces_positions, opponent_pieces_positions, is_king) {
    /* 
    This function takes the position modifiers to determine a piece position, and
    uses current_player, turn_pieces_positions, opponent_pieces_positions to determine 
    the valid moves for a click checker
    */

    let positive_displacement = 1/4
    let negative_displacement = -1/4
    let current_piece_x_pos = gl.origin_x_init + x;
    let current_piece_y_pos = gl.origin_y_init + y;
    let lower_bound = -7/8
    let upper_bound = 7/8
    let potential_squares = [];
    
    if(is_king) {
        return potential_squares;
    } else {

        //wrapper variables to increase readability
        let new_x;
        let new_y;
        //checks if combinations right and  up is legal if for red; or, right and  down if white
        if( current_piece_x_pos + positive_displacement <= upper_bound) {
            new_x = x + positive_displacement;
            //case: current player is red
            if(current_player === 0) {


                if(current_piece_y_pos + positive_displacement <= upper_bound) {
                    new_y = y + positive_displacement;
                    
                    
                    if(square_free(turn_pieces_positions, new_x, new_y)) {

                        if(square_free(opponent_pieces_positions, new_x, new_y)) {
                            //case: first diagonal space is free,
                            //in adition to the coords, pass a bolean(has_to_jump), and if any rival relevant coord
                            potential_squares.push([new_x, new_y, false, []]);
                        
                        } else {

                            if( current_piece_x_pos + 2 * positive_displacement <= upper_bound) {

                                if(current_piece_y_pos + 2 *  positive_displacement <= upper_bound) {

                                
                                    new_x = x + 2*positive_displacement;
                                    new_y = y + 2*positive_displacement;
                                    if(square_free(opponent_pieces_positions, new_x, new_y)) {

                                        //case: first diagonal space is ocupied by rival, and second digonal space is free, 
                                        //in adition to the coords, pass a bolean(has_to_jump)
                                        potential_squares.push([new_x, new_y, true, [x + positive_displacement, y + positive_displacement]]);

                                    }
                                }
                            }
                            

                        }
                        
                    }

                }

            //case: current player is white
            } else if(current_piece_y_pos + negative_displacement >= lower_bound) {
                new_y = y + negative_displacement;

                if(square_free(turn_pieces_positions, new_x, new_y)) {

                    if(square_free(opponent_pieces_positions, new_x, new_y)) {
                        //case: first diagonal space is free, 
                        //in adition to the coords, pass a bolean(has_to_jump), and if any rival relevant coord
                        potential_squares.push([new_x, new_y, false, []]);
                        
                    } else {

                        if( current_piece_x_pos + 2 * positive_displacement <= upper_bound) {

                            if(current_piece_y_pos + 2 *  negative_displacement <= upper_bound) {

                                
                                new_x = x + 2*positive_displacement;
                                new_y = y + 2*negative_displacement;
                                if(square_free(opponent_pieces_positions, new_x, new_y)) {

                                    //case: first diagonal space is ocupied by rival, and second digonal space is free,
                                    //, in adition to the coords, pass a bolean(has_to_jump), and if any rival relevant coord
                                    potential_squares.push([new_x, new_y, true, [x + positive_displacement, y + negative_displacement]]);

                                }
                            }
                        }
                            
                    }
                        
                }

            }

                
            
        } 
        
        //checks if combinations left and  up is legal if for red; or, left and  down if white
        if (current_piece_x_pos + negative_displacement >= lower_bound ) {
            new_x = x + negative_displacement;
            //case: current player is red
            if(current_player === 0) {


                if(current_piece_y_pos + positive_displacement <= upper_bound) {
                    new_y = y + positive_displacement;
                    
                    
                    if(square_free(turn_pieces_positions, new_x, new_y)) {

                        if(square_free(opponent_pieces_positions, new_x, new_y)) {
                            //case: first diagonal space is free,
                            //in adition to the coords, pass a bolean(has_to_jump), and ,if any rival, relevant rival coords
                            potential_squares.push([new_x, new_y, false, []]);
                        
                        } else {

                            if( current_piece_x_pos + 2 * negative_displacement <= upper_bound) {

                                if(current_piece_y_pos + 2 *  positive_displacement <= upper_bound) {

                                
                                    new_x = x + 2*negative_displacement;
                                    new_y = y + 2*positive_displacement;
                                    if(square_free(opponent_pieces_positions, new_x, new_y)) {

                                        //case: first diagonal space is ocupied by rival, and second digonal space is free
                                        //in adition to the coords, pass a bolean(has_to_jump), and ,if any rival, relevant rival coords
                                        potential_squares.push([new_x, new_y, true, [x + negative_displacement, y + positive_displacement]]);

                                    }
                                }
                            }
                            

                        }
                        
                    }

                }

            //case: current player is white
            } else if(current_piece_y_pos + negative_displacement >= lower_bound) {
                new_y = y + negative_displacement;

                if(square_free(turn_pieces_positions, new_x, new_y)) {

                    if(square_free(opponent_pieces_positions, new_x, new_y)) {
                        //case: first diagonal space is free
                        potential_squares.push([new_x, new_y]);
                        
                    } else {

                        if( current_piece_x_pos + 2 * negative_displacement <= upper_bound) {

                            if(current_piece_y_pos + 2 *  negative_displacement <= upper_bound) {

                                
                                new_x = x + 2*negative_displacement;
                                new_y = y + 2*negative_displacement;
                                if(square_free(opponent_pieces_positions, new_x, new_y)) {

                                    //case: first diagonal space is ocupied by rival, and second digonal space is free
                                    //in adition to the coords, pass a bolean(has_to_jump), and if any rival relevant coord
                                    potential_squares.push([new_x, new_y, true, [x + negative_displacement, y + negative_displacement] ]);

                                }
                            }
                        }
                    }         
                }

            }

                
            
        } 
    }

    return potential_squares;
    
}



function square_free(pieces_positions, x, y) {

    for (let p = 0; p < pieces_positions.length; p++) {

        if (pieces_positions[p][0] === x && pieces_positions[p][1] === y) {

            return false;
        }
    }
    return true;
}