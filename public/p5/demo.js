
// Koordinatları çift çift başka bir listenin içine atmak problemi çözdü. Şimdi insanın aklına, önceki
// çözümlerim doğru muydu acaba sorusu geliyor. 

let L = [];

let circleRadius = 350;

let counterList = [];

let LList = [];

let orbitalVelocityList = [];

let planetList = [];

const k = 10;

let zoomSwitch = 3;

let orbitLineWidth;

let orbitButton = false;

let distanceButton = false;

let nameButton = false;

let scaleNumber = 1;

let speed = 1;

let yearsPassed = 0;

let sunScale = 6;

let evenL = [];

let speedToggle = 8;

let scaleArr = [1,2,4,10,20];

let pause = false;

class planet{
  constructor(distance, period, color, name ,size){
    this.distance = distance;
    this.period = period;
    this.periodOriginal = period;
    this.n1 = k*period; // 1/velocity yerine periyot.
    this.n2 = Math.floor(this.n1/2);
    this.n4 = Math.floor(this.n2/2);
    this.n8 = Math.floor(this.n4/2);
    this.color = color;
    this.name = name;
    this.L1 = polygonCreator(this.n1, this.distance, width/2, height/2);
    this.L2 = polygonCreator(this.n2, this.distance, width/2, height/2);
    this.L4 = polygonCreator(this.n4, this.distance, width/2, height/2);
    this.L8 = polygonCreator(this.n8, this.distance, width/2, height/2);
    this.counter1 = 0;
    this.counter2 = 0;
    this.counter4 = 0;
    this.counter8 = 0;
    this.size = size;
  }
  prepareLs(){
    console.log("prepare Ls and counters here.");
  }
}

function setup() {

  const canvas = createCanvas(windowWidth, 300);
  canvas.parent('sketch-container');


  planetList.push(new planet(57, 88,[120, 107, 86],'Mercury',4));
  planetList.push(new planet(108, 224,[206, 183, 103],'Venus',12));
  planetList.push(new planet(149, 365,[166, 217, 245],'Earth',12));
  planetList.push(new planet(228, 687,[207, 117, 92],'Mars',7));      
  planetList.push(new planet(778, 4331,[182, 123, 77],'Jupiter',142));
  planetList.push(new planet(1432, 10747,[225, 203, 153],'Saturn',120));  
  planetList.push(new planet(2867, 30589,[66, 129, 135],'Uranus',51)); 
  planetList.push(new planet(4515, 59800,[20, 53, 98],'Neptune',49));   
  planetList.push(new planet(5906, 90560,[225, 180, 135],'Pluto',2));      
// milyonlara çıktığında, yörünge için hesaplanan koordinatlar büyük iht. hafızaya sığmıyor.

  for(let i = 0; i<planetList.length;i++){
    counterList.push(0);
  }
  background(0);
  frameRate(60);
  textStyle(BOLD);  
  textFont("Helvetica Neue");  
}

function draw() {
  background(0);
  if(zoomSwitch == 0){
    scale(1);
    orbitLineWidth = 1;
    scaleNumber = 1;
  }else if(zoomSwitch == 1){
    scale(0.5);
    translate(width/2,height/2);
    scaleNumber = 2;
    orbitLineWidth = 2;
  }else if(zoomSwitch == 2){
    scale(0.25);
    translate(width*1.5, height*1.5);
    scaleNumber = 4;
    orbitLineWidth = 4;
  }else if(zoomSwitch == 3){
    scale(0.1);
    translate(width*4.5, height*4.5);
    scaleNumber = 10;
    orbitLineWidth = 10;
  }else if(zoomSwitch == 4){
    scaleNumber = 20;
    scale(0.05);
    orbitLineWidth = 20;
    translate(width*9.5,height*9.5);
  }

  strokeWeight(2*scaleNumber);
  stroke(253, 247, 179);
  fill(253, 247, 179);
  circle(width/2, height/2, sunScale); // the sun lol

  for(let i = 0; i<planetList.length; i++){

    let planet = planetList[i];

    let x;
    let y;
    let x1;
    let y1;
    let L;
    let counter;
    let yrsPssdVar;

    if(speedToggle == 1){
      counter = planet.counter1;
      L = planet.L1;
      yrsPssdVar = planet.n1;
    }
    if(speedToggle == 2){
      counter = planet.counter2;
      L = planet.L2;
      yrsPssdVar = planet.n2;
    }
    if(speedToggle == 4){
      counter = planet.counter4;
      L = planet.L4;
      yrsPssdVar = planet.n4;
    }
    if(speedToggle == 8){
      counter = planet.counter8;
      L = planet.L8;
      yrsPssdVar = planet.n8;
    }            

    counter = Math.floor(counter); // in case it is not an integer

    x = L[counter][0];
    y = L[counter][1];      
    x1 = L[ ( counter+1) % L.length][0];
    y1 = L[ ( counter+1) % L.length][1];

    stroke(planet.color);

    if(orbitButton){
      strokeWeight(orbitLineWidth);
      noFill();
      circle(width/2, height/2, planet.distance*2);
    }

    fill(planet.color);
    strokeWeight(scaleNumber*2);
    circle(x,y,planet.size);

    if(distanceButton){
      textSize(16*scaleNumber);
      strokeWeight(0);
      fill(planet.color);
      text(planet.distance,(x+width/2)/2,(y+height/2)/2);
      strokeWeight(1*scaleNumber);
      line(x,y,width/2,height/2);
    }

    if(nameButton){
      fill(planet.color);
      textSize(16*scaleNumber);
      strokeWeight(0);
      text(planet.name, x1 + 5, y1+ planet.size + 5);
    }

    if(planet.name == "Earth"){
      yearsPassed += 1/yrsPssdVar;
      timeDisplayed = Math.round(yearsPassed * 100) / 100;
      document.getElementById("time-info").innerHTML = String(timeDisplayed) + "yrs";      
    }

    stroke('white');

    planet.counter8 = (planet.counter8 + (0.125*speedToggle)) % planet.L8.length;    
    planet.counter4 = (planet.counter4 + (0.25*speedToggle)) % planet.L4.length;              
    planet.counter2 = (planet.counter2 + (0.5*speedToggle)) % planet.L2.length;
    planet.counter1 = (planet.counter1 + (1*speedToggle)) % planet.L1.length;

  }

}

function isPositive(num) {
  if (Math.sign(num) === 1) {
    return true
  }
  return false;
}


function polygonCreator(n, w, centerX, centerY){
  let mainArr = [];
  let imperArr;
  for (let i = 0; i < n; i++) {
      imperArr = [];
      let x = (centerX + w * Math.cos(2 * Math.PI * i / n));
      let y = (centerY + w * Math.sin(2 * Math.PI * i/ n));
      imperArr.push(x);
      imperArr.push(y);
      mainArr.push(imperArr);
  }
  return mainArr;
}


function zoomButtonFunction(){
  zoomSwitch = (zoomSwitch + 1) % 5;

  document.getElementById("zoom-info").innerText = String(scaleArr[zoomSwitch]*20000)+"km";  
}

function orbitDisplayFunction(){
  if(!orbitButton){
    document.getElementById("orbitButton").classList.add("active-button"); // don't use eval.
  }else{
    document.getElementById("orbitButton").classList.remove("active-button");
  }
  orbitButton = !orbitButton;
}

function distanceDisplayFunction(){
  if(!distanceButton){
    document.getElementById("distanceButton").classList.add("active-button");
  }else{
    document.getElementById("distanceButton").classList.remove("active-button");
  }
  distanceButton  = !distanceButton;
}

function nameDisplayFunction(){
  if(!nameButton){
    document.getElementById("nameButton").classList.add("active-button");
  }else{
    document.getElementById("nameButton").classList.remove("active-button");
  }
  nameButton  = !nameButton;
}

function sunScaleFunc(){
  if(sunScale == 6){
    document.getElementById("sunscaleButton").classList.add("active-button");
  }else{
    document.getElementById("sunscaleButton").classList.remove("active-button");
  }
  sunScale = (sunScale + 1386) % 2772;
}

function toggleSpeed(){
  if(speedToggle == 8){
    speedToggle = 1;
  }else{
    speedToggle *= 2;
  }
  document.getElementById("scale-button").innerText = String(speedToggle)+"x";
}





