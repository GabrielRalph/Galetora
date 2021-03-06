var logo, mic, fft, sig1, sig2, sig3, rad, rad2, rainbow, rainBeat, rainBeat2
var h = window.innerHeight;
var w = window.innerWidth;
function preload(){
  logo = loadImage('Assets/logo.png')
}
function initialize(){
  rainBeat = new Rainbow(7)
  rainBeat2 = new Rainbow(12)
  rainbow = new Rainbow(25, w)

  sig1 = new Signal(9);
  sig2 = new Signal(9);
  sig3 = new Signal(9);

  rad = new Ball(width/2, height/2, 200, 0, -2.5);
  rad2 = new Radius(width/2, height/2, 200, -3);
  rad.xVel = 5;
  xPos = width/2;
}
function setup(){
  createCanvas(w,h);
  background(0);
  mic = new p5.AudioIn();
  mic.start();

  fft = new p5.FFT(0.8, 256);
  fft.setInput(mic);
  initialize();

}



let xPos = 0;
let beat = 0;
let lastBeat = 0;
let col = 255;
let start = false;
var fx = 50;
var bass = 0;
let fade = 0;
let touchX = 0;
let touchY = 0;
let touchR = 0;
let touchEnd = 1;
let xInc = 5;
var lastSpectrum = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
function draw(){


  background(col)
  if(start&&(col == 0)){

    let spectrum = fft.analyze()
    bass = mic.getLevel()*fx;

    colorMode(RGB, 50)
    fill(fade--);
    stroke(0);
    text('Scale: ' + Math.round(fx), 50, 50);

    beat = sig2.dif()*10
    if(bass > 10){

      if(bass - lastBeat > 5){
        rainBeat.inc();
        rainBeat2.inc();
        rad.changeVel(0, 30)
        rad2.r = rad2.size + bass*5;
      }

     }
     lastBeat = bass;

    rainBeat.set('f');
    rainBeat.set('s', (x, d) => {return Math.round(x + d/2)%d});
    rad2.render();

    rainBeat2.set('f', (x, d) => {return Math.round(x + d/2)%d});
    rainBeat2.set('s');
    rad.render();

    strokeWeight(5);

    for(var i = 0; i < 5; i ++){
      rainbow.inc();
      rainbow.set('s');
      var dif = 5*((i%2)?-1:1)*((i%2) + i)/2
      line(rad.x + dif, 0, rad.x+ dif, (spectrum[i])*fx/(rad.y/h)/1500);
    }
    lastSpectrum = spectrum
    colorMode(RGB, 50)
    stroke(0,0,0,0)
    fill(50,50,50,25);
    ellipse(touchX, touchY, touchR);
    touchR*=touchEnd;


  }else{
    image(logo, width/2, height/2);
    imageMode(CENTER);
    tint(255, col);
    if(start){
      col -= 5;
    }
  }

}


function keyPressed(){
  if(key == 'f'){
    var on = fullscreen();
    if(!on) {
      resizeCanvas(displayWidth, displayHeight)
      initialize()
    }
    fullscreen(!on)
  }else if(key == 'a'){
    fx = 2/bass/fx;
  }else if(key == 'ArrowUp'){
    fx += 5;
  }else if(key == 'ArrowDown'){
    fx -= 5;
  }
}
// function mousePressed(){
//   start = true;
//   if(getAudioContext().state !== 'running'){
//     getAudioContext().resume();
//   }
// }
var lastY = 0;
function touchMoved(event){
  fade = 50;
  if(event.touches){
    touchY = event.touches[0].pageY;
    touchX = event.touches[0].pageX;
    touchR = event.touches[0].force*w/2
    fx += (lastY - event.touches[0].pageY)*event.touches[0].force;
    lastY = event.touches[0].pageY;
  }else{
    fx -= event.movementY;
  }
}
function touchEnded(){
  touchEnd = 0.8;
}
function touchStarted(event){
  touchEnd = 1;
  start = true;
  if(event.touches){
    lastY = event.touches[0].pageY;
  }
  if(getAudioContext().state !== 'running'){
    getAudioContext().resume();
  }
}
